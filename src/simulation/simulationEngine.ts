/**
 * Complete Simulation Engine for FSOC PAT Virtual Camera System.
 * Simulates:
 * - 3D Target World Trajectory & Decoys
 * - Virtual Pan/Tilt Gimbal Dynamics with Platform Vibration
 * - Pinhole Camera Projection & Atmospheric Disturbances
 * - Synthetic CMOS/InGaAs Focal Plane Sensor Frame (intensity buffer)
 * - Classical CV vs AI Neural Detector Perception Pipelines
 * - 2D Discrete Kalman Filter with Lookahead Prediction & Coasting
 * - Closed-Loop Dual-Axis PID Gimbal Controller with Feedforward
 * - Finite State Machine (FSM): SEARCHING -> ACQUIRING -> TRACKING -> LOCKED -> COASTING -> REACQUIRING -> LOST
 * - Comprehensive Telemetry & Reproducible Benchmarking
 */

import {
  CameraConfig,
  CameraState,
  TargetConfig,
  TargetState,
  DisturbanceConfig,
  PIDGains,
  PerceptionMode,
  DetectionResult,
  FrameTelemetry,
  PerformanceStats,
  TrackingStatus,
  DecoyTarget,
  LockEvaluationMode,
} from '../types';
import { SeededPRNG } from './prng';
import { SensorFrame } from './perception/sensorFrame';
import { ClassicalCVDetector, NeuralBeaconDetector } from './perception/detectors';
import { BeaconKalmanFilter } from './kalmanFilter';
import { PATGimbalController } from './pidController';

export class FSOCSimulationEngine {
  // Configurations
  public cameraConfig: CameraConfig;
  public targetConfig: TargetConfig;
  public disturbanceConfig: DisturbanceConfig;
  public pidGains: PIDGains;
  public perceptionMode: PerceptionMode;

  // States
  public cameraState: CameraState;
  public targetState: TargetState;
  public kalmanFilter: BeaconKalmanFilter;
  public gimbalController: PATGimbalController;

  // PRNG for 100% deterministic reproducibility
  public prng: SeededPRNG;
  public currentSeed: number = 42;

  // Physical Sensor Frame and Perception Detectors
  public sensorFrame: SensorFrame;
  public classicalDetector: ClassicalCVDetector;
  public neuralDetector: NeuralBeaconDetector;

  // Simulation clock
  public simTimeSec: number = 0;
  public targetPhase: number = 0;
  public frameCount: number = 0;
  public isRunning: boolean = true;

  // Performance telemetry & measurements
  public timeToFirstLockSec: number | null = null;
  public acquisitionTimeSec: number | null = null;
  public totalFrames: number = 0;
  public lockedFrames: number = 0;
  // Frames observed after the first successful lock; used for retention %.
  public lockRetentionFrames: number = 0;
  public lockLossCount: number = 0;
  public falseLockFrames: number = 0;
  public fovFrames: number = 0;
  public detectedInFovFrames: number = 0;
  public sumSquaredAngularError: number = 0;
  public sumAngularError: number = 0;
  public maxAngularErrorDeg: number = 0;

  // Reacquisition measurement
  private lastLockLostTime: number | null = null;
  private reacquisitionTimes: number[] = [];

  // Rolling buffers for charts
  public telemetryHistory: FrameTelemetry[] = [];
  public maxHistoryLength: number = 200;

  // Finite-State Machine Tracking Persistence (Section 9)
  public previousStatus: TrackingStatus = 'SEARCHING';
  public lockPersistenceCount: number = 0;
  public coastDurationSec: number = 0;
  public reacquireCooldownFrames: number = 0;

  // Lock evaluation configuration
  public lockEvaluationMode: LockEvaluationMode = 'optical-instantaneous';
  public filterTimeConstantSec: number = 0.05; // 50ms time constant for filtered-optical EWMA
  public filteredOpticalErrorDeg: number = 0;

  // Real-time metrics
  public currentDetection: DetectionResult = {
    detected: false,
    centroid: null,
    boundingBox: null,
    confidence: 0,
    candidatesCount: 0,
    candidates: [],
    snrDb: 0,
    processingTimeMs: 0,
    modeUsed: 'classical_cv',
  };

  public currentTelemetry: FrameTelemetry = {
    timestamp: 0,
    frameNumber: 0,
    status: 'SEARCHING',
    groundTruthScreen: { x: 640, y: 360, inFov: true },
    detectedScreen: null,
    predictedScreen: null,
    pixelError: 0,
    angularErrorDeg: 0,
    angularErrorMrad: 0,
    cameraPanDeg: 0,
    cameraTiltDeg: 0,
    targetPanDeg: 0,
    targetTiltDeg: 0,
    isLocked: false,
    fps: 60,
    processingTimeMs: 0,
    mechanicalPanErrorDeg: 0,
    mechanicalTiltErrorDeg: 0,
    mechanicalPointingErrorDeg: 0,
    instantaneousOpticalErrorDeg: 0,
    filteredOpticalErrorDeg: 0,
    lockEvaluationErrorDeg: 0,
    lockEvaluationMode: 'optical-instantaneous',
    feedforwardPanRateDegPerSec: 0,
    feedforwardTiltRateDegPerSec: 0,
  };

  constructor(seed: number = 42) {
    this.currentSeed = seed;
    this.prng = new SeededPRNG(seed);

    this.cameraConfig = {
      width: 1280,
      height: 720,
      fovXDeg: 50.0,
      fovYDeg: 30.0,
      maxPanRateDegPerSec: 35.0,
      maxTiltRateDegPerSec: 25.0,
      panMinDeg: -90,
      panMaxDeg: 90,
      tiltMinDeg: -45,
      tiltMaxDeg: 45,
    };

    this.targetConfig = {
      trajectory: 'circular',
      speed: 1.0,
      radiusDeg: 12.0,
      altitudeDeg: 0.0,
      multiTargetClutter: false,
      beaconWavelengthNm: 850,
    };

    this.disturbanceConfig = {
      sensorNoisePercent: 8,
      platformVibrationDeg: 0.25,
      vibrationFrequencyHz: 18,
      turbulencePercent: 12,
      opticalBlurPx: 2.0,
      atmosphericFogPercent: 5,
      manualOcclusion: false,
    };

    this.pidGains = {
      kp: 2.8,
      ki: 0.35,
      kd: 0.45,
      feedforward: true,
      kff: 0.75,
      integralClamp: 15.0,
      deadbandPx: 1.2,
    };

    this.perceptionMode = 'kalman_predictive';

    this.cameraState = {
      panDeg: 0,
      tiltDeg: 0,
      panVelDegPerSec: 0,
      tiltVelDegPerSec: 0,
      jitterPanDeg: 0,
      jitterTiltDeg: 0,
    };

    this.targetState = {
      panDeg: 10,
      tiltDeg: 5,
      velPanDegPerSec: 0,
      velTiltDegPerSec: 0,
      intensity: 1.0,
      isOccluded: false,
      decoys: [],
    };

    this.kalmanFilter = new BeaconKalmanFilter(25.0, 4.0);
    this.gimbalController = new PATGimbalController();

    // Physical sensor array (160x90 intensity grid)
    this.sensorFrame = new SensorFrame({
      sensorWidth: 160,
      sensorHeight: 90,
      fullWidth: this.cameraConfig.width,
      fullHeight: this.cameraConfig.height,
    });
    this.classicalDetector = new ClassicalCVDetector();
    this.neuralDetector = new NeuralBeaconDetector();

    this.initDecoys();
    this.updateTargetTrajectory(0.016);
  }

  public setSeed(seed: number): void {
    this.currentSeed = seed;
    this.prng.setSeed(seed);
  }

  private initDecoys(): void {
    this.targetState.decoys = [
      { id: 'glint-1', panDeg: 14, tiltDeg: -8, intensity: 0.75, isTrueBeacon: false, glintPhase: 0 },
      { id: 'decoy-2', panDeg: -8, tiltDeg: 14, intensity: 0.55, isTrueBeacon: false, glintPhase: 2.1 },
      { id: 'glint-3', panDeg: 4, tiltDeg: -10, intensity: 0.85, isTrueBeacon: false, glintPhase: 4.3 },
    ];
  }

  public resetSimulation(seed?: number): void {
    if (seed !== undefined) {
      this.currentSeed = seed;
    }
    this.prng.setSeed(this.currentSeed);

    this.simTimeSec = 0;
    this.frameCount = 0;
    this.cameraState = {
      panDeg: 0,
      tiltDeg: 0,
      panVelDegPerSec: 0,
      tiltVelDegPerSec: 0,
      jitterPanDeg: 0,
      jitterTiltDeg: 0,
    };
    this.kalmanFilter.reset();
    this.gimbalController.reset();

    this.timeToFirstLockSec = null;
    this.acquisitionTimeSec = null;
    this.totalFrames = 0;
    this.lockedFrames = 0;
    this.lockRetentionFrames = 0;
    this.lockLossCount = 0;
    this.falseLockFrames = 0;
    this.fovFrames = 0;
    this.detectedInFovFrames = 0;
    this.sumSquaredAngularError = 0;
    this.sumAngularError = 0;
    this.maxAngularErrorDeg = 0;
    this.lastLockLostTime = null;
    this.reacquisitionTimes = [];

    this.telemetryHistory = [];
    this.previousStatus = 'SEARCHING';
    this.lockPersistenceCount = 0;
    this.coastDurationSec = 0;
    this.reacquireCooldownFrames = 0;
    this.targetPhase = 0;
    this.filteredOpticalErrorDeg = 0;

    this.initDecoys();
    this.updateTargetTrajectory(0.016);
  }

  /**
   * Main step function called on every animation or simulation step.
   * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
   */
  public step(dt: number): void {
    if (!this.isRunning) return;

    const dtClamped = Math.min(Math.max(dt, 0.001), 0.05);
    this.simTimeSec += dtClamped;
    this.frameCount++;
    const startTime = performance.now();

    // 1. Update Target World Trajectory
    this.updateTargetTrajectory(dtClamped);

    // 2. Compute Platform Vibration & Disturbance
    this.updateDisturbances(dtClamped);

    // 3. Project Target onto Virtual Camera Sensor Plane (for photon rendering & ground truth scoring)
    const groundTruth = this.projectWorldToScreen(
      this.targetState.panDeg,
      this.targetState.tiltDeg
    );

    // Track beacon FOV presence for detection rate calculation
    if (groundTruth.inFov && !this.targetState.isOccluded) {
      this.fovFrames++;
    }

    // 4. Render Physical Sensor Frame (intensity buffer)
    // Decoy screen projections
    const decoyEmitters = this.targetConfig.multiTargetClutter
      ? this.targetState.decoys.map((d) => {
          const dScreen = this.projectWorldToScreen(d.panDeg, d.tiltDeg);
          return {
            id: d.id,
            screenX: dScreen.x,
            screenY: dScreen.y,
            intensity: d.intensity,
            inFov: dScreen.inFov,
            modulationFrequencyHz: d.id.startsWith('decoy') ? 12 : 0, // False decoy vs unmodulated glint
          };
        })
      : [];

    this.sensorFrame.renderScene(
      {
        screenX: groundTruth.x,
        screenY: groundTruth.y,
        intensity: this.targetState.intensity,
        inFov: groundTruth.inFov,
        isOccluded: this.targetState.isOccluded,
        modulationFrequencyHz: 50, // 50 Hz true optical beacon modulation
      },
      decoyEmitters,
      this.disturbanceConfig.sensorNoisePercent,
      this.disturbanceConfig.opticalBlurPx,
      this.disturbanceConfig.turbulencePercent,
      this.disturbanceConfig.atmosphericFogPercent,
      this.simTimeSec,
      this.prng
    );

    // 5. Run Perception Pipeline on the Sensor Frame
    // (Operates purely on sensor intensity buffer without ground truth coordinates)
    let detection: DetectionResult;
    if (this.perceptionMode === 'classical_cv') {
      detection = this.classicalDetector.detect(this.sensorFrame);
    } else {
      // Both 'ai_neural' and 'kalman_predictive' utilize the Neural Beacon Detector
      detection = this.neuralDetector.detect(this.sensorFrame);
      if (this.perceptionMode === 'kalman_predictive') {
        detection.modeUsed = 'kalman_predictive';
      }
    }
    this.currentDetection = detection;

    if (detection.detected && groundTruth.inFov && !this.targetState.isOccluded) {
      this.detectedInFovFrames++;
    }

    // 6. Kalman Filter Prediction & Measurement Update
    this.kalmanFilter.predict(dtClamped);

    let controlPoint: { x: number; y: number } | null = null;
    let trackingStatus: TrackingStatus = 'SEARCHING';

    const useKalman = this.perceptionMode === 'kalman_predictive';

    if (detection.detected && detection.centroid) {
      if (useKalman) {
        this.kalmanFilter.update(detection.centroid.x, detection.centroid.y);
        // Lookahead prediction (20ms) to compensate for sensor and gimbal actuator latency
        controlPoint = this.kalmanFilter.predictAhead(0.02);
      } else {
        controlPoint = detection.centroid;
      }

      // Check recovery from COASTING or acquisition transition
      if (this.previousStatus === 'COASTING') {
        trackingStatus = 'REACQUIRING';
        this.reacquireCooldownFrames = 8;
        if (this.lastLockLostTime !== null) {
          const reacquireDuration = this.simTimeSec - this.lastLockLostTime;
          this.reacquisitionTimes.push(reacquireDuration);
          this.lastLockLostTime = null;
        }
      } else if (this.reacquireCooldownFrames > 0) {
        this.reacquireCooldownFrames--;
        trackingStatus = 'REACQUIRING';
      } else if (this.previousStatus === 'SEARCHING' || this.previousStatus === 'LOST') {
        trackingStatus = 'ACQUIRING';
      } else {
        trackingStatus = 'TRACKING';
      }
      this.coastDurationSec = 0;
    } else {
      // Detection lost (dropout, occlusion, low SNR, or target out of FOV)
      if (useKalman && this.kalmanFilter.getState().isInitialized && this.coastDurationSec < 2.0) {
        this.coastDurationSec += dtClamped;
        this.kalmanFilter.coast();
        const kState = this.kalmanFilter.getState();
        controlPoint = { x: kState.x, y: kState.y };
        trackingStatus = 'COASTING';
      } else {
        trackingStatus = groundTruth.inFov ? 'SEARCHING' : 'LOST';
        this.coastDurationSec = 0;
        this.reacquireCooldownFrames = 0;
        if (this.previousStatus === 'COASTING') {
          this.kalmanFilter.reset();
        }
      }
    }

    // 7. Closed-Loop Gimbal Controller (PID + Feedforward)
    const halfW = this.cameraConfig.width / 2;
    const halfH = this.cameraConfig.height / 2;

    let ffPanRate = 0;
    let ffTiltRate = 0;

    if (controlPoint) {
      const angularErrors = this.gimbalController.pixelToAngularError(
        controlPoint.x,
        controlPoint.y,
        this.cameraConfig
      );

      // Kalman feedforward target velocity rate
      // kState.vx and kState.vy represent relative screen motion in pixels/sec.
      // Convert to apparent angular rates (deg/s):
      const kState = this.kalmanFilter.getState();
      const screenPanRate = (kState.vx / halfW) * (this.cameraConfig.fovXDeg / 2);
      const screenTiltRate = (kState.vy / halfH) * (this.cameraConfig.fovYDeg / 2);

      // Reconstruct inertial target angular velocity:
      // Inertial target velocity = camera angular velocity + relative screen motion rate
      ffPanRate = this.cameraState.panVelDegPerSec + screenPanRate;
      ffTiltRate = this.cameraState.tiltVelDegPerSec + screenTiltRate;

      // Compute actuator rate commands
      const cmd = this.gimbalController.computeCommand(
        angularErrors.errorPanDeg,
        angularErrors.errorTiltDeg,
        ffPanRate,
        ffTiltRate,
        dtClamped,
        this.pidGains,
        this.cameraConfig
      );

      // Apply rate-limited kinematics and physical travel stops.
      this.integrateCameraKinematics(cmd.cmdPanRateDegPerSec, cmd.cmdTiltRateDegPerSec, dtClamped);
    } else {
      // In SEARCHING/LOST mode: decay velocity gracefully
      this.integrateCameraKinematics(
        this.cameraState.panVelDegPerSec * 0.92,
        this.cameraState.tiltVelDegPerSec * 0.92,
        dtClamped
      );
    }

    // 8. Ground-Truth Error Calculations (Mechanical Boresight and Instantaneous Optical Error)
    // Mechanical boresight error: gimbal orientation vs target ground-truth (pure mechanical alignment, excluding vibration jitter)
    const mechanicalPanError = this.targetState.panDeg - this.cameraState.panDeg;
    const mechanicalTiltError = this.targetState.tiltDeg - this.cameraState.tiltDeg;
    const mechanicalPointingErrorDeg = Math.sqrt(
      mechanicalPanError * mechanicalPanError + mechanicalTiltError * mechanicalTiltError
    );

    // Instantaneous optical error: line-of-sight including high-frequency platform vibration jitter
    const camPanEff = this.cameraState.panDeg + this.cameraState.jitterPanDeg;
    const camTiltEff = this.cameraState.tiltDeg + this.cameraState.jitterTiltDeg;
    const deltaPan = this.targetState.panDeg - camPanEff;
    const deltaTilt = this.targetState.tiltDeg - camTiltEff;
    const trueAngularErrorDeg = Math.sqrt(deltaPan * deltaPan + deltaTilt * deltaTilt);

    // EWMA filtered optical error: attenuates high-frequency platform vibration jitter
    // tau is filterTimeConstantSec (default 0.05s)
    const tau = Math.max(0.001, this.filterTimeConstantSec);
    const alphaEwma = dtClamped / (tau + dtClamped);
    if (this.frameCount <= 1 || this.filteredOpticalErrorDeg === 0) {
      this.filteredOpticalErrorDeg = trueAngularErrorDeg;
    } else {
      this.filteredOpticalErrorDeg =
        (1 - alphaEwma) * this.filteredOpticalErrorDeg + alphaEwma * trueAngularErrorDeg;
    }

    // Select error metric for coarse-lock candidate evaluation based on lockEvaluationMode
    let lockEvaluationErrorDeg: number;
    switch (this.lockEvaluationMode) {
      case 'mechanical-boresight':
        lockEvaluationErrorDeg = mechanicalPointingErrorDeg;
        break;
      case 'filtered-optical':
        lockEvaluationErrorDeg = this.filteredOpticalErrorDeg;
        break;
      case 'optical-instantaneous':
      default:
        lockEvaluationErrorDeg = trueAngularErrorDeg;
        break;
    }

    // Pixel error from camera center (W/2, H/2)
    const fx = halfW / Math.tan((this.cameraConfig.fovXDeg * Math.PI) / 360);
    const fy = halfH / Math.tan((this.cameraConfig.fovYDeg * Math.PI) / 360);
    const pixelErrorX = fx * Math.tan((deltaPan * Math.PI) / 180);
    const pixelErrorY = fy * Math.tan((deltaTilt * Math.PI) / 180);
    const truePixelError = Math.sqrt(pixelErrorX * pixelErrorX + pixelErrorY * pixelErrorY);

    // 9. Finite-State Machine Lock Verification:
    // Lock Criteria (Section 9):
    // 1. Target physically within camera FOV
    // 2. Target not occluded
    // 3. Active detection with confidence >= 0.70
    // 4. Selected lock error below the configured threshold (< 0.22° / ~3.84 mrad)
    // 5. Temporal persistence sustained for >= 8 consecutive frames (~130ms)
    const lockCandidate =
      groundTruth.inFov &&
      !this.targetState.isOccluded &&
      detection.detected &&
      lockEvaluationErrorDeg < 0.22 &&
      detection.confidence >= 0.70;

    if (lockCandidate) {
      this.lockPersistenceCount++;
      if (this.lockPersistenceCount >= 8) {
        trackingStatus = 'LOCKED';
      }
    } else {
      this.lockPersistenceCount = Math.max(0, this.lockPersistenceCount - 2);
    }

    // A lock should not be dropped by one noisy or missed measurement. Keep
    // the FSM locked while its persistence budget is still positive, including
    // when a target reappears before the counter has fully recovered. Four
    // consecutive invalid frames drain a fully established lock (8 -> 0).
    if (this.previousStatus === 'LOCKED' && this.lockPersistenceCount > 0) {
      trackingStatus = 'LOCKED';
    }

    const isLocked = trackingStatus === 'LOCKED';

    // Check for False Lock (e.g. locked onto a decoy instead of the true beacon)
    let isFalseLock = false;
    if (isLocked && detection.centroid) {
      const distToTrueBeacon = Math.sqrt(
        (detection.centroid.x - groundTruth.x) ** 2 +
        (detection.centroid.y - groundTruth.y) ** 2
      );
      if (distToTrueBeacon > 40) {
        isFalseLock = true;
        this.falseLockFrames++;
      }
    }

    // Track lock transitions and losses
    if (this.previousStatus === 'LOCKED' && !isLocked) {
      this.lockLossCount++;
      this.lastLockLostTime = this.simTimeSec;
    }

    this.previousStatus = trackingStatus;

    // 10. Update Telemetry & Metrics
    this.totalFrames++;
    if (isLocked) {
      this.lockedFrames++;
      if (this.timeToFirstLockSec === null) {
        this.timeToFirstLockSec = Number(this.simTimeSec.toFixed(3));
        this.acquisitionTimeSec = this.timeToFirstLockSec;
      }
    }
    // Retention starts when a lock has actually been acquired. Acquisition
    // frames must not dilute the percentage shown to the operator.
    if (this.timeToFirstLockSec !== null) {
      this.lockRetentionFrames++;
    }

    this.sumAngularError += trueAngularErrorDeg;
    this.sumSquaredAngularError += trueAngularErrorDeg * trueAngularErrorDeg;
    if (trueAngularErrorDeg > this.maxAngularErrorDeg) {
      this.maxAngularErrorDeg = trueAngularErrorDeg;
    }

    const processingDurationMs = performance.now() - startTime;
    const kState = this.kalmanFilter.getState();

    let estPanDeg: number | undefined;
    let estTiltDeg: number | undefined;
    if (kState.isInitialized) {
      estPanDeg = camPanEff + Math.atan((kState.x - halfW) / fx) * (180 / Math.PI);
      estTiltDeg = camTiltEff + Math.atan((kState.y - halfH) / fy) * (180 / Math.PI);
    }

    const telemetry: FrameTelemetry = {
      timestamp: this.simTimeSec,
      frameNumber: this.frameCount,
      status: trackingStatus,
      groundTruthScreen: groundTruth,
      detectedScreen: detection.centroid,
      predictedScreen: kState.isInitialized ? { x: kState.x, y: kState.y } : null,
      pixelError: Number(truePixelError.toFixed(2)),
      angularErrorDeg: Number(trueAngularErrorDeg.toFixed(3)),
      angularErrorMrad: Number((trueAngularErrorDeg * 17.4533).toFixed(2)),
      cameraPanDeg: this.cameraState.panDeg,
      cameraTiltDeg: this.cameraState.tiltDeg,
      targetPanDeg: this.targetState.panDeg,
      targetTiltDeg: this.targetState.tiltDeg,
      isLocked,
      fps: dtClamped > 0 ? Math.round(1 / dtClamped) : 60,
      processingTimeMs: Number((detection.processingTimeMs + processingDurationMs).toFixed(2)),
      panErrorDeg: Number(deltaPan.toFixed(3)),
      tiltErrorDeg: Number(deltaTilt.toFixed(3)),
      estimatedPanDeg: estPanDeg !== undefined ? Number(estPanDeg.toFixed(3)) : undefined,
      estimatedTiltDeg: estTiltDeg !== undefined ? Number(estTiltDeg.toFixed(3)) : undefined,
      panPidOutput: Number(this.gimbalController.lastTerms.totalPan.toFixed(3)),
      tiltPidOutput: Number(this.gimbalController.lastTerms.totalTilt.toFixed(3)),
      detectionConfidence: Number(detection.confidence.toFixed(3)),
      snrDb: Number(detection.snrDb.toFixed(2)),
      signalStrength: Number(this.targetState.intensity.toFixed(3)),
      beaconVisible: groundTruth.inFov && !this.targetState.isOccluded,
      mechanicalPanErrorDeg: Number(mechanicalPanError.toFixed(3)),
      mechanicalTiltErrorDeg: Number(mechanicalTiltError.toFixed(3)),
      mechanicalPointingErrorDeg: Number(mechanicalPointingErrorDeg.toFixed(3)),
      instantaneousOpticalErrorDeg: Number(trueAngularErrorDeg.toFixed(3)),
      filteredOpticalErrorDeg: Number(this.filteredOpticalErrorDeg.toFixed(3)),
      lockEvaluationErrorDeg: Number(lockEvaluationErrorDeg.toFixed(3)),
      lockEvaluationMode: this.lockEvaluationMode,
      feedforwardPanRateDegPerSec: Number(ffPanRate.toFixed(3)),
      feedforwardTiltRateDegPerSec: Number(ffTiltRate.toFixed(3)),
    };

    this.currentTelemetry = telemetry;

    // Maintain history ring-buffer for graphs
    this.telemetryHistory.push(telemetry);
    if (this.telemetryHistory.length > this.maxHistoryLength) {
      this.telemetryHistory.shift();
    }
  }

  /**
   * Dynamically sets beacon velocity multiplier with safe clamping.
   */
  public setBeaconSpeed(speed: number): void {
    const clamped = Math.max(0.1, Math.min(5.0, Number(speed) || 1.0));
    this.targetConfig.speed = Math.round(clamped * 10) / 10;
  }

  /** Apply a symmetric physical pan stop immediately, including after UI edits. */
  public setPanTravelLimit(limitDeg: number): void {
    const limit = Math.max(1, Math.min(180, Number(limitDeg) || 90));
    this.cameraConfig.panMinDeg = -limit;
    this.cameraConfig.panMaxDeg = limit;
    this.cameraState.panDeg = Math.max(-limit, Math.min(limit, this.cameraState.panDeg));
    if (
      (this.cameraState.panDeg === limit && this.cameraState.panVelDegPerSec > 0) ||
      (this.cameraState.panDeg === -limit && this.cameraState.panVelDegPerSec < 0)
    ) {
      this.cameraState.panVelDegPerSec = 0;
    }
  }

  /** Set the physical pan actuator's maximum angular slew rate. */
  public setMaxPanSlewRate(rateDegPerSec: number): void {
    this.cameraConfig.maxPanRateDegPerSec = Math.max(1, Math.min(180, Number(rateDegPerSec) || 35));
  }

  /** Integrate motion against hard stops and record the physically achieved rate. */
  private integrateCameraKinematics(panRateDegPerSec: number, tiltRateDegPerSec: number, dt: number): void {
    const previousPan = this.cameraState.panDeg;
    const previousTilt = this.cameraState.tiltDeg;
    this.cameraState.panDeg = Math.max(
      this.cameraConfig.panMinDeg,
      Math.min(this.cameraConfig.panMaxDeg, previousPan + panRateDegPerSec * dt)
    );
    this.cameraState.tiltDeg = Math.max(
      this.cameraConfig.tiltMinDeg,
      Math.min(this.cameraConfig.tiltMaxDeg, previousTilt + tiltRateDegPerSec * dt)
    );
    this.cameraState.panVelDegPerSec = (this.cameraState.panDeg - previousPan) / dt;
    this.cameraState.tiltVelDegPerSec = (this.cameraState.tiltDeg - previousTilt) / dt;
  }

  /**
   * Updates target position in space along selected trajectory.
   */
  private updateTargetTrajectory(dt: number): void {
    // Continuous phase integration ensures smooth trajectories when speed changes dynamically
    this.targetPhase += dt * this.targetConfig.speed;
    const t = this.targetPhase;
    const spd = this.targetConfig.speed;
    const r = this.targetConfig.radiusDeg;
    const alt = this.targetConfig.altitudeDeg;

    let targetPan = 0;
    let targetTilt = 0;
    let velPan = 0;
    let velTilt = 0;

    switch (this.targetConfig.trajectory) {
      case 'circular': {
        const omega = 0.55;
        targetPan = r * Math.cos(omega * t);
        targetTilt = alt + (r * 0.55) * Math.sin(omega * t);
        velPan = -r * omega * Math.sin(omega * t) * spd;
        velTilt = (r * 0.55) * omega * Math.cos(omega * t) * spd;
        break;
      }
      case 'sinusoidal': {
        const freq = 0.4;
        targetPan = 22 * Math.sin(freq * t);
        targetTilt = alt + 8 * Math.sin(freq * 2.1 * t + 0.5);
        velPan = 22 * freq * Math.cos(freq * t) * spd;
        velTilt = 8 * freq * 2.1 * Math.cos(freq * 2.1 * t + 0.5) * spd;
        break;
      }
      case 'figure8': {
        const w = 0.45;
        targetPan = r * 1.3 * Math.sin(w * t);
        targetTilt = alt + (r * 0.7) * Math.sin(2 * w * t);
        velPan = r * 1.3 * w * Math.cos(w * t) * spd;
        velTilt = r * 0.7 * 2 * w * Math.cos(2 * w * t) * spd;
        break;
      }
      case 'linear': {
        const period = 12.0;
        const phase = (t % period) / period;
        const sweep = 40.0;
        targetPan = -sweep / 2 + sweep * (phase < 0.5 ? phase * 2 : (1 - phase) * 2);
        targetTilt = alt + 4 * Math.sin(t * 0.8);
        velPan = (phase < 0.5 ? (sweep * 2) / period : -(sweep * 2) / period) * spd;
        velTilt = 4 * 0.8 * Math.cos(t * 0.8) * spd;
        break;
      }
      case 'stochastic': {
        // Multi-frequency smooth pseudorandom trajectory
        targetPan = 14 * Math.sin(0.3 * t) + 8 * Math.sin(0.77 * t + 1.2) + 3 * Math.sin(1.8 * t);
        targetTilt = alt + 6 * Math.cos(0.25 * t) + 4 * Math.sin(0.65 * t + 2.0);
        velPan = (14 * 0.3 * Math.cos(0.3 * t) + 8 * 0.77 * Math.cos(0.77 * t + 1.2)) * spd;
        velTilt = (-6 * 0.25 * Math.sin(0.25 * t) + 4 * 0.65 * Math.cos(0.65 * t + 2.0)) * spd;
        break;
      }
      case 'evasive': {
        const cycle = t % 6.0;
        if (cycle < 2.0) {
          targetPan = 18 * Math.sin(1.2 * t);
          targetTilt = alt + 10 * Math.cos(1.5 * t);
        } else if (cycle < 4.0) {
          targetPan = -15 + 30 * ((cycle - 2.0) / 2.0);
          targetTilt = alt - 12 + 24 * Math.sin(3.0 * t);
        } else {
          targetPan = 12 * Math.cos(2.2 * t);
          targetTilt = alt + 8 * Math.sin(1.8 * t);
        }
        velPan = (targetPan - this.targetState.panDeg) / Math.max(dt, 0.001);
        velTilt = (targetTilt - this.targetState.tiltDeg) / Math.max(dt, 0.001);
        break;
      }
    }

    this.targetState.panDeg = targetPan;
    this.targetState.tiltDeg = targetTilt;
    this.targetState.velPanDegPerSec = velPan;
    this.targetState.velTiltDegPerSec = velTilt;

    // Atmospheric Scintillation & Intensity fluctuations
    const turbFactor = this.disturbanceConfig.turbulencePercent / 100;
    const scintillation = 1.0 - turbFactor * (0.35 * Math.sin(18 * t) + 0.25 * Math.cos(31 * t));
    this.targetState.intensity = Math.max(0.05, Math.min(1.0, scintillation));

    // Decoy positions update
    if (this.targetConfig.multiTargetClutter) {
      this.targetState.decoys.forEach((decoy) => {
        decoy.panDeg = targetPan + 7 * Math.sin(0.6 * t + decoy.glintPhase);
        decoy.tiltDeg = targetTilt + 5 * Math.cos(0.4 * t + decoy.glintPhase * 2);
        decoy.intensity = 0.55 + 0.4 * Math.sin(3 * t + decoy.glintPhase);
      });
    }

    // Manual or scheduled occlusion
    this.targetState.isOccluded = this.disturbanceConfig.manualOcclusion;
  }

  /**
   * Computes platform jitter and atmospheric disturbance vectors.
   */
  private updateDisturbances(dt: number): void {
    const t = this.simTimeSec;
    const vibAmp = this.disturbanceConfig.platformVibrationDeg;
    const freq = this.disturbanceConfig.vibrationFrequencyHz;

    // Platform multi-harmonic vibration (UAV motor RPM + airframe resonance)
    const jitterP = vibAmp * (Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * (freq * 2.4) * t + 0.8));
    const jitterT = vibAmp * (Math.cos(2 * Math.PI * freq * t + 0.4) + 0.35 * Math.cos(2 * Math.PI * (freq * 1.8) * t));

    this.cameraState.jitterPanDeg = jitterP;
    this.cameraState.jitterTiltDeg = jitterT;
  }

  /**
   * Projects 3D world angular coordinates (pan, tilt) to camera image plane pixel coordinates.
   */
  public projectWorldToScreen(
    worldPanDeg: number,
    worldTiltDeg: number
  ): { x: number; y: number; inFov: boolean } {
    // Net camera orientation including gimbal + platform vibration jitter
    const camPanEff = this.cameraState.panDeg + this.cameraState.jitterPanDeg;
    const camTiltEff = this.cameraState.tiltDeg + this.cameraState.jitterTiltDeg;

    // Relative angles
    const deltaPan = worldPanDeg - camPanEff;
    const deltaTilt = worldTiltDeg - camTiltEff;

    const halfW = this.cameraConfig.width / 2;
    const halfH = this.cameraConfig.height / 2;

    const fx = halfW / Math.tan((this.cameraConfig.fovXDeg * Math.PI) / 360);
    const fy = halfH / Math.tan((this.cameraConfig.fovYDeg * Math.PI) / 360);

    const screenX = halfW + fx * Math.tan((deltaPan * Math.PI) / 180);
    const screenY = halfH + fy * Math.tan((deltaTilt * Math.PI) / 180);

    // Turbulence beam wander: slight jitter in apparent optical centroid
    const wanderPx = (this.disturbanceConfig.turbulencePercent / 100) * 3.5;
    const wanderX = wanderPx * Math.sin(25 * this.simTimeSec);
    const wanderY = wanderPx * Math.cos(33 * this.simTimeSec);

    const finalX = screenX + wanderX;
    const finalY = screenY + wanderY;

    const inFov =
      finalX >= 0 &&
      finalX <= this.cameraConfig.width &&
      finalY >= 0 &&
      finalY <= this.cameraConfig.height &&
      Math.abs(deltaPan) <= this.cameraConfig.fovXDeg / 2 &&
      Math.abs(deltaTilt) <= this.cameraConfig.fovYDeg / 2;

    return { x: finalX, y: finalY, inFov };
  }

  /**
   * Aggregated performance statistics for evaluation and reporting.
   */
  public getPerformanceStats(): PerformanceStats {
    const lockRetention =
      this.lockRetentionFrames > 0 ? (this.lockedFrames / this.lockRetentionFrames) * 100 : 0;
    const meanError = this.totalFrames > 0 ? this.sumAngularError / this.totalFrames : 0;
    const rmsError = this.totalFrames > 0 ? Math.sqrt(this.sumSquaredAngularError / this.totalFrames) : 0;

    const avgReacquisitionSec =
      this.reacquisitionTimes.length > 0
        ? Number((this.reacquisitionTimes.reduce((a, b) => a + b, 0) / this.reacquisitionTimes.length).toFixed(3))
        : null;

    const falseLockRate =
      this.lockedFrames > 0 ? Number(((this.falseLockFrames / this.lockedFrames) * 100).toFixed(1)) : 0;

    const detectionRate =
      this.fovFrames > 0 ? Number(((this.detectedInFovFrames / this.fovFrames) * 100).toFixed(1)) : 0;

    return {
      acquisitionTimeSec: this.timeToFirstLockSec,
      timeToFirstLockSec: this.timeToFirstLockSec,
      acquisitionSuccessRate: this.timeToFirstLockSec !== null ? 100 : 0,
      totalFrames: this.totalFrames,
      lockedFrames: this.lockedFrames,
      lockRetentionRate: Number(lockRetention.toFixed(1)),
      lockLossCount: this.lockLossCount,
      reacquisitionTimeSec: avgReacquisitionSec,
      falseLockRate,
      detectionRate,
      currentPixelError: Number(this.currentTelemetry.pixelError.toFixed(2)),
      currentAngularErrorDeg: Number(this.currentTelemetry.angularErrorDeg.toFixed(3)),
      currentAngularErrorMrad: Number(this.currentTelemetry.angularErrorMrad.toFixed(2)),
      meanAngularErrorDeg: Number(meanError.toFixed(3)),
      meanAngularErrorMrad: Number((meanError * 17.4533).toFixed(2)),
      rmsAngularErrorDeg: Number(rmsError.toFixed(3)),
      rmsAngularErrorMrad: Number((rmsError * 17.4533).toFixed(2)),
      maxAngularErrorDeg: Number(this.maxAngularErrorDeg.toFixed(3)),
      averageFps: this.currentTelemetry.fps,
      averageLatencyMs: this.currentTelemetry.processingTimeMs,
      opticalLinkAvailability: Number(lockRetention.toFixed(1)),
    };
  }
}
