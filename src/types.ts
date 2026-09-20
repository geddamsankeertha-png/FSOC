/**
 * Types and interfaces for the FSOC PAT (Pointing, Acquisition, and Tracking)
 * Virtual Camera Tracking System .
 */

export type PerceptionMode = 'classical_cv' | 'ai_neural' | 'kalman_predictive';

export type TrajectoryType = 
  | 'circular' 
  | 'linear' 
  | 'sinusoidal' 
  | 'figure8' 
  | 'stochastic' 
  | 'evasive';

export type TrackingStatus = 
  | 'SEARCHING' 
  | 'ACQUIRING' 
  | 'TRACKING' 
  | 'LOCKED' 
  | 'COASTING' 
  | 'REACQUIRING' 
  | 'LOST';

export interface CameraConfig {
  width: number;
  height: number;
  fovXDeg: number;
  fovYDeg: number;
  maxPanRateDegPerSec: number;
  maxTiltRateDegPerSec: number;
  panMinDeg: number;
  panMaxDeg: number;
  tiltMinDeg: number;
  tiltMaxDeg: number;
}

export interface CameraState {
  panDeg: number;
  tiltDeg: number;
  panVelDegPerSec: number;
  tiltVelDegPerSec: number;
  jitterPanDeg: number;
  jitterTiltDeg: number;
}

export interface TargetConfig {
  trajectory: TrajectoryType;
  speed: number;
  radiusDeg: number;
  altitudeDeg: number;
  multiTargetClutter: boolean;
  beaconWavelengthNm: number; // e.g., 850 or 1550
}

export interface DecoyTarget {
  id: string;
  panDeg: number;
  tiltDeg: number;
  intensity: number;
  isTrueBeacon: boolean;
  glintPhase: number;
}

export interface TargetState {
  panDeg: number;
  tiltDeg: number;
  velPanDegPerSec: number;
  velTiltDegPerSec: number;
  intensity: number; // 0 to 1
  isOccluded: boolean;
  decoys: DecoyTarget[];
}

export interface DisturbanceConfig {
  sensorNoisePercent: number; // 0 to 100
  platformVibrationDeg: number; // 0 to 5 deg jitter
  vibrationFrequencyHz: number;
  turbulencePercent: number; // Scintillation & beam wander (0 to 100)
  opticalBlurPx: number; // 0 to 12 px
  atmosphericFogPercent: number; // 0 to 100
  manualOcclusion: boolean;
}

export interface PIDGains {
  kp: number;
  ki: number;
  kd: number;
  feedforward: boolean;
  kff: number;
  integralClamp: number;
  deadbandPx: number;
}

export interface PIDTerms {
  pPan: number;
  iPan: number;
  dPan: number;
  ffPan: number;
  totalPan: number;
  pTilt: number;
  iTilt: number;
  dTilt: number;
  ffTilt: number;
  totalTilt: number;
}

export interface CandidateInfo {
  id: string;
  x: number;
  y: number;
  confidence: number;
  intensity: number;
  snrDb: number;
  isSelected: boolean;
  distanceToPredictedPx?: number;
  selectionReason?: string;
}

export interface DetectionResult {
  detected: boolean;
  centroid: { x: number; y: number } | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  confidence: number;
  candidatesCount: number;
  candidates?: CandidateInfo[];
  snrDb: number;
  processingTimeMs: number;
  modeUsed: PerceptionMode;
  targetId?: string;
}

export interface KalmanState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  predX: number;
  predY: number;
  covarianceTrace: number;
  coastingFrames: number;
  isInitialized: boolean;
}

export type LockEvaluationMode =
  | 'optical-instantaneous'
  | 'mechanical-boresight'
  | 'filtered-optical';

export interface FrameTelemetry {
  timestamp: number; // relative seconds
  frameNumber: number;
  status: TrackingStatus;
  groundTruthScreen: { x: number; y: number; inFov: boolean };
  detectedScreen: { x: number; y: number } | null;
  predictedScreen: { x: number; y: number } | null;
  pixelError: number;
  angularErrorDeg: number;
  angularErrorMrad: number;
  cameraPanDeg: number;
  cameraTiltDeg: number;
  targetPanDeg: number;
  targetTiltDeg: number;
  isLocked: boolean; // within link tolerance (< 0.2 deg)
  fps: number;
  processingTimeMs: number;
  panErrorDeg?: number;
  tiltErrorDeg?: number;
  estimatedPanDeg?: number;
  estimatedTiltDeg?: number;
  panPidOutput?: number;
  tiltPidOutput?: number;
  detectionConfidence?: number;
  snrDb?: number;
  signalStrength?: number;
  beaconVisible?: boolean;
  mechanicalPanErrorDeg?: number;
  mechanicalTiltErrorDeg?: number;
  mechanicalPointingErrorDeg?: number;
  instantaneousOpticalErrorDeg?: number;
  filteredOpticalErrorDeg?: number;
  lockEvaluationErrorDeg?: number;
  lockEvaluationMode?: LockEvaluationMode;
  feedforwardPanRateDegPerSec?: number;
  feedforwardTiltRateDegPerSec?: number;
}

export interface PerformanceStats {
  acquisitionTimeSec: number | null;
  timeToFirstLockSec: number | null;
  acquisitionSuccessRate: number; // 0 to 100%
  totalFrames: number;
  lockedFrames: number;
  lockRetentionRate: number; // percentage of post-acquisition frames spent in LOCKED
  lockLossCount: number; // number of times lock was lost
  reacquisitionTimeSec: number | null; // average time to reacquire lock after dropout
  falseLockRate: number; // percentage of locked frames locked onto a decoy/clutter
  detectionRate: number; // percentage of FOV frames where beacon was detected
  currentPixelError: number;
  currentAngularErrorDeg: number;
  currentAngularErrorMrad: number;
  meanAngularErrorDeg: number;
  meanAngularErrorMrad: number;
  rmsAngularErrorDeg: number;
  rmsAngularErrorMrad: number;
  maxAngularErrorDeg: number;
  averageFps: number;
  averageLatencyMs: number;
  opticalLinkAvailability: number; // percentage
}

export interface BenchmarkScenario {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  trajectory: TrajectoryType;
  speed: number;
  disturbances: Partial<DisturbanceConfig>;
  targetClutter: boolean;
  targetToleranceDeg: number;
  seed?: number;
}

export interface BenchmarkReportItem {
  trialIndex?: number;
  scenarioId: string;
  scenarioTitle: string;
  trajectory: TrajectoryType;
  perceptionMode: PerceptionMode;
  useKalman: boolean;
  useFeedforward: boolean;
  seed: number;
  durationSec: number;
  timeToFirstLockSec: number | null;
  lockRetentionRate: number;
  lockLossCount: number;
  reacquisitionTimeSec: number | null;
  falseLockRate: number;
  detectionRate: number;
  rmsAngularErrorDeg: number;
  rmsAngularErrorMrad: number;
  meanAngularErrorDeg: number;
  maxAngularErrorDeg: number;
  averageFps: number;
  averageLatencyMs: number;
  passed: boolean;
}

export interface AlgorithmComparisonResult {
  category: 'perception' | 'estimation' | 'control';
  variantA: {
    name: string;
    lockRetention: number;
    rmsErrorDeg: number;
    detectionRate: number;
    latencyMs: number;
    falseLockRate: number;
  };
  variantB: {
    name: string;
    lockRetention: number;
    rmsErrorDeg: number;
    detectionRate: number;
    latencyMs: number;
    falseLockRate: number;
  };
  improvementPercent: {
    lockRetention: number;
    rmsError: number;
    falseLockReduction: number;
  };
}

export type ApplicationMode = 'virtual_sim' | 'live_webcam';

export interface WebcamConfig {
  deviceId: string;
  requestedWidth: number;
  requestedHeight: number;
  requestedFps: number;
  actualWidth: number;
  actualHeight: number;
  actualFps: number;
  fovXDeg: number;
  fovYDeg: number;
  principalPoint: { cx: number; cy: number };
  k1Distortion: number;
}

export interface LiveSoftwareDisturbances {
  enabled: boolean;
  noisePercent: number; // 0 to 100
  blurPx: number; // 0 to 12
  brightnessPercent: number; // -50 to 50
  contrastPercent: number; // -50 to 50
  dropoutActive: boolean;
  syntheticVibrationPx: number; // 0 to 15
}

export interface EvaluationReference {
  enabled: boolean;
  detected: boolean;
  screenX: number;
  screenY: number;
  referenceType: 'bright_marker' | 'fiducial_tag';
  trueTrackingErrorPx: number | null;
  trueTrackingErrorDeg: number | null;
  trueTrackingErrorMrad: number | null;
}

export interface TrackingConfidenceBreakdown {
  overall: number; // 0 to 100
  detectionConfidence: number; // 0 to 100
  temporalConsistency: number; // 0 to 100
  predictionConsistency: number; // 0 to 100
  targetAssociation: number; // 0 to 100
  factors: {
    snrFactor: number;
    motionSmoothness: number;
    covarianceStability: number;
    lockPersistenceFactor: number;
  };
}

export interface TrackingEvent {
  id: string;
  timestamp: number;
  timeString: string;
  type: 'detection' | 'state_change' | 'lock_loss' | 'lock_acquired' | 'reacquisition' | 'coasting' | 'controller';
  message: string;
  details?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export type SensorViewMode = 'normal' | 'tracking' | 'threshold' | 'roi';

export type UIMode = 'simple' | 'engineer';

export interface TrackingExplainabilityData {
  // Points
  opticalCenter: { x: number; y: number };
  detectedPoint: { x: number; y: number } | null;
  predictedPoint: { x: number; y: number } | null;
  
  // Errors
  pixelErrorX: number;
  pixelErrorY: number;
  totalPixelError: number;
  angularPanDeg: number;
  angularTiltDeg: number;
  totalAngularDeg: number;
  totalAngularMrad: number;

  // Decision & Movement Explanation
  movementReason: {
    horizontalOffset: string; // e.g., "37 px right of center"
    verticalOffset: string;   // e.g., "14 px above center"
    panAction: string;        // e.g., "Move RIGHT (+)"
    tiltAction: string;       // e.g., "Move UP (-)"
    summarySentence: string;
  };

  // Controller
  pidTerms: PIDTerms;
  cmdPanRate: number;
  cmdTiltRate: number;

  // Kalman
  kalmanVelocity: { vx: number; vy: number; speed: number };
  kalmanResidual: { resX: number; resY: number };
  kalmanCovarianceTrace: number;
  kalmanLookaheadSec: number;

  // Confidence & FSM
  confidenceBreakdown: TrackingConfidenceBreakdown;
  fsmState: TrackingStatus;
  fsmReason: {
    currentState: TrackingStatus;
    reasonText: string;
    criteriaList: { label: string; met: boolean }[];
    coastElapsedMs?: number;
    coastTimeoutMs?: number;
    persistenceCount?: number;
    nextAction: string;
  };

  // Candidates & Association
  candidates: CandidateInfo[];
  selectedCandidateId: string | null;

  // Quality Checklist
  qualityChecks: {
    detectionValid: boolean;
    predictionConverged: boolean;
    motionSmooth: boolean;
    angularWithinCone: boolean;
    persistenceLocked: boolean;
    overallStatus: 'STABLE OPTICAL TRACK' | 'ACQUIRING / ADJUSTING' | 'COASTING ON PREDICTION' | 'SEARCHING / SIGNAL LOST';
  };
}

export interface WebcamTelemetry {
  timestamp: number;
  frameId: number;
  detection: boolean;
  confidence: number;
  trackingConfidence: number;
  measuredX: number | null;
  measuredY: number | null;
  predictedX: number | null;
  predictedY: number | null;
  pixelError: number;
  pixelErrorX: number;
  pixelErrorY: number;
  angularErrorDeg: number;
  angularErrorMrad: number;
  angularPanDeg: number;
  angularTiltDeg: number;
  cmdPanRateDegPerSec: number;
  cmdTiltRateDegPerSec: number;
  pidTerms: PIDTerms;
  virtualGimbalPanDeg: number;
  virtualGimbalTiltDeg: number;
  fsmState: TrackingStatus;
  fps: number;
  latencyMs: number;
  evalErrorDeg: number | null;
}

export interface WebcamPerformanceMetrics {
  framesProcessed: number;
  detectionRate: number;
  averageConfidence: number;
  currentFps: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  timeToFirstDetectionSec: number | null;
  timeToFirstLockSec: number | null;
  lockDurationSec: number;
  lockRetentionRate: number;
  lockLossCount: number;
  reacquisitionTimeSec: number | null;
  coastingDurationSec: number;
}

