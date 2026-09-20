import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WebcamTrackingEngine } from '../simulation/webcamTrackingEngine';
import { PerceptionMode, TrackingStatus } from '../types';
import {
  Camera,
  Play,
  Square,
  RotateCcw,
  Sliders,
  Crosshair,
  ShieldAlert,
  Zap,
  Layers,
  AlertTriangle,
  Settings,
  Eye,
  Activity,
  Compass,
  Download,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { TrackingExplainabilityPanel } from './TrackingExplainabilityPanel';
import { TrackingStepsModal } from './TrackingStepsModal';
import { CameraGeometryModal } from './CameraGeometryModal';
import { TrackingReplayModal } from './TrackingReplayModal';

interface LiveWebcamViewProps {
  engine: WebcamTrackingEngine;
  onOpenDemo?: () => void;
}

export const LiveWebcamView: React.FC<LiveWebcamViewProps> = ({ engine, onOpenDemo }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedResolution, setSelectedResolution] = useState<string>('1280x720');
  const [selectedFps, setSelectedFps] = useState<number>(30);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [showKalmanVector, setShowKalmanVector] = useState<boolean>(true);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState<boolean>(false);
  const [showDisturbancesPanel, setShowDisturbancesPanel] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<'cyan' | 'emerald' | 'amber'>('cyan');
  const [sensorViewMode, setSensorViewMode] = useState<'explainability' | 'normal' | 'gate' | 'mask'>('explainability');
  const [showHowItTracksModal, setShowHowItTracksModal] = useState<boolean>(false);
  const [showGeometryModal, setShowGeometryModal] = useState<boolean>(false);
  const [showReplayModal, setShowReplayModal] = useState<boolean>(false);
  const [, setTick] = useState(0);

  // Load available camera devices on mount
  useEffect(() => {
    engine.enumerateCameras().then((devs) => {
      const cameraList = devs || [];
      setCameras(cameraList);
      if (cameraList.length > 0 && !selectedCamera) {
        setSelectedCamera(cameraList[0].deviceId);
      }
    }).catch(() => {
      setCameras([]);
    });
  }, [engine, selectedCamera]);

  const handleStartWebcam = async () => {
    const [w, h] = selectedResolution.split('x').map(Number);
    await engine.startWebcam(selectedCamera || undefined, w, h, selectedFps);
    setTick((t) => t + 1);
  };

  const handleStopWebcam = () => {
    engine.stopWebcam();
    setTick((t) => t + 1);
  };

  const handleReset = () => {
    engine.reset();
    setTick((t) => t + 1);
  };

  // Main rendering loop for live webcam HUD
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      // Process live frame from webcam
      if (engine.isStreaming) {
        engine.processFrame();
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const cx = w / 2;
          const cy = h / 2;

          const theme = {
            cyan: {
              hud: '#38bdf8',
              hudDim: 'rgba(56, 189, 248, 0.4)',
              grid: 'rgba(56, 189, 248, 0.08)',
              lock: '#10b981',
              errorLine: '#f59e0b',
            },
            emerald: {
              hud: '#10b981',
              hudDim: 'rgba(16, 185, 129, 0.4)',
              grid: 'rgba(16, 185, 129, 0.08)',
              lock: '#34d399',
              errorLine: '#fbbf24',
            },
            amber: {
              hud: '#f59e0b',
              hudDim: 'rgba(245, 158, 11, 0.4)',
              grid: 'rgba(245, 158, 11, 0.08)',
              lock: '#10b981',
              errorLine: '#ef4444',
            },
          }[colorTheme];

          // 1. Draw live webcam frame or standby background
          if (engine.isStreaming && engine.videoElement && engine.videoElement.readyState >= 2) {
            ctx.drawImage(engine.videoElement, 0, 0, w, h);

            // Optional software disturbance overlay indication
            if (engine.disturbances.enabled) {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
              ctx.fillRect(0, 0, w, h);
            }
          } else {
            // Standby pattern
            ctx.fillStyle = '#050911';
            ctx.fillRect(0, 0, w, h);

            // Grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= w; x += 60) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, h);
              ctx.stroke();
            }
            for (let y = 0; y <= h; y += 60) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(w, y);
              ctx.stroke();
            }

            // Standby prompt
            ctx.fillStyle = '#64748b';
            ctx.font = '14px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(
              engine.isInitializing
                ? 'INITIALIZING REAL-TIME OPTICAL WEBCAM SENSOR...'
                : 'CAMERA STANDBY — CLICK "START WEBCAM" TO ACTIVATE LIVE TRACKING',
              cx,
              cy - 10
            );
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = '#475569';
            ctx.fillText('Demonstrator Target: Phone Flashlight, Bright LED, or Laser Spot', cx, cy + 18);
            ctx.textAlign = 'left';
          }

          // 2. Optical Center Reticle & Link Acceptance Cone (<0.22°)
          if (showOverlays) {
            // Fine link threshold ring: 0.22 deg
            const fx = (w / 2) / Math.tan((engine.config.fovXDeg * Math.PI) / 360);
            const linkTolerancePx = Math.max(14, fx * Math.tan((0.22 * Math.PI) / 180));

            ctx.strokeStyle = engine.fsmState === 'LOCKED' ? theme.lock : theme.hudDim;
            ctx.lineWidth = engine.fsmState === 'LOCKED' ? 2.2 : 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, linkTolerancePx, 0, Math.PI * 2);
            ctx.stroke();

            // Label for lock cone
            ctx.fillStyle = engine.fsmState === 'LOCKED' ? theme.lock : theme.hudDim;
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.fillText('0.22° LINK CONE', cx + linkTolerancePx + 6, cy - 4);

            // Center crosshair: + CENTER BORESIGHT
            ctx.strokeStyle = theme.hud;
            ctx.lineWidth = 1.4;
            const crossLen = 18;
            const gap = 5;

            ctx.beginPath();
            ctx.moveTo(cx - crossLen - gap, cy);
            ctx.lineTo(cx - gap, cy);
            ctx.moveTo(cx + gap, cy);
            ctx.lineTo(cx + crossLen + gap, cy);
            ctx.moveTo(cx, cy - crossLen - gap);
            ctx.lineTo(cx, cy - gap);
            ctx.moveTo(cx, cy + gap);
            ctx.lineTo(cx, cy + crossLen + gap);
            ctx.stroke();

            // Center precision dot
            ctx.fillStyle = theme.hud;
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Explicit Center Tag
            ctx.fillStyle = theme.hud;
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.fillText(`+ CENTER (${cx}, ${cy})`, cx + 12, cy - 8);
          }

          // 3. Render Detected Optical Target (Bounding Box, Centroid & Tag)
          const det = engine.currentDetection;
          if (det.detected && det.centroid && det.boundingBox) {
            const box = det.boundingBox;
            const isNeural = det.modeUsed === 'ai_neural' || det.modeUsed === 'kalman_predictive';

            ctx.strokeStyle = isNeural ? '#38bdf8' : '#eab308';
            ctx.lineWidth = 2;

            // Bracket corners
            const cl = 8;
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + cl);
            ctx.lineTo(box.x, box.y);
            ctx.lineTo(box.x + cl, box.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cl, box.y);
            ctx.lineTo(box.x + box.width, box.y);
            ctx.lineTo(box.x + box.width, box.y + cl);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + box.height - cl);
            ctx.lineTo(box.x, box.y + box.height);
            ctx.lineTo(box.x + cl, box.y + box.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(box.x + box.width - cl, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height);
            ctx.lineTo(box.x + box.width, box.y + box.height - cl);
            ctx.stroke();

            // Target Centroid Point: ● DETECTED
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(det.centroid.x, det.centroid.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Pulsing target halo
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(det.centroid.x, det.centroid.y, 8, 0, Math.PI * 2);
            ctx.stroke();

            // Tag Label: ● DETECTED
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 11px JetBrains Mono, monospace';
            const tag = `● DETECTED (${det.centroid.x.toFixed(0)}, ${det.centroid.y.toFixed(0)}) ${(det.confidence * 100).toFixed(0)}%`;
            ctx.fillText(tag, box.x, box.y - 7);

            // 4. Pointing Error Vector (from optical center to target)
            if (showOverlays && (Math.abs(det.centroid.x - cx) > 1 || Math.abs(det.centroid.y - cy) > 1)) {
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.6;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(det.centroid.x, det.centroid.y);
              ctx.stroke();
              ctx.setLineDash([]);

              // Angular error readout along vector
              const midX = (cx + det.centroid.x) / 2;
              const midY = (cy + det.centroid.y) / 2;
              const ang = engine.pixelToAngular(det.centroid.x, det.centroid.y);
              const dx = Math.round(det.centroid.x - cx);
              const dy = Math.round(det.centroid.y - cy);
              ctx.fillStyle = '#fbbf24';
              ctx.font = 'bold 10px JetBrains Mono, monospace';
              ctx.fillText(
                `Δ [X: ${dx >= 0 ? '+' : ''}${dx}px, Y: ${dy >= 0 ? '+' : ''}${dy}px] | θ: ${ang.totalAngularDeg.toFixed(2)}° (${ang.totalAngularMrad.toFixed(1)} mrad)`,
                midX + 8,
                midY - 4
              );
            }

            // Draw candidate clutter spots if any
            if (det.candidates && det.candidates.length > 1) {
              det.candidates.slice(1).forEach((cand) => {
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(cand.x, cand.y, 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
                ctx.font = '8px JetBrains Mono, monospace';
                ctx.fillText(`CAND ${cand.id}`, cand.x + 8, cand.y - 2);
              });
            }
          }

          // 5. Kalman Prediction Vector & Lookahead Indicator: ◇ PREDICTED
          const kState = engine.kalmanFilter.getState();
          if (showKalmanVector && kState.isInitialized) {
            const predAhead = engine.kalmanFilter.predictAhead(0.025); // 25ms forward lookahead
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(kState.x, kState.y);
            ctx.lineTo(predAhead.x, predAhead.y);
            ctx.stroke();

            // Predicted point: ◇ PREDICTED diamond glyph
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(predAhead.x, predAhead.y - 6);
            ctx.lineTo(predAhead.x + 6, predAhead.y);
            ctx.lineTo(predAhead.x, predAhead.y + 6);
            ctx.lineTo(predAhead.x - 6, predAhead.y);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = '#a855f7';
            ctx.fill();

            ctx.fillStyle = '#e9d5ff';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.fillText(`◇ PREDICTED T+25ms (${predAhead.x.toFixed(0)}, ${predAhead.y.toFixed(0)})`, predAhead.x + 10, predAhead.y + 4);

            // Kalman Search ROI / Track Gate (bounding box around predicted position)
            if (sensorViewMode === 'gate' || sensorViewMode === 'explainability') {
              const gateRadius = Math.max(24, Math.min(80, kState.covarianceTrace * 0.7));
              ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.strokeRect(predAhead.x - gateRadius, predAhead.y - gateRadius, gateRadius * 2, gateRadius * 2);
              ctx.setLineDash([]);
              ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
              ctx.font = '9px JetBrains Mono, monospace';
              ctx.fillText('KALMAN GATE', predAhead.x - gateRadius + 4, predAhead.y - gateRadius - 4);
            }
          }

          // 6. Optional Evaluation Reference Marker (Physical Ground Truth Measurement)
          if (engine.evalReference.enabled && engine.evalReference.detected) {
            const rx = engine.evalReference.screenX;
            const ry = engine.evalReference.screenY;

            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rx - 15, ry - 15, 30, 30);

            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.fillText('EVALUATION REFERENCE (GROUND TRUTH)', rx - 50, ry - 20);

            if (engine.evalReference.trueTrackingErrorDeg !== null) {
              ctx.fillStyle = '#22d3ee';
              ctx.fillText(
                `REAL ERROR: ${engine.evalReference.trueTrackingErrorDeg.toFixed(3)}° (${engine.evalReference.trueTrackingErrorMrad} mrad)`,
                rx - 50,
                ry + 28
              );
            }
          }

          // 7. FSM State Banners
          if (engine.fsmState === 'COASTING') {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
            ctx.font = 'bold 12px JetBrains Mono, monospace';
            ctx.fillText('⚠ BEACON LOSS — COASTING ON KALMAN VELOCITY LOOKAHEAD', cx - 180, 50);
          } else if (engine.fsmState === 'REACQUIRING') {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
            ctx.font = 'bold 12px JetBrains Mono, monospace';
            ctx.fillText('⚡ BEACON RE-DETECTED — REACQUIRING COARSE OPTICAL LOCK...', cx - 190, 50);
          } else if (engine.fsmState === 'LOCKED') {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
            ctx.font = 'bold 12px JetBrains Mono, monospace';
            ctx.fillText('● COARSE OPTICAL LINK LOCKED (<0.22° TOLERANCE)', cx - 150, 50);
          }
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [engine, showOverlays, showKalmanVector, colorTheme]);

  const tele = engine.currentTelemetry;

  const getStatusBadge = (status: TrackingStatus) => {
    switch (status) {
      case 'LOCKED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse';
      case 'TRACKING':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'REACQUIRING':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse';
      case 'ACQUIRING':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'COASTING':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse';
      case 'SEARCHING':
        return 'bg-slate-700/30 text-slate-400 border-slate-700/50';
      case 'LOST':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    }
  };

  return (
    <div id="live-webcam-container" className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Header & Stream Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/90 border-b border-slate-800 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          {/* Start/Stop Button */}
          {!engine.isStreaming ? (
            <button
              id="btn-start-webcam"
              onClick={handleStartWebcam}
              disabled={engine.isInitializing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{engine.isInitializing ? 'INITIALIZING...' : 'START WEBCAM'}</span>
            </button>
          ) : (
            <button
              id="btn-stop-webcam"
              onClick={handleStopWebcam}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 font-bold transition-all shadow cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP WEBCAM</span>
            </button>
          )}

          <button
            id="btn-reset-webcam-tracker"
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>

          {/* Quick Drop / Obstruct Button */}
          <button
            id="btn-test-dropout"
            onClick={() => {
              engine.disturbances.dropoutActive = !engine.disturbances.dropoutActive;
              setTick((t) => t + 1);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              engine.disturbances.dropoutActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Simulate beacon occlusion / cloud dropout to test Kalman coasting"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{engine.disturbances.dropoutActive ? 'SIGNAL DROPOUT ACTIVE' : 'OBSTRUCT BEAM'}</span>
          </button>

          {/* Camera Selection Dropdown */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              disabled={engine.isStreaming}
              className="bg-transparent text-slate-300 outline-none text-xs cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
            >
              {(cameras || []).length === 0 ? (
                <option value="">Default / Auto Camera</option>
              ) : (
                cameras.map((cam, idx) => (
                  <option key={cam.deviceId || idx} value={cam.deviceId} className="bg-slate-900 text-slate-200">
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Resolution Dropdown */}
          <select
            value={selectedResolution}
            onChange={(e) => setSelectedResolution(e.target.value)}
            disabled={engine.isStreaming}
            className="bg-slate-950 text-slate-300 px-2 py-1 rounded-lg border border-slate-800 outline-none text-xs cursor-pointer"
          >
            <option value="640x480">640 × 480 (SD)</option>
            <option value="1280x720">1280 × 720 (HD)</option>
            <option value="1920x1080">1920 × 1080 (FHD)</option>
          </select>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Perception Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                engine.perceptionMode = 'classical_cv';
                setTick((t) => t + 1);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                engine.perceptionMode === 'classical_cv'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Classical CV
            </button>
            <button
              onClick={() => {
                engine.perceptionMode = 'ai_neural';
                setTick((t) => t + 1);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                engine.perceptionMode === 'ai_neural'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AI Neural
            </button>
            <button
              onClick={() => {
                engine.perceptionMode = 'kalman_predictive';
                setTick((t) => t + 1);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                engine.perceptionMode === 'kalman_predictive'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AI + Kalman
            </button>
          </div>

          {/* Toggle Panels */}
          <button
            onClick={() => setShowDisturbancesPanel(!showDisturbancesPanel)}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              showDisturbancesPanel || engine.disturbances.enabled
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Controlled Live Software Disturbances (Noise, Blur, Vibration)"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowCalibrationPanel(!showCalibrationPanel)}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              showCalibrationPanel
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Camera Calibration (FOV, Principal Point, Radial Distortion)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {onOpenDemo && (
            <button
              onClick={onOpenDemo}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shadow"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>LIVE DEMO</span>
            </button>
          )}
        </div>
      </div>

      {/* Camera Error Banner */}
      {engine.error && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{engine.error}</span>
        </div>
      )}

      {/* Collapsible Software Disturbances Panel */}
      {showDisturbancesPanel && (
        <div className="p-4 bg-slate-950/95 border-b border-slate-800 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-rose-400 uppercase tracking-wide">
                LIVE CAMERA + SOFTWARE DISTURBANCE (Section 5 Testing)
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Approximation
              </span>
            </div>
            <button
              onClick={() => {
                engine.disturbances.enabled = !engine.disturbances.enabled;
                setTick((t) => t + 1);
              }}
              className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer ${
                engine.disturbances.enabled
                  ? 'bg-rose-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {engine.disturbances.enabled ? 'DISTURBANCES ACTIVE' : 'ENABLE DISTURBANCES'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
            {/* Additive Noise */}
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Sensor Noise</span>
                <span className="text-cyan-400 font-bold">{engine.disturbances.noisePercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={engine.disturbances.noisePercent}
                onChange={(e) => {
                  engine.disturbances.noisePercent = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Optical Defocus Blur */}
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Defocus Blur</span>
                <span className="text-purple-400 font-bold">{engine.disturbances.blurPx.toFixed(1)} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={engine.disturbances.blurPx}
                onChange={(e) => {
                  engine.disturbances.blurPx = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Synthetic Platform Vibration */}
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Synthetic Vibration</span>
                <span className="text-amber-400 font-bold">±{engine.disturbances.syntheticVibrationPx} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={engine.disturbances.syntheticVibrationPx}
                onChange={(e) => {
                  engine.disturbances.syntheticVibrationPx = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Contrast / Attenuation */}
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Atmospheric Haze / Contrast</span>
                <span className="text-emerald-400 font-bold">{engine.disturbances.contrastPercent}%</span>
              </div>
              <input
                type="range"
                min="-60"
                max="40"
                value={engine.disturbances.contrastPercent}
                onChange={(e) => {
                  engine.disturbances.contrastPercent = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Camera Calibration Panel */}
      {showCalibrationPanel && (
        <div className="p-4 bg-slate-950/95 border-b border-slate-800 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-400 uppercase tracking-wide">
              CAMERA INTRINSICS & PINHOLE CALIBRATION
            </span>
            <button
              onClick={() => {
                engine.config.fovXDeg = 72.0;
                engine.config.fovYDeg = 44.0;
                engine.config.k1Distortion = 0;
                engine.config.principalPoint = {
                  cx: engine.config.actualWidth / 2,
                  cy: engine.config.actualHeight / 2,
                };
                setTick((t) => t + 1);
              }}
              className="text-[10px] text-slate-400 hover:text-cyan-300 underline cursor-pointer"
            >
              Reset to 72° Standard WebCam
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Horizontal FOV (H-FOV)</span>
                <span className="text-cyan-400 font-bold">{engine.config.fovXDeg.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="35"
                max="110"
                step="0.5"
                value={engine.config.fovXDeg}
                onChange={(e) => {
                  engine.config.fovXDeg = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Vertical FOV (V-FOV)</span>
                <span className="text-cyan-400 font-bold">{engine.config.fovYDeg.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="20"
                max="85"
                step="0.5"
                value={engine.config.fovYDeg}
                onChange={(e) => {
                  engine.config.fovYDeg = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
              <div className="flex justify-between text-slate-300">
                <span>Radial Distortion (k1)</span>
                <span className="text-purple-400 font-bold">{engine.config.k1Distortion.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="-0.2"
                max="0.2"
                step="0.005"
                value={engine.config.k1Distortion}
                onChange={(e) => {
                  engine.config.k1Distortion = Number(e.target.value);
                  setTick((t) => t + 1);
                }}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-300 font-semibold">Evaluation Reference</div>
                <div className="text-[9px] text-slate-500">Measures physical ground-truth error</div>
              </div>
              <button
                onClick={() => {
                  engine.evalReference.enabled = !engine.evalReference.enabled;
                  setTick((t) => t + 1);
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer ${
                  engine.evalReference.enabled
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {engine.evalReference.enabled ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain block"
        />

        {/* Top HUD Badges Overlay */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-xs font-mono">
          {/* Left Status Group */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${getStatusBadge(engine.fsmState)}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-ping" />
              <span>{engine.fsmState}</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-500">CONF:</span>
              <span className="text-cyan-400 font-bold">{(engine.currentDetection.confidence * 100).toFixed(0)}%</span>
            </div>

            {engine.fsmState === 'LOCKED' && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-1 rounded-lg text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>&lt; 0.22° FINE LINK</span>
              </div>
            )}
          </div>

          {/* Center Mode Switcher Pills */}
          <div className="pointer-events-auto flex items-center bg-slate-950/90 p-0.5 rounded-lg border border-slate-800 shadow-md">
            {(
              [
                { id: 'explainability', label: 'EXPLAIN HUD' },
                { id: 'normal', label: 'CLEAN' },
                { id: 'gate', label: 'GATE ROI' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSensorViewMode(mode.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  sensorViewMode === mode.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Right Metrics Readout */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-2">
              <span className="text-slate-500">FPS:</span>
              <span className="text-emerald-400 font-bold">{tele?.fps || engine.metrics.currentFps}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-lg text-slate-300 flex items-center gap-2">
              <span className="text-slate-500">LATENCY:</span>
              <span className="text-amber-400 font-bold">{tele?.latencyMs || engine.metrics.averageLatencyMs} ms</span>
            </div>
          </div>
        </div>

        {/* Bottom Error & Virtual Gimbal Readout Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-xs font-mono">
          <div className="bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-slate-200 flex items-center gap-3">
            <div>
              <span className="text-slate-500 text-[10px]">POINTING ERROR: </span>
              <span className="text-cyan-400 font-bold">
                {tele ? `${tele.angularErrorDeg.toFixed(2)}° (${tele.angularErrorMrad.toFixed(1)} mrad)` : '0.00°'}
              </span>
            </div>
            <div className="hidden sm:inline border-l border-slate-800 pl-3">
              <span className="text-slate-500 text-[10px]">PIXEL OFFSET: </span>
              <span className="text-amber-400 font-bold">{tele ? `${tele.pixelError} px` : '0 px'}</span>
            </div>
          </div>

          <div className="bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-slate-200 flex items-center gap-3">
            <div>
              <span className="text-slate-500 text-[10px]">VIRTUAL GIMBAL: </span>
              <span className="text-emerald-400 font-bold">
                P: {engine.virtualGimbal.panDeg.toFixed(1)}° / T: {engine.virtualGimbal.tiltDeg.toFixed(1)}°
              </span>
            </div>
            <div className="hidden md:inline border-l border-slate-800 pl-3 text-slate-400 text-[10px]">
              RATE: {engine.virtualGimbal.panVelDegPerSec.toFixed(1)}°/s
            </div>
          </div>
        </div>
      </div>

      {/* Performance Summary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-3 bg-slate-950 border-t border-slate-800 font-mono text-xs">
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <div className="text-[10px] text-slate-400">FRAMES PROCESSED</div>
          <div className="text-base font-bold text-slate-200">{engine.metrics.framesProcessed}</div>
          <div className="text-[9px] text-slate-500">Real camera feed</div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <div className="text-[10px] text-slate-400">DETECTION RATE</div>
          <div className="text-base font-bold text-cyan-400">{engine.metrics.detectionRate}%</div>
          <div className="text-[9px] text-slate-500">Avg Conf: {engine.metrics.averageConfidence}</div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <div className="text-[10px] text-slate-400">LOCK RETENTION (POST-LOCK)</div>
          <div className="text-base font-bold text-emerald-400">{engine.metrics.lockRetentionRate}%</div>
          <div className="text-[9px] text-slate-500">{engine.metrics.lockDurationSec.toFixed(1)}s total lock</div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <div className="text-[10px] text-slate-400">LOCK LOSSES</div>
          <div className="text-base font-bold text-amber-400">{engine.metrics.lockLossCount}</div>
          <div className="text-[9px] text-slate-500">
            {engine.metrics.reacquisitionTimeSec !== null ? `Reacq: ${engine.metrics.reacquisitionTimeSec}s` : 'Zero Reacq'}
          </div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <div className="text-[10px] text-slate-400">TIME TO 1ST LOCK</div>
          <div className="text-base font-bold text-purple-400">
            {engine.metrics.timeToFirstLockSec !== null ? `${engine.metrics.timeToFirstLockSec}s` : 'SEARCHING'}
          </div>
          <div className="text-[9px] text-slate-500">
            {engine.metrics.timeToFirstDetectionSec !== null ? `Det: ${engine.metrics.timeToFirstDetectionSec}s` : 'Waiting'}
          </div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <div className="text-[10px] text-slate-400">P95 LATENCY</div>
          <div className="text-base font-bold text-sky-400">{engine.metrics.p95LatencyMs} ms</div>
          <div className="text-[9px] text-slate-500">Avg: {engine.metrics.averageLatencyMs} ms</div>
        </div>

        <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400">DATA EXPORT</div>
          <div className="flex items-center gap-1.5 mt-1">
            <button
              onClick={() => engine.exportCSV()}
              className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold transition-colors cursor-pointer"
              title="Download Live Telemetry as CSV"
            >
              CSV
            </button>
            <button
              onClick={() => engine.exportJSON()}
              className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold transition-colors cursor-pointer"
              title="Download Telemetry & Calibration as JSON"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* 8. Tracking Explainability Panel (Transparent Diagnostics & Decision Engine) */}
      <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800">
        <TrackingExplainabilityPanel
          data={engine.getExplainabilityData()}
          currentTelemetry={engine.currentTelemetry}
          events={engine.events || []}
          cameraConfig={engine.config}
          fsmState={engine.fsmState}
          onOpenHowItTracks={() => setShowHowItTracksModal(true)}
          onOpenGeometry={() => setShowGeometryModal(true)}
          onOpenReplay={() => setShowReplayModal(true)}
        />
      </div>

      {/* Modal 1: 9-Stage Tracking Process Transparency Guide */}
      {showHowItTracksModal && (
        <TrackingStepsModal
          isOpen={showHowItTracksModal}
          onClose={() => setShowHowItTracksModal(false)}
          data={engine.getExplainabilityData()}
          fsmState={engine.fsmState}
        />
      )}

      {/* Modal 2: 3D Camera Geometry & Ray Tracing Inspector */}
      {showGeometryModal && (
        <CameraGeometryModal
          isOpen={showGeometryModal}
          onClose={() => setShowGeometryModal(false)}
          cameraConfig={engine.config}
          data={engine.getExplainabilityData()}
        />
      )}

      {/* Modal 3: Frame-by-Frame Tracking Scrubber & Replay Inspector */}
      {showReplayModal && (
        <TrackingReplayModal
          isOpen={showReplayModal}
          onClose={() => setShowReplayModal(false)}
          replayBuffer={engine.replayBuffer}
        />
      )}
    </div>
  );
};
