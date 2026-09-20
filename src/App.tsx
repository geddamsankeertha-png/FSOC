/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FSOCSimulationEngine } from './simulation/simulationEngine';
import { WebcamTrackingEngine } from './simulation/webcamTrackingEngine';
import { SyntheticCameraFeed } from './components/SyntheticCameraFeed';
import { SpatialTacticalView } from './components/SpatialTacticalView';
import { TelemetryStripCharts } from './components/TelemetryStripCharts';
import { ControlDashboard } from './components/ControlDashboard';
import { BenchmarkEvaluationModal } from './components/BenchmarkEvaluationModal';

import { LiveWebcamView } from './components/LiveWebcamView';
import { WebcamGimbalTacticalView } from './components/WebcamGimbalTacticalView';
import { LiveTrackingDemoModal } from './components/LiveTrackingDemoModal';
import { ApplicationMode } from './types';
import { exportTelemetryCSV, exportTelemetryJSON } from './utils/telemetryExport';
import {
  Crosshair,
  Radio,
  Activity,
  Award,
  BookOpen,
  Download,
  ShieldCheck,
  Zap,
  Sliders,
  Maximize2,
  Minimize2,
  Sparkles,
  Camera,
  Globe,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  // Mode selection: Virtual Simulation Mode vs Live Webcam Mode
  const [appMode, setAppMode] = useState<ApplicationMode>('virtual_sim');

  // Persistent Virtual Simulation Engine instance
  const engine = useMemo(() => new FSOCSimulationEngine(), []);

  // Persistent Live Webcam Tracking Engine instance
  const webcamEngine = useMemo(() => new WebcamTrackingEngine(), []);

  // UI States
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isCompetitionDemoOpen, setIsCompetitionDemoOpen] = useState(false);
  const [isLiveDemoOpen, setIsLiveDemoOpen] = useState(false);
  const [viewLayout, setViewLayout] = useState<'dual' | 'camera_focus' | 'tactical_focus'>('dual');
  const [, setFrameTick] = useState(0);

  // Main high-performance simulation loop (active when in virtual_sim mode)
  useEffect(() => {
    let lastTime = performance.now();
    let accumulatedTime = 0;
    let animationFrameId: number;
    const physicsStepSec = 1 / 60;
    const maxCatchUpSteps = 3;

    const loop = (now: number) => {
      // Physics must advance at a stable cadence. A variable animation-frame
      // delta produced large gimbal position jumps after a slow render.
      const elapsedSec = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Advance simulation physics, perception & control
      if (appMode === 'virtual_sim') {
        accumulatedTime += elapsedSec;
        let steps = 0;
        while (accumulatedTime >= physicsStepSec && steps < maxCatchUpSteps) {
          engine.step(physicsStepSec);
          accumulatedTime -= physicsStepSec;
          steps++;
        }

        // If rendering remains behind, discard stale time rather than running
        // an unbounded burst of old physics frames that visibly freezes the UI.
        if (steps === maxCatchUpSteps) {
          accumulatedTime = 0;
        }

        if (steps > 0 && engine.frameCount % 3 === 0) {
          setFrameTick((t) => t + 1);
        }
      } else {
        // Do not carry elapsed simulation time across a mode change.
        accumulatedTime = 0;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, appMode]);

  const telemetry = engine.currentTelemetry;
  const stats = engine.getPerformanceStats();
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const activeHistoryLength =
    appMode === 'virtual_sim'
      ? engine.telemetryHistory.length
      : webcamEngine.telemetryHistory.length;

  const handleExportTelemetry = (format: 'csv' | 'json') => {
    if (appMode === 'live_webcam') {
      if (format === 'csv') {
        webcamEngine.exportCSV();
        setExportFeedback({
          type: 'success',
          message: `Exported ${webcamEngine.telemetryHistory.length} live webcam frames to CSV`,
        });
      } else {
        const payload = {
          format: 'fsoc-pat-webcam-telemetry-v1',
          exportedAt: new Date().toISOString(),
          totalRecords: webcamEngine.telemetryHistory.length,
          telemetry: webcamEngine.telemetryHistory,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fsoc_webcam_telemetry_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 250);
        setExportFeedback({
          type: 'success',
          message: `Exported ${webcamEngine.telemetryHistory.length} live webcam frames to JSON`,
        });
      }
      setTimeout(() => setExportFeedback(null), 4000);
      return;
    }

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
        message: `Exported ${result.recordCount} records to ${result.filename}`,
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md px-4 lg:px-6 py-2.5">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold tracking-tight text-white font-mono">
                  FSOC PAT CAMERA TRACKING SYSTEM
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 rounded">
                
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block font-mono">
                Coarse Pointing, Acquisition & Tracking Closed-Loop Gimbal Platform
              </p>
            </div>
          </div>

          {/* Core System Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-700/80 rounded-xl font-mono text-xs shadow-inner">
            <button
              id="mode-btn-virtual-sim"
              onClick={() => setAppMode('virtual_sim')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                appMode === 'virtual_sim'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Virtual Simulation</span>
            </button>
            <button
              id="mode-btn-live-webcam"
              onClick={() => setAppMode('live_webcam')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                appMode === 'live_webcam'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950 animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Webcam Mode</span>
            </button>
          </div>

          {/* Quick Metrics Bar (Virtual Sim Mode) */}
          {appMode === 'virtual_sim' && (
            <div className="hidden xl:flex items-center gap-6 font-mono text-xs border-x border-slate-800/80 px-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">POINTING ERROR:</span>
                <span
                  className={`font-bold ${
                    telemetry.angularErrorDeg < 0.22 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {telemetry.angularErrorDeg.toFixed(3)}° ({telemetry.angularErrorMrad.toFixed(1)} mrad)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">LOCK RETENTION:</span>
                <span className="text-cyan-400 font-bold">{stats.lockRetentionRate}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">PERCEPTION:</span>
                <span className="text-purple-400 font-semibold uppercase">{engine.perceptionMode.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar (Live Webcam Mode) */}
          {appMode === 'live_webcam' && (
            <div className="hidden xl:flex items-center gap-6 font-mono text-xs border-x border-slate-800/80 px-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">LIVE SENSOR:</span>
                <span className={`font-bold ${webcamEngine.isStreaming ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {webcamEngine.isStreaming ? 'STREAMING' : 'STANDBY'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">FSM:</span>
                <span className="text-cyan-400 font-bold">{webcamEngine.fsmState}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">PERCEPTION:</span>
                <span className="text-purple-400 font-semibold uppercase">{webcamEngine.perceptionMode.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {appMode === 'virtual_sim' ? (
              <>
                

                <button
                  id="header-btn-benchmark"
                  onClick={() => setIsBenchmarkOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span> Benchmark Suite</span>
                </button>
              </>
            ) : (
              <button
                id="header-btn-live-tracking-demo"
                onClick={() => setIsLiveDemoOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 text-xs font-mono font-bold transition-all cursor-pointer shadow-md shadow-emerald-950/50 hover:shadow-emerald-900/60"
                title="Launch 13-Stage Real Webcam Tracking Verification Protocol"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>RUN LIVE TRACKING DEMO</span>
              </button>
            )}

            

            <div className="flex items-center gap-1.5">
              <button
                id="header-btn-export-csv"
                onClick={() => handleExportTelemetry('csv')}
                disabled={activeHistoryLength === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                  activeHistoryLength === 0
                    ? 'bg-slate-900/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer hover:text-white'
                }`}
                title={
                  activeHistoryLength === 0
                    ? 'No telemetry data recorded yet'
                    : `Download Telemetry CSV (${activeHistoryLength} samples)`
                }
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Export CSV</span>
              </button>

              <button
                id="header-btn-export-json"
                onClick={() => handleExportTelemetry('json')}
                disabled={activeHistoryLength === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                  activeHistoryLength === 0
                    ? 'bg-slate-900/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer hover:text-white'
                }`}
                title={
                  activeHistoryLength === 0
                    ? 'No telemetry data recorded yet'
                    : `Download Telemetry JSON (${activeHistoryLength} samples)`
                }
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden md:inline">Export JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Export Status Toast */}
        {exportFeedback && (
          <div
            id="header-export-feedback"
            className={`max-w-[1700px] mx-auto mt-2 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between border ${
              exportFeedback.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
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
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
        {/* ======================= VIRTUAL SIMULATION MODE ======================= */}
        {appMode === 'virtual_sim' && (
          <>
            {/* Layout Mode Switcher */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">VIEW MODE:</span>
                <button
                  onClick={() => setViewLayout('dual')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    viewLayout === 'dual' ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40' : 'hover:text-slate-200'
                  }`}
                >
                  Dual Sensor + Tactical
                </button>
                <button
                  onClick={() => setViewLayout('camera_focus')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    viewLayout === 'camera_focus' ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40' : 'hover:text-slate-200'
                  }`}
                >
                  Optical Sensor Focus
                </button>
                <button
                  onClick={() => setViewLayout('tactical_focus')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    viewLayout === 'tactical_focus' ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40' : 'hover:text-slate-200'
                  }`}
                >
                  Tactical Geometry Focus
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Fine Divergence Core (&lt;0.22°)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Kalman Lookahead Velocity
                </span>
              </div>
            </div>

            {/* Primary Views Section */}
            {viewLayout === 'dual' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left / Upper: Synthetic Optical Sensor View */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
                  <SyntheticCameraFeed engine={engine} />
                </div>

                {/* Right: Spatial Tactical Geometry Map */}
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
                  <SpatialTacticalView engine={engine} />
                </div>
              </div>
            )}

            {viewLayout === 'camera_focus' && (
              <div className="w-full">
                <SyntheticCameraFeed engine={engine} />
              </div>
            )}

            {viewLayout === 'tactical_focus' && (
              <div className="w-full max-w-4xl mx-auto">
                <SpatialTacticalView engine={engine} />
              </div>
            )}

            {/* Telemetry Strip Charts & Analysis */}
            <div className="w-full">
              <TelemetryStripCharts engine={engine} />
            </div>

            {/* Interactive Control Deck */}
            <div className="w-full">
              <ControlDashboard
                engine={engine}
                onStateChange={() => setFrameTick((t) => t + 1)}
              />
            </div>
          </>
        )}

        {/* ======================= LIVE WEBCAM MODE ======================= */}
        {appMode === 'live_webcam' && (
          <div className="space-y-4">
            {/* Live Camera View with HUD & Controls */}
            <LiveWebcamView
              engine={webcamEngine}
              onOpenDemo={() => setIsLiveDemoOpen(true)}
            />

            {/* Virtual Gimbal Kinematics & Tactical Telemetry */}
            <WebcamGimbalTacticalView engine={webcamEngine} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/80 px-4 py-3 text-center text-xs font-mono text-slate-500">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            AI-Assisted Virtual Camera Tracking System for Coarse Alignment of Mobile FSOC Terminals
          </div>
          <div>Virtual Stimulation  · Real-Time WebCam </div>
        </div>
      </footer>

      {/* Modals */}
      

      <LiveTrackingDemoModal
        isOpen={isLiveDemoOpen}
        onClose={() => setIsLiveDemoOpen(false)}
        engine={webcamEngine}
      />

      <BenchmarkEvaluationModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        engine={engine}
      />

      
    </div>
  );
}
