import React, { useRef, useEffect } from 'react';
import { X, Eye, Compass, Crosshair } from 'lucide-react';
import { TrackingExplainabilityData, CameraConfig, WebcamConfig } from '../types';

interface CameraGeometryModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TrackingExplainabilityData | null;
  cameraConfig: CameraConfig | WebcamConfig;
}

export const CameraGeometryModal: React.FC<CameraGeometryModalProps> = ({
  isOpen,
  onClose,
  data,
  cameraConfig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageWidth = 'actualWidth' in cameraConfig ? cameraConfig.actualWidth : cameraConfig.width;
  const imageHeight = 'actualHeight' in cameraConfig ? cameraConfig.actualHeight : cameraConfig.height;

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // Grid background
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Origin / Camera Aperture at Left Center
      const camX = 70;
      const camY = h / 2;

      // Focal Plane / Sensor Array at Right
      const sensorX = w - 160;
      const sensorTop = 40;
      const sensorBottom = h - 40;
      const sensorHeight = sensorBottom - sensorTop;
      const sensorCenterY = (sensorTop + sensorBottom) / 2;

      // 1. Draw Optical Axis (Boresight Center Z)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(camX, camY);
      ctx.lineTo(sensorX + 50, camY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText('OPTICAL BORESIGHT AXIS [0, 0, 1]', camX + 80, camY - 10);

      // 2. Camera Lens/Aperture Symbol
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(camX, camY, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(camX, camY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('CAMERA PINHOLE', camX - 45, camY + 28);
      ctx.fillText('(0, 0, 0)', camX - 22, camY + 40);

      // 3. Sensor Plane
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.fillRect(sensorX, sensorTop, 18, sensorHeight);
      ctx.strokeRect(sensorX, sensorTop, 18, sensorHeight);

      // Sensor optical center point
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(sensorX + 9, sensorCenterY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('+ (cx, cy)', sensorX + 24, sensorCenterY + 4);

      // 4. Acceptance Cone (0.22°)
      const coneHalfAngleRad = (0.22 * Math.PI) / 180;
      const coneRadiusAtSensor = (sensorX - camX) * Math.tan(coneHalfAngleRad);

      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(camX, camY);
      ctx.lineTo(sensorX + 9, sensorCenterY - Math.max(12, coneRadiusAtSensor * 6));
      ctx.lineTo(sensorX + 9, sensorCenterY + Math.max(12, coneRadiusAtSensor * 6));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#10b981';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('0.22° LINK CONE', sensorX - 95, sensorCenterY - Math.max(12, coneRadiusAtSensor * 6) - 4);

      // 5. Target Point & Line of Sight Vector
      const pxErrY = data ? data.pixelErrorY : 40;
      const targetSensorY = sensorCenterY + Math.max(-100, Math.min(100, pxErrY * 0.8));

      // Line of sight ray
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(camX, camY);
      ctx.lineTo(sensorX + 9, targetSensorY);
      ctx.stroke();

      // Target Spot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(sensorX + 9, targetSensorY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText('● TARGET BEACON', sensorX + 24, targetSensorY - 4);

      // Error Vector Δy on Sensor
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sensorX + 9, sensorCenterY);
      ctx.lineTo(sensorX + 9, targetSensorY);
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`Δpx: ${data ? data.pixelErrorY : 0} px`, sensorX - 85, (sensorCenterY + targetSensorY) / 2);

      // Arc for Angular Error
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const angleRad = Math.atan2(targetSensorY - camY, sensorX - camX);
      ctx.arc(camX, camY, 65, Math.min(0, angleRad), Math.max(0, angleRad));
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      const degText = data ? `θ = ${data.totalAngularDeg.toFixed(2)}° (${data.totalAngularMrad.toFixed(1)} mrad)` : 'θ = 0.00°';
      ctx.fillText(degText, camX + 75, (camY + targetSensorY) / 2 + 10);
    };

    render();
  }, [isOpen, data, cameraConfig]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                  3D CAMERA PINHOLE GEOMETRY & ANGULAR MAPPING
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  OPTICAL INTRINSICS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rigorous mathematical transformation from 2D pixel sensor coordinates to 3D line-of-sight vector
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Canvas Ray Diagram */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                OPTICAL RAY-TRACING & PROJECTION DIAGRAM
              </span>
              <span className="text-[11px] text-slate-400">
                Focal Length: fx = {((imageWidth / 2) / Math.tan((cameraConfig.fovXDeg * Math.PI) / 360)).toFixed(1)} px
              </span>
            </div>

            <canvas
              ref={canvasRef}
              width={800}
              height={260}
              className="w-full h-56 rounded-lg bg-[#090d16] border border-slate-800"
            />
          </div>

          {/* Mathematical Formulations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Pinhole Model & Focal Length */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                1. CAMERA INTRINSICS & FOCAL LENGTH
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                The optical focal length (f) is mathematically computed from the camera field-of-view (FOV) and image sensor dimensions:
              </p>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300">
                fx = (W / 2) / tan(H_FOV / 2)<br />
                fy = (H / 2) / tan(V_FOV / 2)
              </div>
              <div className="text-[11px] text-slate-400">
                Current: W={imageWidth}px, H={imageHeight}px | H_FOV={cameraConfig.fovXDeg}°
              </div>
            </div>

            {/* Box 2: Pixel to Angular Error */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-400" />
                2. PIXEL DISPLACEMENT → ANGULAR OFFSETS
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                For measured centroid (x, y) and principal optical boresight (cx, cy):
              </p>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-amber-300">
                Δx = x - cx,  Δy = y - cy<br />
                θ_pan  = arctan(Δx / fx)<br />
                θ_tilt = arctan(Δy / fy)<br />
                θ_total = arccos(1 / sqrt(1 + (Δx/fx)² + (Δy/fy)²))
              </div>
              <div className="text-[11px] text-slate-400">
                Active: Pan = {data?.angularPanDeg.toFixed(2)}° | Tilt = {data?.angularTiltDeg.toFixed(2)}° | Total = {data?.totalAngularDeg.toFixed(3)}°
              </div>
            </div>
          </div>

          {/* Optical Link Cone & Tolerance */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              3. FSOC COARSE LINK ACCEPTANCE CONE CRITERION (&lt; 0.22°)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              In Free-Space Optical Communications (FSOC), the receiver telescope features a narrow optical link acceptance cone. For the coarse tracking stage, pointing error must be strictly kept under <strong>0.22° (3.84 mrad)</strong> to illuminate the fine-steering sensor / quadrant detector.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-mono">
              <span className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Threshold: <span className="text-emerald-400 font-bold">0.220° (3.84 mrad)</span>
              </span>
              <span className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Current Error:{' '}
                <span className={`font-bold ${data && data.totalAngularDeg < 0.22 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data ? `${data.totalAngularDeg.toFixed(3)}° (${data.totalAngularMrad.toFixed(1)} mrad)` : '0.00°'}
                </span>
              </span>
              <span className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Link Condition:{' '}
                <span className={`font-bold ${data && data.totalAngularDeg < 0.22 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data && data.totalAngularDeg < 0.22 ? 'INSIDE ACCEPTANCE CONE' : 'OUTSIDE CONE (CENTRALIZING)'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/90">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            CLOSE GEOMETRY
          </button>
        </div>
      </div>
    </div>
  );
};
