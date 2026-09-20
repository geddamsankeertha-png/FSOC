import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { TrackingExplainabilityData } from '../types';

interface TrackingReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  replayBuffer: Array<{ timestamp: number; explainability: TrackingExplainabilityData }>;
}

export const TrackingReplayModal: React.FC<TrackingReplayModalProps> = ({
  isOpen,
  onClose,
  replayBuffer = [],
}) => {
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const safeBuffer = replayBuffer || [];

  // Sync to latest frame when opening
  useEffect(() => {
    if (isOpen && safeBuffer.length > 0) {
      setFrameIndex(safeBuffer.length - 1);
      setIsPlaying(false);
    }
  }, [isOpen, safeBuffer.length]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || safeBuffer.length === 0) return;

    const intervalMs = Math.round(33 / playbackSpeed); // ~30fps base
    const timer = setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= safeBuffer.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, safeBuffer.length]);

  const currentFrame = safeBuffer[frameIndex] || null;
  const data = currentFrame?.explainability || null;

  // Render 2D radar / FOV canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    // Reticle circles
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 40, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(w / 2 - 130, h / 2);
    ctx.lineTo(w / 2 + 130, h / 2);
    ctx.moveTo(w / 2, h / 2 - 130);
    ctx.lineTo(w / 2, h / 2 + 130);
    ctx.stroke();

    // 0.22 deg cone ring
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('0.22° LINK', w / 2 + 40, h / 2 - 4);

    // Center boresight
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Scale factor to map pixel error to canvas view
    const scale = 0.45;
    const cx = w / 2;
    const cy = h / 2;

    // Draw trail of past 20 recorded positions
    const startIdx = Math.max(0, frameIndex - 25);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;
    for (let i = startIdx; i <= frameIndex; i++) {
      const p = replayBuffer[i]?.explainability;
      if (p && p.detectedPoint) {
        const tx = cx + p.pixelErrorX * scale;
        const ty = cy + p.pixelErrorY * scale;
        if (first) {
          ctx.moveTo(tx, ty);
          first = false;
        } else {
          ctx.lineTo(tx, ty);
        }
      }
    }
    ctx.stroke();

    if (data.detectedPoint) {
      const tx = cx + data.pixelErrorX * scale;
      const ty = cy + data.pixelErrorY * scale;

      // Error line
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Detected Point
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText('● DETECTED', tx + 8, ty - 4);
    }

    if (data.predictedPoint && data.detectedPoint) {
      const predPxX = data.predictedPoint.x - data.opticalCenter.x;
      const predPxY = data.predictedPoint.y - data.opticalCenter.y;
      const px = cx + predPxX * scale;
      const py = cy + predPxY * scale;

      // Prediction Diamond
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 4, py - 4, 8, 8);

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText('◇ PRED T+25ms', px + 8, py + 10);
    }
  }, [frameIndex, data, replayBuffer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                  TRACKING SCRUBBER & REPLAY INSPECTOR
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                  {safeBuffer.length} RECORDED FRAMES
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Step frame-by-frame through past camera tracking to inspect control decisions and Kalman state
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

        {/* Replay Scrubber Controls */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={() => setFrameIndex((prev) => Math.max(0, prev - 1))}
              disabled={frameIndex === 0}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              title="Step 1 Frame Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setFrameIndex((prev) => Math.min(safeBuffer.length - 1, prev + 1))}
              disabled={frameIndex >= safeBuffer.length - 1}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              title="Step 1 Frame Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setFrameIndex(0);
                setIsPlaying(false);
              }}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              title="Jump to Start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Scrubber slider */}
            <input
              type="range"
              min={0}
              max={Math.max(0, safeBuffer.length - 1)}
              value={frameIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setFrameIndex(Number(e.target.value));
              }}
              className="flex-1 accent-cyan-500 cursor-pointer"
            />

            {/* Speed Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              {[0.5, 1, 2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Frame:{' '}
              <strong className="text-cyan-400">
                {frameIndex + 1} / {safeBuffer.length}
              </strong>
            </span>
            <span>
              Replay Timestamp:{' '}
              <strong className="text-slate-200">{currentFrame?.timestamp.toFixed(2) || '0.00'}s</strong>
            </span>
            <span>
              Recorded Status:{' '}
              <span
                className={`font-bold ${
                  data?.fsmState === 'LOCKED'
                    ? 'text-emerald-400'
                    : data?.fsmState === 'COASTING'
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {data?.fsmState || 'N/A'}
              </span>
            </span>
          </div>
        </div>

        {/* Content Body: Canvas Radar & Live Telemetry Inspector */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {safeBuffer.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No tracking frames recorded yet. Start camera tracking to build replay buffer.
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 2D Radar FOV */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-cyan-400" />
                    REPLAY 2D BORESIGHT RETICLE
                  </span>
                  <span className="text-[10px] text-amber-400">Trail: 25 Frames</span>
                </div>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={300}
                  className="rounded-lg bg-[#0a0f1d] border border-slate-800"
                />
              </div>

              {/* Data Breakdown */}
              <div className="space-y-3">
                {/* Movement Sentence */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                    EXPLAINABILITY SENTENCE AT FRAME #{frameIndex + 1}:
                  </div>
                  {data.movementReason.summarySentence}
                </div>

                {/* Spatial Offset Card */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                    SPATIAL MEASUREMENT & ANGULAR ERROR
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">PIXEL OFFSET</div>
                      <div className="text-slate-200 font-bold">
                        ΔX: {data.pixelErrorX}px | ΔY: {data.pixelErrorY}px
                      </div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">TOTAL POINTING ERROR</div>
                      <div
                        className={`font-bold ${
                          data.totalAngularDeg < 0.22 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {data.totalAngularDeg.toFixed(3)}° ({data.totalAngularMrad.toFixed(1)} mrad)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controller Command Card */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-400" />
                    CONTROLLER RATE COMMANDS
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">PAN SLEW RATE</div>
                      <div className="text-sky-300 font-bold">
                        {data.cmdPanRate >= 0 ? '+' : ''}{data.cmdPanRate.toFixed(2)}°/s
                      </div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">TILT SLEW RATE</div>
                      <div className="text-sky-300 font-bold">
                        {data.cmdTiltRate >= 0 ? '+' : ''}{data.cmdTiltRate.toFixed(2)}°/s
                      </div>
                    </div>
                  </div>
                </div>

                {/* State Machine Status */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    FSM REASONING & TRANSITION
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {data.fsmReason.reasonText}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/90">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            CLOSE REPLAY
          </button>
        </div>
      </div>
    </div>
  );
};
