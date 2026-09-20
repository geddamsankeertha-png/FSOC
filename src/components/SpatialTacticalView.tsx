import React, { useRef, useEffect } from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import { Compass, Radio, Target, Navigation } from 'lucide-react';

interface SpatialTacticalViewProps {
  engine: FSOCSimulationEngine;
}

export const SpatialTacticalView: React.FC<SpatialTacticalViewProps> = ({ engine }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    const historyPoints: { x: number; y: number }[] = [];

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.82; // Place UAV-A near the bottom center for forward tactical projection

      // Clear Canvas
      ctx.fillStyle = '#060b13';
      ctx.fillRect(0, 0, w, h);

      // Radar Range Rings
      const maxRadius = Math.min(w * 0.45, h * 0.75);
      const ringSteps = [0.25, 0.5, 0.75, 1.0];

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.lineWidth = 1;
      ringSteps.forEach((step) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxRadius * step, Math.PI, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(`${(step * 5).toFixed(1)} km`, cx + 6, cy - maxRadius * step + 12);
      });

      // Azimuth Radial Guidelines (-45°, -30°, 0°, +30°, +45°)
      const angles = [-45, -30, -15, 0, 15, 30, 45];
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      angles.forEach((ang) => {
        const rad = ((ang - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(rad) * maxRadius, cy + Math.sin(rad) * maxRadius);
        ctx.stroke();

        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.font = '9px JetBrains Mono, monospace';
        const labelX = cx + Math.cos(rad) * (maxRadius + 14);
        const labelY = cy + Math.sin(rad) * (maxRadius + 14);
        ctx.fillText(`${ang}°`, labelX - 8, labelY + 3);
      });

      // Scale factors: Pan angle mapped to horizontal angular deviation
      // Target range fixed for tactical view at ~3.5 km
      const targetRangeNorm = 0.72;
      const targetDistance = maxRadius * targetRangeNorm;

      // Current UAV-B World Angle
      const targetPanRad = ((engine.targetState.panDeg - 90) * Math.PI) / 180;
      const targetX = cx + Math.cos(targetPanRad) * targetDistance;
      const targetY = cy + Math.sin(targetPanRad) * targetDistance;

      // Push history
      historyPoints.push({ x: targetX, y: targetY });
      if (historyPoints.length > 90) {
        historyPoints.shift();
      }

      // Draw UAV-B Trajectory Trail
      if (historyPoints.length > 1) {
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(historyPoints[0].x, historyPoints[0].y);
        for (let i = 1; i < historyPoints.length; i++) {
          ctx.lineTo(historyPoints[i].x, historyPoints[i].y);
        }
        ctx.stroke();
      }

      // Current Camera Pan Gimbal Orientation
      const camPanEff = engine.cameraState.panDeg + engine.cameraState.jitterPanDeg;
      const camPanRad = ((camPanEff - 90) * Math.PI) / 180;
      const halfFovRad = ((engine.cameraConfig.fovXDeg / 2) * Math.PI) / 180;

      // Draw Camera FOV Cone (Frustum)
      const fovConeLength = maxRadius * 1.05;
      const fovLeftRad = camPanRad - halfFovRad;
      const fovRightRad = camPanRad + halfFovRad;

      const fovGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, fovConeLength);
      fovGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      fovGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
      fovGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');

      ctx.fillStyle = fovGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, fovConeLength, fovLeftRad, fovRightRad);
      ctx.closePath();
      ctx.fill();

      // FOV Cone Bound Lines
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(fovLeftRad) * fovConeLength, cy + Math.sin(fovLeftRad) * fovConeLength);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(fovRightRad) * fovConeLength, cy + Math.sin(fovRightRad) * fovConeLength);
      ctx.stroke();

      // Gimbal Boresight Center Axis
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(camPanRad) * fovConeLength, cy + Math.sin(camPanRad) * fovConeLength);
      ctx.stroke();

      // Laser Communication Link Line (from UAV-A to UAV-B)
      const isLocked = engine.currentTelemetry.isLocked;
      const isOccluded = engine.targetState.isOccluded;

      if (!isOccluded) {
        if (isLocked) {
          // Fine laser link active (intense green beam)
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          // Laser beam glow
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
          ctx.lineWidth = 8;
          ctx.stroke();
        } else {
          // Searching / Misaligned (dashed amber/red line)
          ctx.strokeStyle = engine.currentTelemetry.groundTruthScreen.inFov ? '#f59e0b' : '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw Decoys if enabled
      if (engine.targetConfig.multiTargetClutter) {
        engine.targetState.decoys.forEach((decoy) => {
          const decoyPanRad = ((decoy.panDeg - 90) * Math.PI) / 180;
          const decoyDist = maxRadius * 0.68;
          const dx = cx + Math.cos(decoyPanRad) * decoyDist;
          const dy = cy + Math.sin(decoyPanRad) * decoyDist;

          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(244, 63, 94, 0.7)';
          ctx.font = '8px JetBrains Mono, monospace';
          ctx.fillText('CLUTTER', dx + 6, dy + 2);
        });
      }

      // Draw UAV-B (Remote Terminal with Beacon)
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Optical Beacon pulse ring around UAV-B
      const pulseRadius = 8 + 6 * Math.sin(engine.simTimeSec * 6);
      ctx.strokeStyle = isLocked ? '#22c55e' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(targetX, targetY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('UAV-B (BEACON)', targetX + 12, targetY - 4);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`AZ: ${engine.targetState.panDeg.toFixed(1)}°`, targetX + 12, targetY + 9);

      // Draw UAV-A (Receiver / Tracking Gimbal Terminal)
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('UAV-A (GIMBAL PAT)', cx - 60, cy + 22);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

  return (
    <div id="spatial-tactical-view" className="relative flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-200 font-bold">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          TACTICAL FSOC LINK GEOMETRY [TOP-DOWN AZIMUTH]
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            UAV-A Receiver
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            UAV-B Transmitter
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-[16/10] bg-black">
        <canvas
          ref={canvasRef}
          width={640}
          height={400}
          className="w-full h-full object-contain block"
        />

        {/* Legend Overlay */}
        <div className="absolute top-3 left-3 bg-slate-950/80 p-2 rounded border border-slate-800/60 font-mono text-[10px] space-y-1 text-slate-300">
          <div className="text-emerald-400 font-bold flex items-center gap-1">
            <Navigation className="w-3 h-3" /> LINK RADAR
          </div>
          <div>RANGE: ~3.5 km</div>
          <div>BEARING: {engine.targetState.panDeg.toFixed(1)}°</div>
          <div>GIMBAL SLEW: {engine.cameraState.panVelDegPerSec.toFixed(1)}°/s</div>
        </div>
      </div>
    </div>
  );
};
