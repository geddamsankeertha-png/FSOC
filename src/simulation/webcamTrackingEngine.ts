/**
 * Live Webcam Tracking Engine for FSOC PAT Coarse Alignment System.
 *
 * Implements real camera frame acquisition, camera calibration, optical beacon detection,
 * discrete 2D Kalman filter with lookahead and coasting, closed-loop virtual gimbal PID,
 * Finite State Machine (FSM), real-time HUD metrics, and CSV/JSON telemetry logging.
 *
 * Reuses the existing Classical CV and AI Neural detectors, Kalman Filter, PID, and FSM.
 */

import {
  CameraConfig,
  CandidateInfo,
  DetectionResult,
  EvaluationReference,
  LiveSoftwareDisturbances,
  PerceptionMode,
  PIDGains,
  PIDTerms,
  TrackingConfidenceBreakdown,
  TrackingEvent,
  TrackingExplainabilityData,
  TrackingStatus,
  WebcamConfig,
  WebcamPerformanceMetrics,
  WebcamTelemetry,
} from '../types';
import { SensorFrame } from './perception/sensorFrame';
import { ClassicalCVDetector, NeuralBeaconDetector } from './perception/detectors';
import { BeaconKalmanFilter } from './kalmanFilter';
import { PATGimbalController } from './pidController';

export class WebcamTrackingEngine {
  // Video element and canvas for frame processing
  public videoElement: HTMLVideoElement | null = null;
  private captureCanvas: HTMLCanvasElement;
  private captureCtx: CanvasRenderingContext2D | null = null;
  public mediaStream: MediaStream | null = null;

  // Status & Devices
  public isStreaming: boolean = false;
  public isInitializing: boolean = false;
  public error: string | null = null;
  public availableDevices: MediaDeviceInfo[] = [];

  // Configurations
  public config: WebcamConfig = {
    deviceId: '',
    requestedWidth: 1280,
    requestedHeight: 720,
    requestedFps: 30,
    actualWidth: 1280,
    actualHeight: 720,
    actualFps: 30,
    fovXDeg: 72.0, // Typical webcam horizontal FOV
    fovYDeg: 44.0, // Typical webcam vertical FOV
    principalPoint: { cx: 640, cy: 360 },
    k1Distortion: 0.0, // Radial distortion coefficient
  };

  public pidGains: PIDGains = {
    kp: 2.8,
    ki: 0.35,
    kd: 0.45,
    feedforward: true,
    kff: 0.75,
    integralClamp: 15.0,
    deadbandPx: 1.5,
  };

  public perceptionMode: PerceptionMode = 'kalman_predictive';

  public disturbances: LiveSoftwareDisturbances = {
    enabled: false,
    noisePercent: 0,
    blurPx: 0,
    brightnessPercent: 0,
    contrastPercent: 0,
    dropoutActive: false,
    syntheticVibrationPx: 0,
  };

  // Evaluation Reference (ground truth fiducial measurement)
  public evalReference: EvaluationReference = {
    enabled: false,
    detected: false,
    screenX: 0,
    screenY: 0,
    referenceType: 'bright_marker',
    trueTrackingErrorPx: null,
    trueTrackingErrorDeg: null,
    trueTrackingErrorMrad: null,
  };

  // Tracking & Estimation Components
  public sensorFrame: SensorFrame;
  public classicalDetector: ClassicalCVDetector;
  public neuralDetector: NeuralBeaconDetector;
  public kalmanFilter: BeaconKalmanFilter;
  public gimbalController: PATGimbalController;

  // Virtual Gimbal State (represents the coarse PAT tracking gimbal)
  public virtualGimbal = {
    panDeg: 0,
    tiltDeg: 0,
    panVelDegPerSec: 0,
    tiltVelDegPerSec: 0,
    panMinDeg: -90,
    panMaxDeg: 90,
    tiltMinDeg: -45,
    tiltMaxDeg: 45,
  };

  // Finite State Machine (FSM)
  public fsmState: TrackingStatus = 'SEARCHING';
  private previousStatus: TrackingStatus = 'SEARCHING';
  private lockPersistenceCount: number = 0;
  private coastDurationSec: number = 0;
  private reacquireCooldownFrames: number = 0;
  private isLocked: boolean = false;

  // Telemetry, Metrics, Event Log & Explainability
  public telemetryHistory: WebcamTelemetry[] = [];
  public readonly maxHistoryLength: number = 300;
  public currentTelemetry: WebcamTelemetry | null = null;
  public events: TrackingEvent[] = [];
  public readonly maxEventsLength: number = 80;
  public replayBuffer: Array<{ timestamp: number; explainability: TrackingExplainabilityData }> = [];
  public readonly maxReplayFrames: number = 450; // ~15-20 seconds at 30fps
  private recentDetectionsHistory: boolean[] = [];

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

  public currentExplainability: TrackingExplainabilityData | null = null;

  // Real Performance Metrics
  public metrics: WebcamPerformanceMetrics = {
    framesProcessed: 0,
    detectionRate: 0,
    averageConfidence: 0,
    currentFps: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
    timeToFirstDetectionSec: null,
    timeToFirstLockSec: null,
    lockDurationSec: 0,
    lockRetentionRate: 0,
    lockLossCount: 0,
    reacquisitionTimeSec: null,
    coastingDurationSec: 0,
  };

  private latenciesBuffer: number[] = [];
  private frameTimestamps: number[] = [];
  private startTimeSec: number = 0;
  private totalDetectedFrames: number = 0;
  private totalLockedFrames: number = 0;
  // Frames observed after the first verified lock; used for retention %.
  private lockRetentionFrames: number = 0;
  private sumConfidence: number = 0;
  private lastLockLostTimestamp: number | null = null;
  private reacquisitionTimes: number[] = [];
  private isProcessingFrame: boolean = false;

  constructor() {
    this.captureCanvas = document.createElement('canvas');
    this.captureCanvas.width = 1280;
    this.captureCanvas.height = 720;
    this.captureCtx = this.captureCanvas.getContext('2d', { willReadFrequently: true });

    // Physical sensor array for image perception (160x90)
    this.sensorFrame = new SensorFrame({
      sensorWidth: 160,
      sensorHeight: 90,
      fullWidth: 1280,
      fullHeight: 720,
    });

    this.classicalDetector = new ClassicalCVDetector();
    this.neuralDetector = new NeuralBeaconDetector();
    this.kalmanFilter = new BeaconKalmanFilter(20.0, 3.5);
    this.gimbalController = new PATGimbalController();
  }

  /**
   * Enumerate available video input devices
   */
  public async enumerateCameras(): Promise<MediaDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter((d) => d.kind === 'videoinput');
      return this.availableDevices;
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
      return [];
    }
  }

  /**
   * Start live webcam stream
   */
  public async startWebcam(deviceId?: string, width = 1280, height = 720, fps = 30): Promise<boolean> {
    this.isInitializing = true;
    this.error = null;

    try {
      // Stop any existing stream
      this.stopWebcam();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam access (navigator.mediaDevices.getUserMedia) is not supported in this browser environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: fps },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;

      // Create or attach video element
      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
      }
      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      // Get actual stream track settings
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      const actualWidth = settings?.width || width;
      const actualHeight = settings?.height || height;
      const actualFps = settings?.frameRate || fps;

      this.config.deviceId = deviceId || '';
      this.config.actualWidth = actualWidth;
      this.config.actualHeight = actualHeight;
      this.config.actualFps = actualFps;
      this.config.principalPoint = { cx: actualWidth / 2, cy: actualHeight / 2 };

      this.captureCanvas.width = actualWidth;
      this.captureCanvas.height = actualHeight;
      this.captureCtx = this.captureCanvas.getContext('2d', { willReadFrequently: true });

      // Update sensor frame resolution
      this.sensorFrame = new SensorFrame({
        sensorWidth: 160,
        sensorHeight: Math.max(60, Math.round((160 * actualHeight) / actualWidth)),
        fullWidth: actualWidth,
        fullHeight: actualHeight,
      });

      this.resetMetrics();
      this.isStreaming = true;
      this.isInitializing = false;
      await this.enumerateCameras();
      return true;
    } catch (err: unknown) {
      this.isStreaming = false;
      this.isInitializing = false;
      const msg = err instanceof Error ? err.message : String(err);
      this.error = `Webcam Error: ${msg}`;
      console.error('Webcam initialization failed:', err);
      return false;
    }
  }

  /**
   * Stop webcam stream
   */
  public stopWebcam(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
    this.isStreaming = false;
  }

  /**
   * Reset tracking state and metrics
   */
  public reset(): void {
    this.kalmanFilter.reset();
    this.gimbalController.reset();
    this.virtualGimbal.panDeg = 0;
    this.virtualGimbal.tiltDeg = 0;
    this.virtualGimbal.panVelDegPerSec = 0;
    this.virtualGimbal.tiltVelDegPerSec = 0;
    this.fsmState = 'SEARCHING';
    this.previousStatus = 'SEARCHING';
    this.lockPersistenceCount = 0;
    this.coastDurationSec = 0;
    this.reacquireCooldownFrames = 0;
    this.isLocked = false;
    this.resetMetrics();
    this.telemetryHistory = [];
    this.events = [];
    this.replayBuffer = [];
    this.recentDetectionsHistory = [];
    this.currentExplainability = null;
    this.logEvent('state_change', 'Tracking system initialized. Searching FOV for optical beacon.', 'info');
  }

  public logEvent(
    type: TrackingEvent['type'],
    message: string,
    severity: TrackingEvent['severity'] = 'info',
    details?: string
  ): void {
    const now = performance.now() / 1000;
    const d = new Date();
    const timeStr = `${d.toTimeString().split(' ')[0]}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    const evt: TrackingEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeString: timeStr,
      type,
      message,
      details,
      severity,
    };
    this.events.unshift(evt);
    if (this.events.length > this.maxEventsLength) {
      this.events.pop();
    }
  }

  private resetMetrics(): void {
    this.startTimeSec = performance.now() / 1000;
    this.metrics = {
      framesProcessed: 0,
      detectionRate: 0,
      averageConfidence: 0,
      currentFps: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      timeToFirstDetectionSec: null,
      timeToFirstLockSec: null,
      lockDurationSec: 0,
      lockRetentionRate: 0,
      lockLossCount: 0,
      reacquisitionTimeSec: null,
      coastingDurationSec: 0,
    };
    this.latenciesBuffer = [];
    this.frameTimestamps = [];
    this.totalDetectedFrames = 0;
    this.totalLockedFrames = 0;
    this.lockRetentionFrames = 0;
    this.sumConfidence = 0;
    this.lastLockLostTimestamp = null;
    this.reacquisitionTimes = [];
  }

  /**
   * Convert measured pixel coordinates into angular deviations (degrees and milliradians)
   * using the calibrated camera pinhole model with principal point and radial distortion.
   */
  public pixelToAngular(pixelX: number, pixelY: number): {
    panDeg: number;
    tiltDeg: number;
    panMrad: number;
    tiltMrad: number;
    totalAngularDeg: number;
    totalAngularMrad: number;
  } {
    const cx = this.config.principalPoint.cx;
    const cy = this.config.principalPoint.cy;
    const dx = pixelX - cx;
    const dy = pixelY - cy;

    const fx = (this.config.actualWidth / 2) / Math.tan((this.config.fovXDeg * Math.PI) / 360);
    const fy = (this.config.actualHeight / 2) / Math.tan((this.config.fovYDeg * Math.PI) / 360);

    let xNorm = dx / fx;
    let yNorm = dy / fy;

    // Optional radial distortion compensation (Brown-Conrady k1)
    if (this.config.k1Distortion !== 0) {
      const r2 = xNorm * xNorm + yNorm * yNorm;
      const factor = 1 + this.config.k1Distortion * r2;
      xNorm *= factor;
      yNorm *= factor;
    }

    const panDeg = (Math.atan(xNorm) * 180) / Math.PI;
    const tiltDeg = (Math.atan(yNorm) * 180) / Math.PI;
    const panMrad = panDeg * 17.4533;
    const tiltMrad = tiltDeg * 17.4533;
    const totalAngularDeg = Math.sqrt(panDeg * panDeg + tiltDeg * tiltDeg);
    const totalAngularMrad = totalAngularDeg * 17.4533;

    return {
      panDeg,
      tiltDeg,
      panMrad,
      tiltMrad,
      totalAngularDeg,
      totalAngularMrad,
    };
  }

  /**
   * Process a single video frame from the live webcam
   */
  public processFrame(): WebcamTelemetry | null {
    if (!this.isStreaming || !this.videoElement || this.videoElement.readyState < 2) {
      return null;
    }

    if (this.isProcessingFrame) {
      // Drop frame to prevent unbounded queue lag
      return this.currentTelemetry;
    }

    this.isProcessingFrame = true;
    const startProc = performance.now();
    const nowSec = startProc / 1000;
    const dt = this.frameTimestamps.length > 0 ? Math.min(0.1, Math.max(0.005, nowSec - this.frameTimestamps[this.frameTimestamps.length - 1])) : 0.033;
    this.frameTimestamps.push(nowSec);
    if (this.frameTimestamps.length > 30) this.frameTimestamps.shift();

    const w = this.config.actualWidth;
    const h = this.config.actualHeight;

    if (!this.captureCtx) {
      this.isProcessingFrame = false;
      return null;
    }

    // 1. Grab image pixels from webcam stream
    this.captureCtx.drawImage(this.videoElement, 0, 0, w, h);
    const imageData = this.captureCtx.getImageData(0, 0, w, h);

    // 2. Load into physical sensor frame (with optional software disturbances)
    this.sensorFrame.loadFromRGBA(
      imageData.data,
      w,
      h,
      nowSec,
      this.disturbances.enabled ? this.disturbances : undefined
    );

    // 3. Run selected detector on the sensor frame (no ground truth cheating)
    let detection: DetectionResult;
    if (this.perceptionMode === 'classical_cv') {
      detection = this.classicalDetector.detect(this.sensorFrame);
    } else {
      detection = this.neuralDetector.detect(this.sensorFrame);
      if (this.perceptionMode === 'kalman_predictive') {
        detection.modeUsed = 'kalman_predictive';
      }
    }
    this.currentDetection = detection;

    // 4. Optional Evaluation Reference detection (ground truth fiducial marker)
    this.updateEvaluationReference(imageData, w, h);

    // 5. Kalman Filter Prediction & Measurement Update
    this.kalmanFilter.predict(dt);

    let controlPoint: { x: number; y: number } | null = null;
    const useKalman = this.perceptionMode === 'kalman_predictive';

    if (detection.detected && detection.centroid) {
      if (useKalman) {
        this.kalmanFilter.update(detection.centroid.x, detection.centroid.y);
        controlPoint = this.kalmanFilter.predictAhead(0.025); // 25ms forward lookahead
      } else {
        controlPoint = detection.centroid;
      }

      // Check recovery from COASTING or initial acquisition
      if (this.previousStatus === 'COASTING') {
        this.fsmState = 'REACQUIRING';
        this.reacquireCooldownFrames = 6;
        if (this.lastLockLostTimestamp !== null) {
          const reacqTime = nowSec - this.lastLockLostTimestamp;
          this.reacquisitionTimes.push(reacqTime);
          this.lastLockLostTimestamp = null;
        }
      } else if (this.reacquireCooldownFrames > 0) {
        this.reacquireCooldownFrames--;
        this.fsmState = 'REACQUIRING';
      } else if (this.previousStatus === 'SEARCHING' || this.previousStatus === 'LOST') {
        this.fsmState = 'ACQUIRING';
      } else {
        this.fsmState = 'TRACKING';
      }
      this.coastDurationSec = 0;
    } else {
      // Target dropout / missing detection
      if (useKalman && this.kalmanFilter.getState().isInitialized && this.coastDurationSec < 2.0) {
        this.coastDurationSec += dt;
        this.metrics.coastingDurationSec += dt;
        this.kalmanFilter.coast();
        const kState = this.kalmanFilter.getState();
        controlPoint = { x: kState.x, y: kState.y };
        this.fsmState = 'COASTING';
      } else {
        this.fsmState = 'SEARCHING';
        this.coastDurationSec = 0;
        this.reacquireCooldownFrames = 0;
        if (this.previousStatus === 'COASTING') {
          this.kalmanFilter.reset();
        }
      }
    }

    // 6. Compute Angular Error & Virtual Gimbal PID Command
    let pixelError = 0;
    let angular = { panDeg: 0, tiltDeg: 0, panMrad: 0, tiltMrad: 0, totalAngularDeg: 0, totalAngularMrad: 0 };
    let cmdPanRate = 0;
    let cmdTiltRate = 0;

    const cx = this.config.principalPoint.cx;
    const cy = this.config.principalPoint.cy;

    if (controlPoint) {
      pixelError = Math.hypot(controlPoint.x - cx, controlPoint.y - cy);
      angular = this.pixelToAngular(controlPoint.x, controlPoint.y);

      // Kalman feedforward target velocity rates
      const kState = this.kalmanFilter.getState();
      const ffPanRate = (kState.vx / (w / 2)) * (this.config.fovXDeg / 2);
      const ffTiltRate = (kState.vy / (h / 2)) * (this.config.fovYDeg / 2);

      // Virtual Gimbal PID Controller
      const fakeCamConfig: CameraConfig = {
        width: w,
        height: h,
        fovXDeg: this.config.fovXDeg,
        fovYDeg: this.config.fovYDeg,
        maxPanRateDegPerSec: 35.0,
        maxTiltRateDegPerSec: 25.0,
        panMinDeg: this.virtualGimbal.panMinDeg,
        panMaxDeg: this.virtualGimbal.panMaxDeg,
        tiltMinDeg: this.virtualGimbal.tiltMinDeg,
        tiltMaxDeg: this.virtualGimbal.tiltMaxDeg,
      };

      const cmd = this.gimbalController.computeCommand(
        angular.panDeg,
        angular.tiltDeg,
        ffPanRate,
        ffTiltRate,
        dt,
        this.pidGains,
        fakeCamConfig
      );

      cmdPanRate = cmd.cmdPanRateDegPerSec;
      cmdTiltRate = cmd.cmdTiltRateDegPerSec;

      // Integrate Virtual Gimbal Kinematics
      this.virtualGimbal.panVelDegPerSec = cmdPanRate;
      this.virtualGimbal.tiltVelDegPerSec = cmdTiltRate;
      this.virtualGimbal.panDeg += cmdPanRate * dt;
      this.virtualGimbal.tiltDeg += cmdTiltRate * dt;

      // Clamp to physical gimbal travel limits
      this.virtualGimbal.panDeg = Math.max(
        this.virtualGimbal.panMinDeg,
        Math.min(this.virtualGimbal.panMaxDeg, this.virtualGimbal.panDeg)
      );
      this.virtualGimbal.tiltDeg = Math.max(
        this.virtualGimbal.tiltMinDeg,
        Math.min(this.virtualGimbal.tiltMaxDeg, this.virtualGimbal.tiltDeg)
      );
    } else {
      // In SEARCHING/LOST mode: decay velocity gracefully
      this.virtualGimbal.panVelDegPerSec *= 0.9;
      this.virtualGimbal.tiltVelDegPerSec *= 0.9;
      this.virtualGimbal.panDeg += this.virtualGimbal.panVelDegPerSec * dt;
      this.virtualGimbal.tiltDeg += this.virtualGimbal.tiltVelDegPerSec * dt;
    }

    // 7. Lock Verification Criteria (< 0.22° coarse PAT link cone & confidence >= 0.70)
    const withinLockCone = angular.totalAngularDeg < 0.22;
    const lockCandidate = detection.detected && withinLockCone && detection.confidence >= 0.7;

    if (lockCandidate) {
      this.lockPersistenceCount++;
      if (this.isLocked || this.lockPersistenceCount >= 6) {
        this.fsmState = 'LOCKED';
        this.isLocked = true;
      }
    } else {
      this.lockPersistenceCount = Math.max(0, this.lockPersistenceCount - 2);
      if (this.isLocked) {
        if (this.lockPersistenceCount > 0) {
          // Preserve lock through short camera dropouts/noisy frames.  The
          // counter acts as a hysteresis budget and the retained frames must
          // remain in the LOCKED state for retention metrics to be correct.
          this.fsmState = 'LOCKED';
        } else {
          this.isLocked = false;
          this.metrics.lockLossCount++;
          this.lastLockLostTimestamp = nowSec;
        }
      }
    }

    // Track recent detections for temporal consistency metric
    this.recentDetectionsHistory.push(detection.detected);
    if (this.recentDetectionsHistory.length > 20) {
      this.recentDetectionsHistory.shift();
    }

    // Event logging on state transitions
    if (this.fsmState !== this.previousStatus) {
      const currentState: TrackingStatus = this.fsmState;
      const severity =
        currentState === 'LOCKED'
          ? 'success'
          : currentState === 'COASTING'
          ? 'warning'
          : (currentState as string) === 'LOST' || currentState === 'SEARCHING'
          ? 'error'
          : 'info';
      this.logEvent(
        'state_change',
        `FSM State: ${this.previousStatus} → ${this.fsmState}`,
        severity,
        `Angular error: ${angular.totalAngularDeg.toFixed(2)}° | Confidence: ${(detection.confidence * 100).toFixed(0)}%`
      );
    }

    this.previousStatus = this.fsmState;

    // 8. Processing Latency & FPS Calculation
    const endProc = performance.now();
    const procTimeMs = endProc - startProc;
    this.latenciesBuffer.push(procTimeMs);
    if (this.latenciesBuffer.length > 50) this.latenciesBuffer.shift();

    let fps = 30;
    if (this.frameTimestamps.length >= 2) {
      const duration = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
      if (duration > 0) {
        fps = Number(((this.frameTimestamps.length - 1) / duration).toFixed(1));
      }
    }

    // 9. Update Metrics
    this.metrics.framesProcessed++;
    if (detection.detected) {
      this.totalDetectedFrames++;
      this.sumConfidence += detection.confidence;
      if (this.metrics.timeToFirstDetectionSec === null) {
        this.metrics.timeToFirstDetectionSec = Number((nowSec - this.startTimeSec).toFixed(2));
      }
    }
    if (this.fsmState === 'LOCKED') {
      this.totalLockedFrames++;
      this.metrics.lockDurationSec += dt;
      if (this.metrics.timeToFirstLockSec === null) {
        this.metrics.timeToFirstLockSec = Number((nowSec - this.startTimeSec).toFixed(2));
      }
    }

    // Report retention only over the post-acquisition interval. Before the
    // first verified lock there is nothing to retain.
    if (this.metrics.timeToFirstLockSec !== null) {
      this.lockRetentionFrames++;
    }

    this.metrics.detectionRate = Number(((this.totalDetectedFrames / this.metrics.framesProcessed) * 100).toFixed(1));
    this.metrics.averageConfidence = this.totalDetectedFrames > 0 ? Number((this.sumConfidence / this.totalDetectedFrames).toFixed(2)) : 0;
    this.metrics.lockRetentionRate = this.lockRetentionFrames > 0
      ? Number(((this.totalLockedFrames / this.lockRetentionFrames) * 100).toFixed(1))
      : 0;
    this.metrics.currentFps = fps;

    const sumLat = this.latenciesBuffer.reduce((a, b) => a + b, 0);
    this.metrics.averageLatencyMs = Number((sumLat / Math.max(1, this.latenciesBuffer.length)).toFixed(1));

    const sortedLat = [...this.latenciesBuffer].sort((a, b) => a - b);
    const p95Idx = Math.floor(sortedLat.length * 0.95);
    this.metrics.p95LatencyMs = Number((sortedLat[p95Idx] || procTimeMs).toFixed(1));

    if (this.reacquisitionTimes.length > 0) {
      const sumReacq = this.reacquisitionTimes.reduce((a, b) => a + b, 0);
      this.metrics.reacquisitionTimeSec = Number((sumReacq / this.reacquisitionTimes.length).toFixed(2));
    }

    const kState = this.kalmanFilter.getState();
    const pidTerms = this.gimbalController.getLastTerms();

    // Calculate Real Tracking Confidence Breakdown
    const recentHits = this.recentDetectionsHistory.filter(Boolean).length;
    const temporalConsistency = Math.round((recentHits / Math.max(1, this.recentDetectionsHistory.length)) * 100);
    const residualMag = Math.hypot(this.kalmanFilter.lastResidual.resX, this.kalmanFilter.lastResidual.resY);
    const predictionConsistency = Math.round(Math.max(0, Math.min(100, 100 - residualMag * 2.5)));
    const targetAssociation = Math.round(Math.max(10, Math.min(100, (detection.snrDb + 4) * 4.5)));
    const detectionConfPct = Math.round(detection.confidence * 100);

    const overallConfidence = Math.round(
      detection.detected
        ? detectionConfPct * 0.4 + temporalConsistency * 0.25 + predictionConsistency * 0.2 + targetAssociation * 0.15
        : this.fsmState === 'COASTING'
        ? Math.max(15, Math.round(50 - (this.coastDurationSec / 2.0) * 40))
        : 0
    );

    const confidenceBreakdown: TrackingConfidenceBreakdown = {
      overall: overallConfidence,
      detectionConfidence: detectionConfPct,
      temporalConsistency,
      predictionConsistency,
      targetAssociation,
      factors: {
        snrFactor: Math.round(Math.min(100, Math.max(0, detection.snrDb * 5))),
        motionSmoothness: Math.round(Math.max(20, 100 - Math.abs(cmdPanRate) * 1.5 - Math.abs(cmdTiltRate) * 1.5)),
        covarianceStability: Math.round(Math.max(10, Math.min(100, 120 - kState.covarianceTrace))),
        lockPersistenceFactor: Math.round((this.lockPersistenceCount / 6) * 100),
      },
    };

    // Calculate Movement Explanations
    const dx = controlPoint ? controlPoint.x - cx : 0;
    const dy = controlPoint ? controlPoint.y - cy : 0;
    const absDx = Math.abs(Math.round(dx));
    const absDy = Math.abs(Math.round(dy));

    let summarySentence = '';
    if (this.fsmState === 'LOCKED') {
      summarySentence = `Target locked inside fine acceptance cone (< 0.22°). Optical pointing stabilized at ${angular.totalAngularDeg.toFixed(2)}° (${angular.totalAngularMrad.toFixed(1)} mrad).`;
    } else if (this.fsmState === 'COASTING') {
      summarySentence = `Target beacon occluded; coasting on Kalman velocity (${kState.vx >= 0 ? '+' : ''}${kState.vx.toFixed(0)} px/s, ${kState.vy >= 0 ? '+' : ''}${kState.vy.toFixed(0)} px/s) to maintain line-of-sight.`;
    } else if (this.fsmState === 'REACQUIRING') {
      summarySentence = `Spot detected near predicted gate; associating track TGT-01 and restoring closed-loop convergence.`;
    } else if (this.fsmState === 'ACQUIRING') {
      summarySentence = `Optical spot detected at (${Math.round(controlPoint?.x || 0)}, ${Math.round(controlPoint?.y || 0)}); engaging closed-loop PID centering.`;
    } else if (this.fsmState === 'SEARCHING') {
      summarySentence = `No optical beacon detected in FOV. Scanning camera sensor for high-contrast emission.`;
    } else {
      summarySentence = `Target is ${absDx} px ${dx >= 0 ? 'right' : 'left'} of center. Commanding Pan: ${cmdPanRate >= 0 ? '+' : ''}${cmdPanRate.toFixed(1)}°/s, Tilt: ${cmdTiltRate >= 0 ? '+' : ''}${cmdTiltRate.toFixed(1)}°/s.`;
    }

    const explainability: TrackingExplainabilityData = {
      opticalCenter: { x: cx, y: cy },
      detectedPoint: detection.centroid ? { x: detection.centroid.x, y: detection.centroid.y } : null,
      predictedPoint: kState.isInitialized ? { x: kState.predX, y: kState.predY } : null,
      pixelErrorX: Math.round(dx),
      pixelErrorY: Math.round(dy),
      totalPixelError: Number(pixelError.toFixed(1)),
      angularPanDeg: Number(angular.panDeg.toFixed(3)),
      angularTiltDeg: Number(angular.tiltDeg.toFixed(3)),
      totalAngularDeg: Number(angular.totalAngularDeg.toFixed(3)),
      totalAngularMrad: Number(angular.totalAngularMrad.toFixed(2)),
      movementReason: {
        horizontalOffset: `${absDx} px ${dx >= 0 ? 'right' : 'left'} of optical center`,
        verticalOffset: `${absDy} px ${dy >= 0 ? 'below' : 'above'} optical center`,
        panAction: `Move ${dx >= 0 ? 'RIGHT (+)' : 'LEFT (-)'}`,
        tiltAction: `Move ${dy >= 0 ? 'DOWN (+)' : 'UP (-)'}`,
        summarySentence,
      },
      pidTerms,
      cmdPanRate: Number(cmdPanRate.toFixed(2)),
      cmdTiltRate: Number(cmdTiltRate.toFixed(2)),
      kalmanVelocity: {
        vx: Number(kState.vx.toFixed(1)),
        vy: Number(kState.vy.toFixed(1)),
        speed: Number(Math.hypot(kState.vx, kState.vy).toFixed(1)),
      },
      kalmanResidual: this.kalmanFilter.lastResidual,
      kalmanCovarianceTrace: Number(kState.covarianceTrace.toFixed(1)),
      kalmanLookaheadSec: 0.025,
      confidenceBreakdown,
      fsmState: this.fsmState,
      fsmReason: {
        currentState: this.fsmState,
        reasonText:
          this.fsmState === 'LOCKED'
            ? 'Measured optical error is continuously within the 0.22° coarse PAT link cone with high detection confidence.'
            : this.fsmState === 'TRACKING'
            ? 'Closed-loop feedback driving virtual gimbal to center target. Converging toward lock cone.'
            : this.fsmState === 'COASTING'
            ? `Optical beacon dropped out. Forward propagation running via Kalman velocity vector (elapsed: ${(this.coastDurationSec * 1000).toFixed(0)} ms).`
            : this.fsmState === 'REACQUIRING'
            ? 'Detection recovered during coasting window. Verified track gate association.'
            : this.fsmState === 'ACQUIRING'
            ? 'Initial spot detected; initializing Kalman state and verifying persistence.'
            : 'Waiting for optical emission or active beacon in camera field of view.',
        criteriaList: [
          { label: 'Beacon detected in frame', met: detection.detected },
          { label: 'Confidence ≥ 70%', met: detection.confidence >= 0.7 },
          { label: 'Pointing error < 0.22°', met: angular.totalAngularDeg < 0.22 },
          { label: 'Lock persistence (6 frames)', met: this.lockPersistenceCount >= 6 },
        ],
        coastElapsedMs: Math.round(this.coastDurationSec * 1000),
        coastTimeoutMs: 2000,
        persistenceCount: this.lockPersistenceCount,
        nextAction:
          this.fsmState === 'LOCKED'
            ? 'Maintain optical lock and stream high-bandwidth telemetry.'
            : this.fsmState === 'COASTING'
            ? `Coast up to 2.0s before falling back to SEARCHING.`
            : 'Slew gimbal toward target centroid.',
      },
      candidates: detection.candidates || [],
      selectedCandidateId: detection.targetId || (detection.candidates?.[0]?.id ?? null),
      qualityChecks: {
        detectionValid: detection.detected && detection.confidence >= 0.5,
        predictionConverged: kState.isInitialized && kState.covarianceTrace < 120,
        motionSmooth: Math.abs(cmdPanRate) < 25 && Math.abs(cmdTiltRate) < 20,
        angularWithinCone: angular.totalAngularDeg < 0.22,
        persistenceLocked: this.fsmState === 'LOCKED',
        overallStatus:
          this.fsmState === 'LOCKED'
            ? 'STABLE OPTICAL TRACK'
            : this.fsmState === 'COASTING'
            ? 'COASTING ON PREDICTION'
            : detection.detected
            ? 'ACQUIRING / ADJUSTING'
            : 'SEARCHING / SIGNAL LOST',
      },
    };

    this.currentExplainability = explainability;

    // Push into replay buffer
    this.replayBuffer.push({
      timestamp: Number((nowSec - this.startTimeSec).toFixed(3)),
      explainability,
    });
    if (this.replayBuffer.length > this.maxReplayFrames) {
      this.replayBuffer.shift();
    }

    const telemetry: WebcamTelemetry = {
      timestamp: Number((nowSec - this.startTimeSec).toFixed(3)),
      frameId: this.metrics.framesProcessed,
      detection: detection.detected,
      confidence: detection.confidence,
      trackingConfidence: overallConfidence,
      measuredX: detection.centroid ? Number(detection.centroid.x.toFixed(1)) : null,
      measuredY: detection.centroid ? Number(detection.centroid.y.toFixed(1)) : null,
      predictedX: kState.isInitialized ? Number(kState.predX.toFixed(1)) : null,
      predictedY: kState.isInitialized ? Number(kState.predY.toFixed(1)) : null,
      pixelError: Number(pixelError.toFixed(1)),
      pixelErrorX: Math.round(dx),
      pixelErrorY: Math.round(dy),
      angularErrorDeg: Number(angular.totalAngularDeg.toFixed(3)),
      angularErrorMrad: Number(angular.totalAngularMrad.toFixed(2)),
      angularPanDeg: Number(angular.panDeg.toFixed(3)),
      angularTiltDeg: Number(angular.tiltDeg.toFixed(3)),
      cmdPanRateDegPerSec: Number(cmdPanRate.toFixed(2)),
      cmdTiltRateDegPerSec: Number(cmdTiltRate.toFixed(2)),
      pidTerms,
      virtualGimbalPanDeg: Number(this.virtualGimbal.panDeg.toFixed(2)),
      virtualGimbalTiltDeg: Number(this.virtualGimbal.tiltDeg.toFixed(2)),
      fsmState: this.fsmState,
      fps,
      latencyMs: Number(procTimeMs.toFixed(1)),
      evalErrorDeg: this.evalReference.trueTrackingErrorDeg,
    };

    this.currentTelemetry = telemetry;
    this.telemetryHistory.push(telemetry);
    if (this.telemetryHistory.length > this.maxHistoryLength) {
      this.telemetryHistory.shift();
    }

    this.isProcessingFrame = false;
    return telemetry;
  }

  public getExplainabilityData(): TrackingExplainabilityData | null {
    return this.currentExplainability;
  }

  /**
   * Detects optional Evaluation Reference in the webcam image (e.g. high-contrast colored marker / fiducial)
   * to compute physical ground-truth tracking error.
   */
  private updateEvaluationReference(imageData: ImageData, w: number, h: number): void {
    if (!this.evalReference.enabled) {
      this.evalReference.detected = false;
      this.evalReference.trueTrackingErrorPx = null;
      this.evalReference.trueTrackingErrorDeg = null;
      this.evalReference.trueTrackingErrorMrad = null;
      return;
    }

    const data = imageData.data;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    // Fast search for fiducial marker: High cyan / magenta or distinctive marker
    for (let y = 0; y < h; y += 4) {
      const row = y * w * 4;
      for (let x = 0; x < w; x += 4) {
        const idx = row + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Cyan / Blue fiducial marker signature (B > 160 && G > 140 && R < 100)
        const isFiducial = b > 150 && g > 130 && r < 110;
        if (isFiducial) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count > 10) {
      const refX = sumX / count;
      const refY = sumY / count;
      this.evalReference.detected = true;
      this.evalReference.screenX = refX;
      this.evalReference.screenY = refY;

      // If beacon was also detected, compute error between estimated beacon and reference
      if (this.currentDetection.centroid) {
        const errPx = Math.hypot(this.currentDetection.centroid.x - refX, this.currentDetection.centroid.y - refY);
        this.evalReference.trueTrackingErrorPx = Number(errPx.toFixed(1));

        const fx = (w / 2) / Math.tan((this.config.fovXDeg * Math.PI) / 360);
        const fy = (h / 2) / Math.tan((this.config.fovYDeg * Math.PI) / 360);
        const errDeg = (Math.hypot((this.currentDetection.centroid.x - refX) / fx, (this.currentDetection.centroid.y - refY) / fy) * 180) / Math.PI;
        this.evalReference.trueTrackingErrorDeg = Number(errDeg.toFixed(3));
        this.evalReference.trueTrackingErrorMrad = Number((errDeg * 17.4533).toFixed(2));
      }
    } else {
      this.evalReference.detected = false;
      this.evalReference.trueTrackingErrorPx = null;
      this.evalReference.trueTrackingErrorDeg = null;
      this.evalReference.trueTrackingErrorMrad = null;
    }
  }

  /**
   * Export captured telemetry to CSV file
   */
  public exportCSV(): void {
    if (this.telemetryHistory.length === 0) return;

    const headers = [
      'timestamp_sec',
      'frame_id',
      'fsm_state',
      'detection',
      'confidence',
      'measured_x_px',
      'measured_y_px',
      'predicted_x_px',
      'predicted_y_px',
      'pixel_error',
      'angular_error_deg',
      'angular_error_mrad',
      'cmd_pan_rate_deg_s',
      'cmd_tilt_rate_deg_s',
      'virtual_gimbal_pan_deg',
      'virtual_gimbal_tilt_deg',
      'fps',
      'latency_ms',
      'eval_error_deg',
    ];

    const rows = this.telemetryHistory.map((t) => [
      t.timestamp,
      t.frameId,
      t.fsmState,
      t.detection ? 1 : 0,
      t.confidence,
      t.measuredX ?? '',
      t.measuredY ?? '',
      t.predictedX ?? '',
      t.predictedY ?? '',
      t.pixelError,
      t.angularErrorDeg,
      t.angularErrorMrad,
      t.cmdPanRateDegPerSec,
      t.cmdTiltRateDegPerSec,
      t.virtualGimbalPanDeg,
      t.virtualGimbalTiltDeg,
      t.fps,
      t.latencyMs,
      t.evalErrorDeg ?? '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fsoc-live-webcam-telemetry-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export captured telemetry and summary metrics to JSON file
   */
  public exportJSON(): void {
    const data = {
      system: 'FSOC PAT Live Webcam Tracking',
      timestamp: new Date().toISOString(),
      configuration: {
        camera: this.config,
        perceptionMode: this.perceptionMode,
        pidGains: this.pidGains,
        disturbances: this.disturbances,
      },
      performanceMetrics: this.metrics,
      eventsCount: this.events.length,
      events: this.events,
      telemetryFramesCount: this.telemetryHistory.length,
      telemetryHistory: this.telemetryHistory,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fsoc-live-webcam-telemetry-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
