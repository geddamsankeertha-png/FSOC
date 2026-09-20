import React, { useRef, useEffect, useState } from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import { TrackingStatus } from '../types';
import { Crosshair, Eye, ShieldAlert, Zap, Layers, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface SyntheticCameraFeedProps {
  engine: FSOCSimulationEngine;
}

export const SyntheticCameraFeed: React.FC<SyntheticCameraFeedProps> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showKalmanVector, setShowKalmanVector] = useState(true);
  const [colorTheme, setColorTheme] = useState<'emerald' | 'flir' | 'mono'>('emerald');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Color themes for the optical sensor
      const themeColors = {
        emerald: {
          bg: '#04100c',
          grid: 'rgba(16, 185, 129, 0.08)',
          hud: '#10b981',
          hudDim: 'rgba(16, 185, 129, 0.4)',
          beaconGlow: 'rgba(52, 211, 153, 0.8)',
          beaconCore: '#ffffff',
          targetBox: '#10b981',
          errorLine: '#f59e0b',
        },
        flir: {
          bg: '#09090b',
          grid: 'rgba(234, 88, 12, 0.08)',
          hud: '#f97316',
          hudDim: 'rgba(249, 115, 22, 0.4)',
          beaconGlow: 'rgba(251, 146, 60, 0.9)',
          beaconCore: '#ffffff',
          targetBox: '#f97316',
          errorLine: '#ec4899',
        },
        mono: {
          bg: '#080c14',
          grid: 'rgba(56, 189, 248, 0.08)',
          hud: '#38bdf8',
          hudDim: 'rgba(56, 189, 248, 0.4)',
          beaconGlow: 'rgba(96, 165, 250, 0.85)',
          beaconCore: '#ffffff',
          targetBox: '#38bdf8',
          errorLine: '#fbbf24',
        },
      }[colorTheme];

      // 1. Clear Sensor Background
      ctx.fillStyle = themeColors.bg;
      ctx.fillRect(0, 0, w, h);

      // 2. Synthetic Sensor Noise Texture (Optimized grain rendering)
      const noisePercent = engine.disturbanceConfig.sensorNoisePercent;
      if (noisePercent > 0) {
        const noiseDots = Math.min(100, Math.floor((w * h * noisePercent) / 18000));
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.22, noisePercent * 0.005 + 0.04)})`;
        for (let i = 0; i < noiseDots; i++) {
          const nx = Math.random() * w;
          const ny = Math.random() * h;
          ctx.fillRect(nx, ny, 1.5, 1.5);
        }
      }

      // 3. Grid Scan Lines & Framing
      if (showOverlays) {
        ctx.strokeStyle = themeColors.grid;
        ctx.lineWidth = 1;
        const step = 64;
        for (let x = 0; x <= w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }

      // Keep the camera frame fixed while allowing the tracked scene to be inspected at a larger scale.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      // 4. Optical Center Reticle & Link Acceptance Cone
      // Acceptance cone: fine link threshold = 0.22 deg -> in pixels:
      const fx = (w / 2) / Math.tan((engine.cameraConfig.fovXDeg * Math.PI) / 360);
      const linkTolerancePx = fx * Math.tan((0.22 * Math.PI) / 180);

      // Fine pointing lock ring
      ctx.strokeStyle = engine.currentTelemetry.isLocked ? themeColors.hud : themeColors.hudDim;
      ctx.lineWidth = engine.currentTelemetry.isLocked ? 2 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(12, linkTolerancePx), 0, Math.PI * 2);
      ctx.stroke();

      // Outer coarse acquisition ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.stroke();

      // Optical Center Crosshairs
      ctx.strokeStyle = themeColors.hud;
      ctx.lineWidth = 1.2;
      const crossSize = 18;
      const crossGap = 5;

      // Left line
      ctx.beginPath();
      ctx.moveTo(cx - crossSize - crossGap, cy);
      ctx.lineTo(cx - crossGap, cy);
      ctx.stroke();

      // Right line
      ctx.beginPath();
      ctx.moveTo(cx + crossGap, cy);
      ctx.lineTo(cx + crossSize + crossGap, cy);
      ctx.stroke();

      // Top line
      ctx.beginPath();
      ctx.moveTo(cx, cy - crossSize - crossGap);
      ctx.lineTo(cx, cy - crossGap);
      ctx.stroke();

      // Bottom line
      ctx.beginPath();
      ctx.moveTo(cx, cy + crossGap);
      ctx.lineTo(cx, cy + crossSize + crossGap);
      ctx.stroke();

      // Center precision point
      ctx.fillStyle = themeColors.hud;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = themeColors.hud;
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText('BORESIGHT / SETPOINT', cx + 24, cy - 24);

      // 5. Render Decoys / Glints if active
      if (engine.targetConfig.multiTargetClutter) {
        engine.targetState.decoys.forEach((decoy) => {
          const decoyProj = engine.projectWorldToScreen(decoy.panDeg, decoy.tiltDeg);
          if (decoyProj.inFov) {
            ctx.fillStyle = `rgba(244, 63, 94, ${decoy.intensity * 0.4})`;
            ctx.beginPath();
            ctx.arc(decoyProj.x, decoyProj.y, 14, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(decoyProj.x, decoyProj.y, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Decoy tag
            ctx.fillStyle = 'rgba(244, 63, 94, 0.8)';
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.fillText(`CLUTTER ${decoy.id}`, decoyProj.x + 8, decoyProj.y - 6);
          }
        });
      }

      // 6. Render Ground-Truth Optical Beacon (Point Spread Function + Scintillation)
      const gt = engine.currentTelemetry.groundTruthScreen;
      const isOccluded = engine.targetState.isOccluded;

      if (gt.inFov && !isOccluded) {
        const blur = engine.disturbanceConfig.opticalBlurPx;
        const intensity = engine.targetState.intensity;

        // Outer diffraction halo
        const grad = ctx.createRadialGradient(
          gt.x,
          gt.y,
          1,
          gt.x,
          gt.y,
          24 + blur * 4
        );
        grad.addColorStop(0, themeColors.beaconCore);
        grad.addColorStop(0.15, themeColors.beaconGlow);
        grad.addColorStop(0.5, `rgba(16, 185, 129, ${0.35 * intensity})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gt.x, gt.y, 28 + blur * 4, 0, Math.PI * 2);
        ctx.fill();

        // Laser central spot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gt.x, gt.y, Math.max(2, 4 + blur * 0.5), 0, Math.PI * 2);
        ctx.fill();

        // Laser link beam bloom spikes (diffraction spikes)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * intensity})`;
        ctx.lineWidth = 1;
        const spikeLen = 14 + blur * 3;
        ctx.beginPath();
        ctx.moveTo(gt.x - spikeLen, gt.y);
        ctx.lineTo(gt.x + spikeLen, gt.y);
        ctx.moveTo(gt.x, gt.y - spikeLen);
        ctx.lineTo(gt.x, gt.y + spikeLen);
        ctx.stroke();

        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(gt.x, gt.y, 11 + blur, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('TARGET', gt.x + 14, gt.y - 10);
      }

      // 7. Render Detection Bounding Box & Centroid Marker
      const detection = engine.currentDetection;
      if (detection.detected && detection.boundingBox && detection.centroid) {
        const box = detection.boundingBox;
        const mode = detection.modeUsed;

        ctx.strokeStyle =
          mode === 'ai_neural'
            ? '#38bdf8'
            : mode === 'kalman_predictive'
            ? '#10b981'
            : '#eab308';
        ctx.lineWidth = 1.5;

        // Draw corner brackets around detected beacon
        const cornerLen = 7;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(box.x, box.y + cornerLen);
        ctx.lineTo(box.x, box.y);
        ctx.lineTo(box.x + cornerLen, box.y);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(box.x + box.width - cornerLen, box.y);
        ctx.lineTo(box.x + box.width, box.y);
        ctx.lineTo(box.x + box.width, box.y + cornerLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(box.x, box.y + box.height - cornerLen);
        ctx.lineTo(box.x, box.y + box.height);
        ctx.lineTo(box.x + cornerLen, box.y + box.height);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height);
        ctx.lineTo(box.x + box.width, box.y + box.height);
        ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen);
        ctx.stroke();

        // Label above box
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '10px JetBrains Mono, monospace';
        const labelText =
          mode === 'ai_neural'
            ? `AI BEACON ${(detection.confidence * 100).toFixed(0)}%`
            : mode === 'kalman_predictive'
            ? `KALMAN LOCK ${(detection.confidence * 100).toFixed(0)}%`
            : `CV CENTROID`;
        ctx.fillText(labelText, box.x, box.y - 6);

        // Detected Centroid Point
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(detection.centroid.x, detection.centroid.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(detection.centroid.x, detection.centroid.y, 9, 0, Math.PI * 2);
        ctx.stroke();

        // 8. Error Vector Line from Center to Detected Target
        if (showOverlays && (Math.abs(detection.centroid.x - cx) > 1 || Math.abs(detection.centroid.y - cy) > 1)) {
          ctx.strokeStyle = themeColors.errorLine;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(detection.centroid.x, detection.centroid.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Error Distance Label
          const midX = (cx + detection.centroid.x) / 2;
          const midY = (cy + detection.centroid.y) / 2;
          ctx.fillStyle = themeColors.errorLine;
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillText(
            `Δ ${engine.currentTelemetry.pixelError.toFixed(1)}px (${engine.currentTelemetry.angularErrorDeg.toFixed(2)}°)`,
            midX + 6,
            midY - 4
          );
        }
      }

      // 9. Kalman Filter Velocity & Prediction Vector
      const kState = engine.kalmanFilter.getState();
      if (showKalmanVector && kState.isInitialized) {
        const predAhead = engine.kalmanFilter.predictAhead(0.06); // 60ms prediction
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(kState.x, kState.y);
        ctx.lineTo(predAhead.x, predAhead.y);
        ctx.stroke();

        // Prediction Marker
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(predAhead.x, predAhead.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#c084fc';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText('EST VEL T+60ms', predAhead.x + 6, predAhead.y + 3);
      }

      // 10. Coasting / Reacquisition / Lost Alert
      if (engine.currentTelemetry.status === 'COASTING') {
        ctx.fillStyle = 'rgba(234, 179, 8, 0.85)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText('⚠ BEACON LOSS - COASTING ON KALMAN PREDICTION', cx - 150, 70);
      } else if (engine.currentTelemetry.status === 'REACQUIRING') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText('⚡ BEACON RE-DETECTED - REACQUIRING OPTICAL LOCK...', cx - 165, 70);
      } else if (engine.currentTelemetry.status === 'LOST') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.fillText('✖ TARGET OUT OF FOV - COARSE PAT SEARCHING...', cx - 155, 70);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, showOverlays, showKalmanVector, colorTheme, zoom]);

  const telemetry = engine.currentTelemetry;
  const isLocked = telemetry.isLocked;

  const getStatusBadgeStyle = (status: TrackingStatus) => {
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

  const getStatusDotColor = (status: TrackingStatus) => {
    switch (status) {
      case 'LOCKED':
        return 'bg-emerald-400';
      case 'TRACKING':
        return 'bg-cyan-400';
      case 'REACQUIRING':
        return 'bg-sky-400';
      case 'ACQUIRING':
        return 'bg-blue-400';
      case 'COASTING':
        return 'bg-purple-400';
      case 'SEARCHING':
        return 'bg-slate-400';
      case 'LOST':
        return 'bg-rose-500';
    }
  };

  const halfW = engine.cameraConfig.width / 2;
  const halfH = engine.cameraConfig.height / 2;
  const ex = telemetry.detectedScreen ? (telemetry.detectedScreen.x - halfW).toFixed(1) : '---';
  const ey = telemetry.detectedScreen ? (telemetry.detectedScreen.y - halfH).toFixed(1) : '---';

  return (
    <div id="synthetic-camera-container" className="relative flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top HUD Status Ribbon */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold tracking-wider text-slate-200">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            VIRTUAL OPTICAL SENSOR [CMOS-IR]
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            FOV: <strong className="text-slate-200">{engine.cameraConfig.fovXDeg}° × {engine.cameraConfig.fovYDeg}°</strong>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            RES: <strong className="text-slate-200">{engine.cameraConfig.width}×{engine.cameraConfig.height}</strong>
          </span>
        </div>

        {/* Lock State Indicator Badge */}
        <div className="flex items-center gap-3">
          <div
            id="lock-status-pill"
            className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider flex items-center gap-1.5 border whitespace-nowrap ${getStatusBadgeStyle(
              telemetry.status
            )}`}
          >
            <span className={`w-2 h-2 rounded-full ${getStatusDotColor(telemetry.status)}`} />
            {telemetry.status}
          </div>

          <div className="flex items-center gap-1 bg-slate-800/80 rounded px-2 py-1 text-slate-300">
            <span className="text-slate-400">FPS:</span>
            <span className="font-bold text-cyan-400">{telemetry.fps}</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative aspect-video w-full bg-black">
        <canvas
          ref={canvasRef}
          width={engine.cameraConfig.width}
          height={engine.cameraConfig.height}
          className="w-full h-full object-contain block"
        />

        {/* Tactical On-Screen Corner HUD Data */}
        <div className="absolute top-3 left-3 pointer-events-none font-mono text-[11px] space-y-0.5 bg-slate-950/70 p-2.5 rounded border border-slate-800/60 backdrop-blur-sm">
          <div className="text-cyan-400 font-bold flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> GIMBAL BORESIGHT
          </div>
          <div className="text-slate-300">PAN: <span className="text-emerald-400 font-semibold">{telemetry.cameraPanDeg >= 0 ? '+' : ''}{telemetry.cameraPanDeg.toFixed(2)}°</span></div>
          <div className="text-slate-300">TILT: <span className="text-emerald-400 font-semibold">{telemetry.cameraTiltDeg >= 0 ? '+' : ''}{telemetry.cameraTiltDeg.toFixed(2)}°</span></div>
          <div className="text-slate-400">JITTER: <span className="text-amber-400 font-semibold">±{engine.cameraState.jitterPanDeg.toFixed(2)}°</span></div>
        </div>

        <div className="absolute top-3 right-3 pointer-events-none font-mono text-[11px] space-y-0.5 bg-slate-950/70 p-2.5 rounded border border-slate-800/60 backdrop-blur-sm text-right">
          <div className="text-purple-400 font-bold flex items-center justify-end gap-1.5">
            <Eye className="w-3 h-3" /> PERCEPTION
          </div>
          <div className="text-slate-300">
            MODE: <span className="text-cyan-400 uppercase font-semibold">{engine.perceptionMode.replace('_', ' ')}</span>
          </div>
          <div className="text-slate-300">
            CONFIDENCE: <span className="text-emerald-400 font-semibold">{(engine.currentDetection.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="text-slate-400">
            SNR: <span className="text-amber-400 font-semibold">{engine.currentDetection.snrDb.toFixed(1)} dB</span>
          </div>
        </div>

        <div className="absolute bottom-3 left-3 pointer-events-none font-mono text-[11px] space-y-0.5 bg-slate-950/70 p-2.5 rounded border border-slate-800/60 backdrop-blur-sm">
          <div className="text-amber-400 font-bold">POINTING ALIGNMENT ERROR (SEC 8)</div>
          <div className="text-slate-200">
            OPTICAL: <span className={`font-bold ${telemetry.angularErrorDeg < 0.22 ? 'text-emerald-400' : 'text-rose-400'}`}>{telemetry.angularErrorDeg.toFixed(3)}°</span>
            <span className="text-slate-400 ml-1.5">({telemetry.angularErrorMrad.toFixed(2)} mrad)</span>
          </div>
          {telemetry.mechanicalPointingErrorDeg !== undefined && (
            <div className="text-slate-200">
              MECHANICAL: <span className={`font-bold ${telemetry.mechanicalPointingErrorDeg < 0.22 ? 'text-emerald-400' : 'text-amber-400'}`}>{telemetry.mechanicalPointingErrorDeg.toFixed(3)}°</span>
              <span className="text-slate-400 ml-1.5">({(telemetry.mechanicalPointingErrorDeg * 17.4533).toFixed(2)} mrad)</span>
            </div>
          )}
          <div className="text-slate-300">
            OFFSET: <span className="text-cyan-400 font-semibold">e_x: {ex} px, e_y: {ey} px</span> ({telemetry.pixelError.toFixed(1)} px)
          </div>
          <div className="text-slate-400 text-[10px]">
            CENTER: C_x={halfW}, C_y={halfH} | TOL: &lt;0.22° (~3.8 mrad)
          </div>
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 backdrop-blur text-xs">
          <button
            onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Zoom in on the tracking scene"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Zoom out on the tracking scene"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Fit the full camera view"
            aria-label="Fit to view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Reset view zoom"
            aria-label="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-[10px] text-slate-400 font-mono">{zoom.toFixed(2)}x</span>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <button
            id="toggle-overlays-btn"
            onClick={() => setShowOverlays(!showOverlays)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
              showOverlays ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Grid Overlay
          </button>
          <button
            id="toggle-kalman-btn"
            onClick={() => setShowKalmanVector(!showKalmanVector)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
              showKalmanVector ? 'bg-purple-950/80 text-purple-300 border border-purple-700/50' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Kalman Vector
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <div className="flex rounded bg-slate-800 p-0.5">
            {(['emerald', 'flir', 'mono'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setColorTheme(t)}
                className={`px-2 py-0.5 text-[10px] uppercase font-mono rounded ${
                  colorTheme === t ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-800 border-t border-slate-800 font-mono">
        <div className="bg-slate-950/90 px-3 py-2">
          <div className="text-[10px] text-slate-500 uppercase">Tracking State</div>
          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-100">
            <span className={`w-2 h-2 rounded-full ${getStatusDotColor(telemetry.status)}`} />
            {telemetry.status}
          </div>
        </div>
        <div className="bg-slate-950/90 px-3 py-2">
          <div className="text-[10px] text-slate-500 uppercase">Detection / SNR</div>
          <div className="mt-1 text-xs font-bold text-amber-300">
            {engine.currentDetection.detected ? 'DETECTED' : 'NOT DETECTED'} / {Number.isFinite(engine.currentDetection.snrDb) ? `${engine.currentDetection.snrDb.toFixed(1)} dB` : 'N/A'}
          </div>
        </div>
        <div className="bg-slate-950/90 px-3 py-2">
          <div className="text-[10px] text-slate-500 uppercase">Pointing Error</div>
          <div className={`mt-1 text-xs font-bold ${telemetry.angularErrorDeg < 0.22 ? 'text-emerald-300' : 'text-amber-300'}`}>
            {telemetry.angularErrorDeg.toFixed(3)}° / {telemetry.pixelError.toFixed(1)} px
          </div>
        </div>
        <div className="bg-slate-950/90 px-3 py-2">
          <div className="text-[10px] text-slate-500 uppercase">Marker Legend</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-300">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-white" />Target</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Detected</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-400" />Predicted</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Setpoint</span>
          </div>
        </div>
      </div>
    </div>
  );
};
