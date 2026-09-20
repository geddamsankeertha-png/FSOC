import React, { useState } from 'react';
import {
  Camera,
  Search,
  Activity,
  Compass,
  Sliders,
  RotateCw,
  HelpCircle,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Download,
  Filter,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  TrackingExplainabilityData,
  TrackingEvent,
  TrackingStatus,
  CameraConfig,
  WebcamConfig,
  WebcamTelemetry,
} from '../types';

interface TrackingExplainabilityPanelProps {
  data: TrackingExplainabilityData | null;
  currentTelemetry: WebcamTelemetry | null;
  events: TrackingEvent[];
  cameraConfig: CameraConfig | WebcamConfig;
  fsmState: TrackingStatus;
  onOpenHowItTracks: () => void;
  onOpenGeometry: () => void;
  onOpenReplay: () => void;
}

export const TrackingExplainabilityPanel: React.FC<TrackingExplainabilityPanelProps> = ({
  data,
  currentTelemetry,
  events = [],
  cameraConfig,
  fsmState,
  onOpenHowItTracks,
  onOpenGeometry,
  onOpenReplay,
}) => {
  const [uiMode, setUiMode] = useState<'beginner' | 'engineer'>('engineer');
  const [eventSeverityFilter, setEventSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const imageWidth = 'actualWidth' in cameraConfig ? cameraConfig.actualWidth : cameraConfig.width;
  const imageHeight = 'actualHeight' in cameraConfig ? cameraConfig.actualHeight : cameraConfig.height;

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Safe events list
  const safeEvents = events || [];

  // Filtered events
  const filteredEvents = safeEvents.filter((e) => {
    if (eventSeverityFilter === 'all') return true;
    return e.severity === eventSeverityFilter;
  });

  // Export events to CSV
  const handleExportEventsCSV = () => {
    if (safeEvents.length === 0) return;
    const headers = ['id', 'timestamp_sec', 'time_string', 'type', 'severity', 'message', 'details'];
    const rows = safeEvents.map((e) => [
      e.id,
      e.timestamp.toFixed(3),
      e.timeString,
      e.type,
      e.severity,
      `"${(e.message || '').replace(/"/g, '""')}"`,
      `"${(e.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fsoc-tracking-events-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export events to TXT log
  const handleExportEventsTXT = () => {
    if (safeEvents.length === 0) return;
    const txtContent = safeEvents
      .map((e) => `[${e.timeString}] [${e.severity.toUpperCase()}] [${e.type}] ${e.message} ${e.details ? '— ' + e.details : ''}`)
      .join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fsoc-tracking-events-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper status color for pipeline badges
  const getPipelineStageStatus = (stage: string) => {
    if (!data) return { label: 'STANDBY', color: 'bg-slate-800 text-slate-400 border-slate-700' };

    switch (stage) {
      case 'camera':
        return { label: 'STREAMING', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'detection':
        return data.detectedPoint
          ? { label: 'DETECTED', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
          : { label: 'SEARCHING', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'prediction':
        return data.fsmState === 'COASTING'
          ? { label: 'COASTING', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
          : data.predictedPoint
          ? { label: 'ACTIVE', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
          : { label: 'STANDBY', color: 'bg-slate-800 text-slate-400 border-slate-700' };
      case 'angle':
        return data.totalAngularDeg < 0.22
          ? { label: '< 0.22° CONE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
          : { label: `${data.totalAngularDeg.toFixed(1)}°`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'controller':
        return Math.abs(data.cmdPanRate) > 0.05 || Math.abs(data.cmdTiltRate) > 0.05
          ? { label: 'COMMANDING', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' }
          : { label: 'STABILIZED', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'gimbal':
        return fsmState === 'LOCKED'
          ? { label: 'LOCKED', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
          : { label: fsmState, color: 'bg-slate-800 text-slate-300 border-slate-700' };
      default:
        return { label: 'OK', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-mono shadow-xl">
      {/* Panel Top Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                TRACKING EXPLAINABILITY
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                LIVE INSTRUMENT
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              End-to-end transparent telemetry & decision arbitration
            </div>
          </div>
        </div>

        {/* UI Mode Toggle: Beginner vs Engineer */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setUiMode('beginner')}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer text-[11px] ${
                uiMode === 'beginner'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SIMPLE
            </button>
            <button
              onClick={() => setUiMode('engineer')}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer text-[11px] ${
                uiMode === 'engineer'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ENGINEER
            </button>
          </div>

          {/* Interactive Feature Modals Triggers */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenHowItTracks}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-colors cursor-pointer"
              title="Open 9-stage interactive tracking walkthrough"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>HOW IS IT TRACKING?</span>
            </button>

            <button
              onClick={onOpenGeometry}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer"
              title="View 3D camera ray tracing geometry"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GEOMETRY</span>
            </button>

            <button
              onClick={onOpenReplay}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold transition-colors cursor-pointer"
              title="Open 15s frame scrubber replay"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">REPLAY</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Live Pipeline Status Chain: Camera → Detection → Prediction → Angle Error → Controller → Gimbal */}
      <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
          <span className="uppercase tracking-wider font-bold">LIVE STATUS CHAIN</span>
          <span className="text-slate-500">Clock sync: 30 FPS</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 text-[11px]">
          {[
            { id: 'camera', name: '1. Camera', icon: Camera },
            { id: 'detection', name: '2. Detection', icon: Search },
            { id: 'prediction', name: '3. Prediction', icon: Activity },
            { id: 'angle', name: '4. Angle Error', icon: Compass },
            { id: 'controller', name: '5. Controller', icon: Sliders },
            { id: 'gimbal', name: '6. Gimbal', icon: RotateCw },
          ].map((stage) => {
            const status = getPipelineStageStatus(stage.id);
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Icon className="w-3 h-3 text-slate-400" />
                    <span>{stage.name}</span>
                  </div>
                </div>
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold border text-center truncate ${status.color}`}>
                  {status.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Dynamic Single-Sentence Explanation Banner */}
      <div className="p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
        <div className="flex items-start gap-2.5">
          <div className="p-1 rounded bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
            <Info className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs text-slate-200 leading-relaxed font-sans font-medium">
            {data ? (
              data.movementReason.summarySentence
            ) : (
              'Waiting for camera capture and optical beacon detection...'
            )}
          </div>
        </div>
      </div>

      {/* Main Body with Collapsible Modules */}
      <div className="p-4 space-y-4 max-h-[750px] overflow-y-auto">
        {/* MODULE A: "WHY IS IT MOVING?" Control Decision Card */}
        <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                WHY IS IT MOVING? (CONTROL DECISION)
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Center: ({data ? `${data.opticalCenter.x}, ${data.opticalCenter.y}` : `${imageWidth / 2}, ${imageHeight / 2}`}) px
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Horizontal Axis */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-bold uppercase">PAN AXIS (AZIMUTH)</span>
                <span className="text-[11px] text-cyan-400 font-bold">
                  {data ? (data.pixelErrorX >= 0 ? `+${data.pixelErrorX} px` : `${data.pixelErrorX} px`) : '0 px'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                {data && data.pixelErrorX >= 0 ? (
                  <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <ArrowLeft className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                <span>
                  {data ? data.movementReason.horizontalOffset : 'Aligned with vertical meridian'}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Action:</span>
                <span className="font-bold text-cyan-300">
                  {data ? data.movementReason.panAction : 'HOLD'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Pan Angular Error:</span>
                <span className="text-slate-200 font-mono">
                  {data ? `${data.angularPanDeg >= 0 ? '+' : ''}${data.angularPanDeg.toFixed(2)}°` : '0.00°'}
                </span>
              </div>
            </div>

            {/* Vertical Axis */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-bold uppercase">TILT AXIS (ELEVATION)</span>
                <span className="text-[11px] text-sky-400 font-bold">
                  {data ? (data.pixelErrorY >= 0 ? `+${data.pixelErrorY} px` : `${data.pixelErrorY} px`) : '0 px'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                {data && data.pixelErrorY >= 0 ? (
                  <ArrowDown className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <ArrowUp className="w-4 h-4 text-sky-400 shrink-0" />
                )}
                <span>
                  {data ? data.movementReason.verticalOffset : 'Aligned with horizontal meridian'}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Action:</span>
                <span className="font-bold text-sky-300">
                  {data ? data.movementReason.tiltAction : 'HOLD'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Tilt Angular Error:</span>
                <span className="text-slate-200 font-mono">
                  {data ? `${data.angularTiltDeg >= 0 ? '+' : ''}${data.angularTiltDeg.toFixed(2)}°` : '0.00°'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MODULE B: PID & Feedforward Term Breakdown (Numerical & Transparent) */}
        {uiMode === 'engineer' && data && (
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  PID + VELOCITY FEEDFORWARD CONTRIBUTION
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Rate Units: °/sec</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Pan PID Terms */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1">
                  <span>PAN TERMS</span>
                  <span className="text-sky-300 font-mono">
                    Total: {data.pidTerms.totalPan >= 0 ? '+' : ''}{data.pidTerms.totalPan.toFixed(2)}°/s
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">P</div>
                    <div className="text-slate-200 font-bold">{data.pidTerms.pPan.toFixed(2)}</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">I</div>
                    <div className="text-slate-200 font-bold">{data.pidTerms.iPan.toFixed(2)}</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">D</div>
                    <div className="text-slate-200 font-bold">{data.pidTerms.dPan.toFixed(2)}</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-purple-400 font-bold">FF</div>
                    <div className="text-purple-300 font-bold">{data.pidTerms.ffPan.toFixed(2)}</div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Feedforward (Kalman Vx):</span>
                  <span className="text-purple-300 font-mono">
                    {data.kalmanVelocity.vx >= 0 ? '+' : ''}{data.kalmanVelocity.vx.toFixed(1)} px/s
                  </span>
                </div>
              </div>

              {/* Tilt PID Terms */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1">
                  <span>TILT TERMS</span>
                  <span className="text-sky-300 font-mono">
                    Total: {data.pidTerms.totalTilt >= 0 ? '+' : ''}{data.pidTerms.totalTilt.toFixed(2)}°/s
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">P</div>
                    <div className="text-slate-200 font-bold">{data.pidTerms.pTilt.toFixed(2)}</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">I</div>
                    <div className="text-slate-200 font-bold">{data.pidTerms.iTilt.toFixed(2)}</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">D</div>
                    <div className="text-slate-200 font-bold">{data.pidTerms.dTilt.toFixed(2)}</div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-purple-400 font-bold">FF</div>
                    <div className="text-purple-300 font-bold">{data.pidTerms.ffTilt.toFixed(2)}</div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Feedforward (Kalman Vy):</span>
                  <span className="text-purple-300 font-mono">
                    {data.kalmanVelocity.vy >= 0 ? '+' : ''}{data.kalmanVelocity.vy.toFixed(1)} px/s
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODULE C: Kalman Filter State & Prediction Telemetry */}
        {data && (
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  KALMAN FILTER STATE & INNOVATION
                </span>
              </div>
              <span className="text-[10px] text-purple-300 font-mono">
                Lookahead: {Math.round(data.kalmanLookaheadSec * 1000)}ms
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">● DETECTED (zx, zy)</div>
                <div className="text-amber-300 font-bold truncate">
                  {data.detectedPoint ? `${data.detectedPoint.x.toFixed(0)}, ${data.detectedPoint.y.toFixed(0)}` : 'DROPOUT'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">◇ PREDICTED (px, py)</div>
                <div className="text-purple-300 font-bold truncate">
                  {data.predictedPoint ? `${data.predictedPoint.x.toFixed(0)}, ${data.predictedPoint.y.toFixed(0)}` : 'UNINIT'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">RESIDUAL (z - Hx)</div>
                <div className="text-slate-200 font-bold truncate">
                  Δx:{data.kalmanResidual.resX} Δy:{data.kalmanResidual.resY}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">COVARIANCE TRACE</div>
                <div className="text-slate-200 font-bold truncate">
                  Tr(P)={data.kalmanCovarianceTrace}
                </div>
              </div>
            </div>

            {/* Coasting Window Status Bar */}
            {data.fsmState === 'COASTING' && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    COASTING TIMEOUT BUDGET
                  </span>
                  <span className="text-amber-200 font-mono text-[11px]">
                    {data.fsmReason.coastElapsedMs} / {data.fsmReason.coastTimeoutMs} ms
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-amber-500 h-full transition-all duration-100"
                    style={{
                      width: `${Math.min(100, ((data.fsmReason.coastElapsedMs ?? 0) / (data.fsmReason.coastTimeoutMs ?? 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">
                  Extrapolating forward position on Kalman velocity (Vx={data.kalmanVelocity.vx.toFixed(0)}, Vy={data.kalmanVelocity.vy.toFixed(0)} px/s).
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE D: Dual Confidence Meters & Factor Breakdown */}
        {data && (
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  DETECTION VS TRACKING CONFIDENCE
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Multi-factor validation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Detection Confidence */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">1. Instantaneous Detection Conf:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {data.confidenceBreakdown.detectionConfidence}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-amber-400 h-full transition-all duration-100"
                    style={{ width: `${data.confidenceBreakdown.detectionConfidence}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500">
                  Single-frame optical intensity & SNR contrast metric
                </div>
              </div>

              {/* Overall Tracking Confidence */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">2. Real Tracking Confidence:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {data.confidenceBreakdown.overall}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-100"
                    style={{ width: `${data.confidenceBreakdown.overall}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500">
                  Fuses temporal history, motion smoothness & innovation residual
                </div>
              </div>
            </div>

            {/* Breakdown Sub-metrics */}
            {uiMode === 'engineer' && (
              <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-mono">
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <div className="text-slate-500">TEMPORAL HIT RATE</div>
                  <div className="text-slate-200 font-bold">{data.confidenceBreakdown.temporalConsistency}%</div>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <div className="text-slate-500">PREDICTION CONSISTENCY</div>
                  <div className="text-slate-200 font-bold">{data.confidenceBreakdown.predictionConsistency}%</div>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <div className="text-slate-500">TRACK GATE ASSOCIATION</div>
                  <div className="text-slate-200 font-bold">{data.confidenceBreakdown.targetAssociation}%</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE E: FSM State Criteria & Lock Verification */}
        {data && (
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  FSM STATE & TRANSITION REASONING
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  fsmState === 'LOCKED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : fsmState === 'COASTING'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                }`}
              >
                {fsmState}
              </span>
            </div>

            <div className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 leading-relaxed">
              {data.fsmReason.reasonText}
            </div>

            {/* Criteria Checklist */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                LOCK VERIFICATION CRITERIA (ALL 4 REQUIRED FOR 'LOCKED'):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {data.fsmReason.criteriaList.map((crit, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] ${
                      crit.met
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {crit.met ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span>{crit.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODULE F: Candidate Spots & Clutter Discrimination */}
        {uiMode === 'engineer' && data && (data.candidates?.length ?? 0) > 0 && (
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                OPTICAL CANDIDATES & CLUTTER DISCRIMINATION
              </span>
              <span className="text-[10px] text-slate-400">{data.candidates?.length ?? 0} Spot(s) Probing</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-[10px]">
                    <th className="pb-1.5">ID</th>
                    <th className="pb-1.5">LOCATION (X, Y)</th>
                    <th className="pb-1.5">CONFIDENCE</th>
                    <th className="pb-1.5">SNR</th>
                    <th className="pb-1.5">ASSOCIATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(data.candidates || []).map((cand) => {
                    const isSelected = cand.id === data.selectedCandidateId;
                    return (
                      <tr key={cand.id} className={isSelected ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-400'}>
                        <td className="py-1 font-bold">{cand.id}</td>
                        <td className="py-1">({cand.x}, {cand.y})</td>
                        <td className="py-1">{(cand.confidence * 100).toFixed(0)}%</td>
                        <td className="py-1">{cand.snrDb} dB</td>
                        <td className="py-1 font-bold">
                          {isSelected ? 'PRIMARY TRACK' : 'REJECTED GLINT'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODULE G: Real-Time Tracking Event Log with Filters & Export */}
        <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                REAL-TIME EVENT LOG ({safeEvents.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Severity Filter */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
                {(['all', 'info', 'warning', 'error', 'success'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setEventSeverityFilter(sev)}
                    className={`px-1.5 py-0.5 rounded uppercase font-bold cursor-pointer transition-colors ${
                      eventSeverityFilter === sev
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Export Buttons */}
              <button
                onClick={handleExportEventsCSV}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Export events to CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportEventsTXT}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Export events to TXT"
              >
                <Download className="w-3 h-3" />
                <span>TXT</span>
              </button>
            </div>
          </div>

          {/* Event Log Window */}
          <div className="h-40 overflow-y-auto rounded-lg bg-slate-950 border border-slate-800/90 p-2 space-y-1.5 text-[11px] font-mono">
            {filteredEvents.length === 0 ? (
              <div className="text-center text-slate-600 py-6 text-xs">
                No events matching selected filter.
              </div>
            ) : (
              filteredEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-900/60 border border-transparent hover:border-slate-800 transition-colors"
                >
                  <span className="text-slate-500 text-[10px] shrink-0">{evt.timeString}</span>
                  <span
                    className={`px-1 rounded text-[9px] font-bold shrink-0 uppercase ${
                      evt.severity === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : evt.severity === 'warning'
                        ? 'bg-amber-500/20 text-amber-300'
                        : evt.severity === 'error'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    {evt.severity}
                  </span>
                  <div className="flex-1 text-slate-300 break-all">
                    <span>{evt.message}</span>
                    {evt.details && (
                      <div className="text-[10px] text-slate-500">{evt.details}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
