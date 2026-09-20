import React, { useRef, useEffect, useState } from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import { Activity, BarChart3, TrendingDown, Download, FileText, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { exportTelemetryCSV, exportTelemetryJSON } from '../utils/telemetryExport';

interface TelemetryStripChartsProps {
  engine: FSOCSimulationEngine;
}

export const TelemetryStripCharts: React.FC<TelemetryStripChartsProps> = ({ engine }) => {
  const errorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const anglesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTab, setActiveTab] = useState<'error' | 'angles'>('error');
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExport = (format: 'csv' | 'json') => {
    const history = engine?.telemetryHistory || [];
    const options = {
      scenarioName: engine.targetConfig.trajectory,
      detectorMode: engine.perceptionMode,
      metadata: {
        seed: engine.currentSeed,
        simTimeSec: Number(engine.simTimeSec.toFixed(3)),
        isLocked: engine.currentTelemetry.isLocked,
      },
    };

    const result = format === 'csv'
      ? exportTelemetryCSV(history, options)
      : exportTelemetryJSON(history, options);

    if (result.success) {
      setExportFeedback({
        type: 'success',
        message: `Exported ${result.recordCount} samples to ${result.filename}`,
      });
    } else {
      setExportFeedback({
        type: 'error',
        message: result.error || 'Failed to export telemetry',
      });
    }

    setTimeout(() => {
      setExportFeedback(null);
    }, 4000);
  };

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const history = engine?.telemetryHistory || [];
      if (history.length === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // 1. Render Error Strip Chart
      const errCanvas = errorCanvasRef.current;
      if (errCanvas) {
        const ctx = errCanvas.getContext('2d');
        if (ctx) {
          const w = errCanvas.width;
          const h = errCanvas.height;

          // Clear
          ctx.fillStyle = '#060a11';
          ctx.fillRect(0, 0, w, h);

          // Grid Lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          for (let y = 0; y <= h; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Threshold line (0.22 deg fine pointing limit)
          const maxErrorPlot = 1.2; // 1.2 degrees full scale
          const threshY = h - (0.22 / maxErrorPlot) * (h - 15) - 8;

          ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, threshY);
          ctx.lineTo(w, threshY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillText('0.22° FINE LINK LIMIT', 6, threshY - 4);

          // Plot Angular Error Curve
          ctx.lineWidth = 2;
          ctx.beginPath();
          const stepX = w / (engine.maxHistoryLength - 1);

          for (let i = 0; i < history.length; i++) {
            const item = history[i];
            const x = (i + (engine.maxHistoryLength - history.length)) * stepX;
            const normErr = Math.min(item.angularErrorDeg / maxErrorPlot, 1.0);
            const y = h - normErr * (h - 20) - 8;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();

          // Gradient under curve
          const lastItem = history[history.length - 1];
          const lastX = (history.length - 1 + (engine.maxHistoryLength - history.length)) * stepX;
          const firstX = (engine.maxHistoryLength - history.length) * stepX;

          ctx.lineTo(lastX, h);
          ctx.lineTo(firstX, h);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          ctx.fillStyle = grad;
          ctx.fill();

          // Current Value Callout
          if (lastItem) {
            ctx.fillStyle = lastItem.angularErrorDeg < 0.22 ? '#22c55e' : '#f59e0b';
            ctx.font = 'bold 11px JetBrains Mono, monospace';
            ctx.fillText(
              `NOW: ${lastItem.angularErrorDeg.toFixed(3)}° (${lastItem.angularErrorMrad.toFixed(1)} mrad)`,
              w - 180,
              18
            );
          }
        }
      }

      // 2. Render Angles Strip Chart (Target Pan vs Camera Pan)
      const angCanvas = anglesCanvasRef.current;
      if (angCanvas) {
        const ctx = angCanvas.getContext('2d');
        if (ctx) {
          const w = angCanvas.width;
          const h = angCanvas.height;
          const midY = h / 2;

          ctx.fillStyle = '#060a11';
          ctx.fillRect(0, 0, w, h);

          // Center 0° line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, midY);
          ctx.lineTo(w, midY);
          ctx.stroke();

          ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillText('0° BORESIGHT', 6, midY - 3);

          const maxAngleScale = 30.0; // +/- 30 degrees
          const stepX = w / (engine.maxHistoryLength - 1);

          // Draw Target Pan (Cyan Line)
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let i = 0; i < history.length; i++) {
            const item = history[i];
            const x = (i + (engine.maxHistoryLength - history.length)) * stepX;
            const y = midY - (item.targetPanDeg / maxAngleScale) * (midY - 10);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Draw Camera Pan Gimbal (Emerald Line)
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          for (let i = 0; i < history.length; i++) {
            const item = history[i];
            const x = (i + (engine.maxHistoryLength - history.length)) * stepX;
            const y = midY - (item.cameraPanDeg / maxAngleScale) * (midY - 10);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Legend
          ctx.fillStyle = '#38bdf8';
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.fillText('● TARGET PAN', w - 210, 18);
          ctx.fillStyle = '#10b981';
          ctx.fillText('● GIMBAL PAN', w - 110, 18);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

  const stats = engine.getPerformanceStats();

  return (
    <div id="telemetry-strip-charts" className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header and Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-200 font-bold">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>REAL-TIME TELEMETRY OSCILLOSCOPE</span>
          <span className="text-[10px] text-slate-500 font-normal">
            ({engine.telemetryHistory.length} samples)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
            <button
              id="tab-chart-error"
              onClick={() => setActiveTab('error')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                activeTab === 'error' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pointing Error
            </button>
            <button
              id="tab-chart-angles"
              onClick={() => setActiveTab('angles')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                activeTab === 'angles' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gimbal Angles
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Export Telemetry Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              id="chart-btn-export-csv"
              onClick={() => handleExport('csv')}
              disabled={engine.telemetryHistory.length === 0}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                engine.telemetryHistory.length === 0
                  ? 'bg-slate-900/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white cursor-pointer'
              }`}
              title={
                engine.telemetryHistory.length === 0
                  ? 'No telemetry data recorded yet'
                  : `Export ${engine.telemetryHistory.length} recorded samples to CSV`
              }
            >
              <FileText className="w-3 h-3 text-cyan-400" />
              <span>CSV</span>
            </button>

            <button
              id="chart-btn-export-json"
              onClick={() => handleExport('json')}
              disabled={engine.telemetryHistory.length === 0}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                engine.telemetryHistory.length === 0
                  ? 'bg-slate-900/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white cursor-pointer'
              }`}
              title={
                engine.telemetryHistory.length === 0
                  ? 'No telemetry data recorded yet'
                  : `Export ${engine.telemetryHistory.length} recorded samples to JSON`
              }
            >
              <FileCode className="w-3 h-3 text-purple-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export Status Banner */}
      {exportFeedback && (
        <div
          id="chart-export-feedback"
          className={`flex items-center justify-between px-4 py-1.5 text-xs font-mono border-b ${
            exportFeedback.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span>{exportFeedback.message}</span>
          </div>
          <button
            onClick={() => setExportFeedback(null)}
            className="text-slate-400 hover:text-white text-[11px] ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Charts Area */}
      <div className="p-3">
        <div className={activeTab === 'error' ? 'block' : 'hidden'}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Angular Pointing Error [0.0° - 1.2°]</span>
            <span className="text-emerald-400 font-semibold">Fine Alignment Core: &lt; 0.22°</span>
          </div>
          <canvas
            ref={errorCanvasRef}
            width={640}
            height={160}
            className="w-full h-36 rounded-lg bg-black border border-slate-800/60 block"
          />
        </div>

        <div className={activeTab === 'angles' ? 'block' : 'hidden'}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Azimuth Gimbal Angle Tracking [-30° to +30°]</span>
            <span className="text-slate-400">Response / Settling Dynamics</span>
          </div>
          <canvas
            ref={anglesCanvasRef}
            width={640}
            height={160}
            className="w-full h-36 rounded-lg bg-black border border-slate-800/60 block"
          />
        </div>

        {/* Real-Time Measurements Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3 font-mono text-xs">
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400">LOCK RETENTION (POST-LOCK)</div>
            <div className="text-sm font-bold text-emerald-400">{stats.lockRetentionRate}%</div>
            <div className="text-[9px] text-slate-500">Losses: {stats.lockLossCount}</div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400">RMS POINTING ERROR</div>
            <div className="text-sm font-bold text-cyan-400">{stats.rmsAngularErrorDeg}°</div>
            <div className="text-[9px] text-slate-500">{stats.rmsAngularErrorMrad} mrad</div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400">MEAN / MAX ERROR</div>
            <div className="text-sm font-bold text-amber-400">{stats.meanAngularErrorDeg}°</div>
            <div className="text-[9px] text-slate-500">Max: {stats.maxAngularErrorDeg}°</div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400">TIME TO FIRST LOCK</div>
            <div className="text-sm font-bold text-purple-400">
              {stats.timeToFirstLockSec !== null ? `${stats.timeToFirstLockSec.toFixed(2)}s` : 'SEARCHING'}
            </div>
            <div className="text-[9px] text-slate-500">
              {stats.reacquisitionTimeSec !== null ? `Reacq: ${stats.reacquisitionTimeSec.toFixed(2)}s` : 'Zero Reacq'}
            </div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400">DETECTION / FALSE-LOCK</div>
            <div className="text-sm font-bold text-emerald-400">{stats.detectionRate}%</div>
            <div className="text-[9px] text-slate-500">False-Lock: {stats.falseLockRate}%</div>
          </div>
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400">FRAME RATE & LATENCY</div>
            <div className="text-sm font-bold text-sky-400">{stats.averageFps} FPS</div>
            <div className="text-[9px] text-slate-500">{stats.averageLatencyMs.toFixed(1)} ms</div>
          </div>
        </div>
      </div>
    </div>
  );
};
