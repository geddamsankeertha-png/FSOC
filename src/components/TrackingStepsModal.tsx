import React, { useState } from 'react';
import {
  X,
  Camera,
  Search,
  Crosshair,
  Activity,
  Compass,
  Sliders,
  RotateCw,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { TrackingExplainabilityData, TrackingStatus } from '../types';

interface TrackingStepsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TrackingExplainabilityData | null;
  fsmState: TrackingStatus;
}

export const TrackingStepsModal: React.FC<TrackingStepsModalProps> = ({
  isOpen,
  onClose,
  data,
  fsmState,
}) => {
  const [activeStep, setActiveStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      id: 'camera_capture',
      title: 'Camera Frame Acquisition',
      icon: Camera,
      badge: 'INPUT',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
      summary: 'Raw image photons captured by optical camera sensor.',
      explanation:
        'The physical or virtual webcam captures frames at the configured resolution (e.g. 1280×720 at 30 FPS). The RGB image stream represents the optical field-of-view (FOV) of the receiver aperture.',
      liveKey: 'Optical Center',
      liveValue: data ? `(${data.opticalCenter.x}, ${data.opticalCenter.y}) px` : 'N/A',
      detail: 'Pixel coordinates originate from top-left (0,0) down to (W, H). Optical center (cx, cy) is calibrated as the camera boresight reference.',
    },
    {
      num: 2,
      id: 'perception_search',
      title: 'Target Beacon Detection & Spatial Filtering',
      icon: Search,
      badge: 'PERCEPTION',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
      summary: 'Perception algorithm filters image to propose and isolate beacon candidates.',
      explanation:
        'The detector (Classical CV adaptive thresholding or Deep Neural Network) scans the sensor frame for high-contrast optical spots. It proposal filters candidate pixels and discriminates the true FSOC beacon from background decoys and sunlight glints.',
      liveKey: 'Candidate Count & Selected',
      liveValue: data ? `${data.candidates?.length ?? 0} candidates (Selected: ${data.selectedCandidateId || 'None'})` : 'Searching...',
      detail: data?.candidates?.[0] ? `Candidate 1 SNR: ${data.candidates[0].snrDb} dB | Conf: ${(data.candidates[0].confidence * 100).toFixed(0)}%` : 'No spots above SNR threshold',
    },
    {
      num: 3,
      id: 'centroid_measurement',
      title: 'Centroid Measurement (● DETECTED)',
      icon: Crosshair,
      badge: 'MEASUREMENT',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
      summary: 'Sub-pixel optical center of energy calculated for beacon.',
      explanation:
        'Using intensity-weighted moment analysis (or bounding box regression), the exact coordinates of the optical target are computed as (zx, zy). This is the measured raw position before state estimation.',
      liveKey: '● Detected Point',
      liveValue: data?.detectedPoint ? `(${data.detectedPoint.x.toFixed(1)}, ${data.detectedPoint.y.toFixed(1)}) px` : 'NO SPOT DETECTED',
      detail: data?.detectedPoint ? 'Calculated via 2D intensity moments on localized region of interest.' : 'Detector is in full-frame scanning mode.',
    },
    {
      num: 4,
      id: 'kalman_estimation',
      title: 'Kalman Filter State & Velocity Estimation',
      icon: Activity,
      badge: 'ESTIMATION',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      summary: 'Discrete linear Kalman filter fuses measurements and estimates 2D velocity.',
      explanation:
        'The 4-state Kalman filter [x, y, vx, vy]^T predicts where the target should be, then calculates the innovation residual y = z - Hx. It updates the state using the optimal Kalman gain K = P H^T (H P H^T + R)^-1.',
      liveKey: 'Estimated Velocity',
      liveValue: data ? `Vx: ${data.kalmanVelocity.vx >= 0 ? '+' : ''}${data.kalmanVelocity.vx.toFixed(1)} px/s | Vy: ${data.kalmanVelocity.vy >= 0 ? '+' : ''}${data.kalmanVelocity.vy.toFixed(1)} px/s` : 'Initializing',
      detail: data ? `Residual innovation: (Δx: ${data.kalmanResidual.resX}px, Δy: ${data.kalmanResidual.resY}px) | Covariance Trace: ${data.kalmanCovarianceTrace}` : 'Awaiting initialization',
    },
    {
      num: 5,
      id: 'latency_lookahead',
      title: 'Target Lookahead Prediction (◇ PREDICTED)',
      icon: Compass,
      badge: 'PREDICTION',
      color: 'text-fuchsia-400',
      bgColor: 'bg-fuchsia-500/10 border-fuchsia-500/30',
      summary: 'Forward extrapolation compensates for camera capture and actuator delay.',
      explanation:
        'Gimbals and camera pipelines suffer from processing and transport lag (~25ms to 60ms). The Kalman filter projects the state forward in time: x_pred = x + vx * dt_lookahead, enabling zero-lag predictive steering.',
      liveKey: '◇ Predicted Point (T+25ms)',
      liveValue: data?.predictedPoint ? `(${data.predictedPoint.x.toFixed(1)}, ${data.predictedPoint.y.toFixed(1)}) px` : 'Coasting / Uninitialized',
      detail: 'If the beacon drops out (e.g. occlusion / fog), the system coasts on this prediction vector for up to 2.0 seconds!',
    },
    {
      num: 6,
      id: 'pixel_to_angle',
      title: 'Pinhole Geometry: Pixel Error to Optical Angle',
      icon: Info,
      badge: 'GEOMETRY',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      summary: 'Converts 2D pixel displacement into physical pointing angles.',
      explanation:
        'Using calibrated camera intrinsics (focal lengths fx, fy and principal point cx, cy), pixel error dx = x - cx and dy = y - cy are mapped to true optical angular deviations: θ_pan = arctan(dx / fx) and θ_tilt = arctan(dy / fy).',
      liveKey: 'Angular Error (Pan / Tilt)',
      liveValue: data ? `Pan: ${data.angularPanDeg >= 0 ? '+' : ''}${data.angularPanDeg.toFixed(2)}° | Tilt: ${data.angularTiltDeg >= 0 ? '+' : ''}${data.angularTiltDeg.toFixed(2)}°` : '0.00°',
      detail: data ? `Total 3D line-of-sight deviation: ${data.totalAngularDeg.toFixed(3)}° (${data.totalAngularMrad.toFixed(1)} mrad)` : 'Centered',
    },
    {
      num: 7,
      id: 'pid_control',
      title: 'Dual-Axis PID + Feedforward Velocity Command',
      icon: Sliders,
      badge: 'CONTROL',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10 border-sky-500/30',
      summary: 'Closed-loop controller generates smooth pan/tilt velocity commands.',
      explanation:
        'Proportional gain provides immediate restoring force, Integral removes steady-state bias (anti-windup clamped), Derivative dampens overshoot, and Kalman Velocity Feedforward directly cancels target movement.',
      liveKey: 'Gimbal Rate Commands',
      liveValue: data ? `Pan Rate: ${data.cmdPanRate >= 0 ? '+' : ''}${data.cmdPanRate.toFixed(2)}°/s | Tilt Rate: ${data.cmdTiltRate >= 0 ? '+' : ''}${data.cmdTiltRate.toFixed(2)}°/s` : '0.00°/s',
      detail: data ? `Pan Terms: P: ${data.pidTerms.pPan.toFixed(2)} | I: ${data.pidTerms.iPan.toFixed(2)} | D: ${data.pidTerms.dPan.toFixed(2)} | FF: ${data.pidTerms.ffPan.toFixed(2)}` : 'Gains Idle',
    },
    {
      num: 8,
      id: 'gimbal_actuation',
      title: 'Virtual Gimbal Follows the Target',
      icon: RotateCw,
      badge: 'ACTUATION',
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10 border-teal-500/30',
      summary: 'Coarse gimbal steers optical payload towards target line-of-sight.',
      explanation:
        'The virtual coarse tracking gimbal integrates velocity commands over time, respecting physical acceleration and slew rate limits (±35°/s Pan, ±25°/s Tilt). As the gimbal rotates, the target moves toward the center of the camera FOV.',
      liveKey: 'Control Decision',
      liveValue: data ? `${data.movementReason.panAction} & ${data.movementReason.tiltAction}` : 'Holding Position',
      detail: data ? `${data.movementReason.horizontalOffset}, ${data.movementReason.verticalOffset}` : 'Boresight aligned',
    },
    {
      num: 9,
      id: 'fsm_lock_arbitration',
      title: 'FSM Status: SEARCHING → TRACKING → LOCKED / COASTING',
      icon: ShieldCheck,
      badge: 'ARBITRATION',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/30',
      summary: 'Finite State Machine monitors link health and arbitrates tracking states.',
      explanation:
        'When total pointing error is < 0.22° (coarse link cone) with detection confidence >= 70% sustained for 6 consecutive frames, the link transitions to LOCKED. If signal is occluded, it COASTS on Kalman velocity before timing out.',
      liveKey: 'Current FSM State',
      liveValue: fsmState,
      detail: data ? data.fsmReason.reasonText : 'Operating autonomously',
    },
  ];

  const current = steps[activeStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                  HOW IS IT TRACKING?
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                  9-STAGE TRANSPARENCY PROTOCOL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive step-by-step visual explanation of the real-time optical tracking pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Navigation Bar */}
        <div className="flex items-center gap-1 px-6 py-3 bg-slate-950/60 border-b border-slate-800 overflow-x-auto text-xs">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = idx === activeStep;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 transition-all cursor-pointer font-bold ${
                  isCurrent
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100 border border-slate-700/50'
                }`}
              >
                <span className="text-[11px] opacity-80">{s.num}.</span>
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{s.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Step Card */}
          <div className={`p-5 rounded-xl border ${current.bgColor} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center font-bold text-sm text-cyan-400">
                  {current.num}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{current.title}</h3>
                  <div className="text-xs text-slate-400">{current.summary}</div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded text-[11px] font-bold border ${current.bgColor} ${current.color}`}>
                STAGE {current.num} OF 9
              </span>
            </div>

            {/* Explanation Body */}
            <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
              {current.explanation}
            </div>

            {/* Live Pipeline Value Readout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                  LIVE PIPELINE MEASUREMENT ({current.liveKey})
                </div>
                <div className={`text-sm font-bold ${current.color} font-mono break-all`}>
                  {current.liveValue}
                </div>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                  MATHEMATICAL / ALGORITHMIC DETAIL
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  {current.detail}
                </div>
              </div>
            </div>
          </div>

          {/* Complete 9-Stage Visual Flow Schematic */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              END-TO-END PAT TRACKING CHAIN ARCHITECTURE
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 text-[10px] text-center">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const isCurrent = idx === activeStep;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveStep(idx)}
                    className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 ring-1 ring-cyan-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-bold truncate w-full">{s.num}. {s.badge}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Track Health Criteria Check */}
          {data && (
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-slate-300">ACTIVE TRACK QUALITY CHECKS:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800">
                  {data.qualityChecks.detectionValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>Detection: {data.qualityChecks.detectionValid ? 'VALID' : 'SEARCHING'}</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800">
                  {data.qualityChecks.predictionConverged ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Kalman: {data.qualityChecks.predictionConverged ? 'CONVERGED' : 'HIGH VARIANCE'}</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800">
                  {data.qualityChecks.angularWithinCone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-cyan-400" />
                  )}
                  <span>Cone: {data.qualityChecks.angularWithinCone ? '< 0.22° LINK' : 'COARSE'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/90 text-xs">
          <button
            onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
            disabled={activeStep === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>PREVIOUS STAGE</span>
          </button>

          <div className="text-slate-400 text-xs">
            Step <span className="text-cyan-400 font-bold">{activeStep + 1}</span> of {steps.length}
          </div>

          <button
            onClick={() => setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))}
            disabled={activeStep === steps.length - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span>NEXT STAGE</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
