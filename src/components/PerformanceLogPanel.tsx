import React, { useState, useEffect } from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import { PerformanceLogEntry, GeneratedPerformanceReport } from '../types';
import {
  FileText,
  Activity,
  Award,
  Clock,
  Zap,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface PerformanceLogPanelProps {
  engine: FSOCSimulationEngine;
  onOpenFullReportModal: () => void;
}

export const PerformanceLogPanel: React.FC<PerformanceLogPanelProps> = React.memo(({
  engine,
  onOpenFullReportModal,
}) => {
  const [report, setReport] = useState<GeneratedPerformanceReport>(() => engine.generatePerformanceReport());
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [, setTick] = useState(0);

  // Periodic UI refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setReport(engine.generatePerformanceReport());
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [engine, autoRefresh]);

  const handleManualRefresh = () => {
    setReport(engine.generatePerformanceReport());
    setTick((t) => t + 1);
  };

  const handleCopyMarkdown = async () => {
    const text = engine.exportPerformanceReportText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadReport = (format: 'md' | 'json' | 'csv') => {
    let content = '';
    let mime = '';
    let ext = format;

    if (format === 'md') {
      content = engine.exportPerformanceReportText();
      mime = 'text/markdown;charset=utf-8;';
    } else if (format === 'json') {
      content = engine.exportPerformanceReportJSON();
      mime = 'application/json;charset=utf-8;';
    } else {
      content = engine.exportPerformanceLogCSV();
      mime = 'text/csv;charset=utf-8;';
    }

    const filename = `fsoc_performance_${format === 'csv' ? 'event_log' : 'report'}_${Date.now()}.${ext}`;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  const handleClearLogs = () => {
    engine.clearPerformanceLogs();
    setReport(engine.generatePerformanceReport());
    setTick((t) => t + 1);
  };

  // Filter logs
  const logs = engine.performanceLogs || [];
  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      selectedFilter === 'ALL'
        ? true
        : selectedFilter === 'LOCK'
        ? log.type === 'LOCK_ACQUIRED' || log.type === 'LOCK_LOST' || log.type === 'REACQUIRED'
        : selectedFilter === 'TARGET'
        ? log.type === 'TARGET_SWITCH'
        : selectedFilter === 'REPORTS'
        ? log.type === 'PERIODIC_REPORT'
        : log.type === selectedFilter;

    const matchesSearch =
      !searchTerm ||
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.trackedBeacon.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const getLogTypeBadgeStyle = (type: PerformanceLogEntry['type']) => {
    switch (type) {
      case 'ACQUISITION':
      case 'LOCK_ACQUIRED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'LOCK_LOST':
        return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
      case 'REACQUIRED':
        return 'bg-sky-950/80 text-sky-300 border-sky-500/40';
      case 'TARGET_SWITCH':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
      case 'PERIODIC_REPORT':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'DISTURBANCE_SPIKE':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const gradeBadgeClass = {
    'A+': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    A: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    B: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    C: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    FAIL: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  }[report.overallGrade];

  return (
    <div id="performance-log-section" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl font-mono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-white">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>AUTOMATED PERFORMANCE LOG &amp; REPORTING ENGINE</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <div className={`px-2 py-0.5 rounded border text-[11px] font-bold ${gradeBadgeClass}`}>
            GRADE {report.overallGrade} ({report.complianceStatus})
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Pause Live 1s Refresh' : 'Resume Live 1s Refresh'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{autoRefresh ? 'Live Auto-Log' : 'Paused'}</span>
          </button>

          <button
            onClick={handleManualRefresh}
            title="Refresh Performance Snapshot"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyMarkdown}
            title="Copy Full Report as Markdown"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] transition-colors cursor-pointer"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{copied ? 'Copied' : 'Copy Report'}</span>
          </button>

          <button
            onClick={() => handleDownloadReport('md')}
            title="Download Performance Report (Markdown)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report (.md)</span>
          </button>

          <button
            onClick={() => handleDownloadReport('csv')}
            title="Export Event Log to CSV"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Log (.csv)</span>
          </button>

          <button
            onClick={onOpenFullReportModal}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Open Executive Report</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. Live Key Performance Indicators Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Duration */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>SIM DURATION</span>
              </span>
              <span className="text-slate-500">t_sim</span>
            </div>
            <div className="text-lg font-bold text-white mt-1 tabular-nums">
              {report.simulationDurationSec.toFixed(1)}s
            </div>
            <div className="text-[10px] text-slate-500 truncate">{report.totalFrames} Total Frames</div>
          </div>

          {/* FPS */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>SAMPLING RATE</span>
              </span>
              <span className="text-emerald-400 font-bold">{report.currentFps} FPS</span>
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1 tabular-nums">
              {report.averageFps} <span className="text-xs text-slate-400 font-normal">AVG FPS</span>
            </div>
            <div className="text-[10px] text-slate-500">Min {report.minFps} / Max {report.maxFps}</div>
          </div>

          {/* Acquisition Time */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>ACQUISITION</span>
              </span>
              <span className="text-slate-500">t_acq</span>
            </div>
            <div className="text-lg font-bold text-amber-400 mt-1 tabular-nums">
              {report.timeToFirstLockSec !== null ? `${report.timeToFirstLockSec.toFixed(2)}s` : 'Searching'}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {report.averageReacquisitionSec !== null ? `Reacq: ${report.averageReacquisitionSec.toFixed(2)}s` : 'Zero Lock Drops'}
            </div>
          </div>

          {/* Average Tracking Error */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3 text-cyan-400" />
                <span>AVG ERROR</span>
              </span>
              <span className="text-cyan-400 font-semibold">{report.meanAngularErrorMrad.toFixed(1)} mrad</span>
            </div>
            <div className="text-lg font-bold text-cyan-400 mt-1 tabular-nums">
              {report.meanAngularErrorDeg.toFixed(3)}°
            </div>
            <div className="text-[10px] text-slate-500">RMS: {report.rmsAngularErrorDeg.toFixed(3)}°</div>
          </div>

          {/* Maximum Tracking Error */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>MAX ERROR</span>
              </span>
              <span className="text-rose-400 font-semibold">{report.maxAngularErrorMrad.toFixed(1)} mrad</span>
            </div>
            <div className="text-lg font-bold text-rose-400 mt-1 tabular-nums">
              {report.maxAngularErrorDeg.toFixed(3)}°
            </div>
            <div className="text-[10px] text-slate-500 truncate">Limit &lt; 0.220° Cone</div>
          </div>

          {/* Lock Retention & Processing Time */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>LOCK RETENTION</span>
              </span>
              <span className="text-purple-400 font-bold">{report.averageLatencyMs}ms</span>
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-1 tabular-nums">
              {report.lockRetentionRate}%
            </div>
            <div className="text-[10px] text-slate-500">Latency Peak {report.maxLatencyMs}ms</div>
          </div>
        </div>

        {/* 2. Automated Report Summary Card */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">AUTOMATED REPORT SUMMARY</span>
              <span className="text-[10px] text-slate-500">({report.reportId})</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">
                Active Carrier: <strong className="text-emerald-400">{report.selectedBeaconCallsign} ({report.selectedBeaconWavelengthNm}nm)</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Formation: <strong className="text-cyan-400">{report.beaconCount} Beacons</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Trajectory: <strong className="text-white uppercase">{report.trajectoryType}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400 font-bold">MIL-STD Evaluation & Findings:</div>
              {report.keyInsights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-300 text-[11px]">
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Fine Pointing Acceptance:</span>
                <span className="text-emerald-400 font-bold">&lt; 0.220° / 3.840 mrad</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Mean Angular Pointing Error:</span>
                <span className="text-cyan-400 font-semibold">{report.meanAngularErrorDeg.toFixed(3)}° ({report.meanAngularErrorMrad.toFixed(2)} mrad)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Peak Maximum Deviation:</span>
                <span className="text-rose-400 font-semibold">{report.maxAngularErrorDeg.toFixed(3)}° ({report.maxAngularErrorMrad.toFixed(2)} mrad)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Optical Link Availability:</span>
                <span className="text-emerald-400 font-bold">{report.opticalLinkAvailability}% Continuous</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Perception Pipeline:</span>
                <span className="text-cyan-400 font-bold uppercase">{report.perceptionMode.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Real-Time Event Stream Log */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">REAL-TIME PERFORMANCE EVENT LOG</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                {filteredLogs.length} events
              </span>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-36"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[10px]">
                {['ALL', 'ACQUISITION', 'LOCK', 'TARGET', 'REPORTS'].map((flt) => (
                  <button
                    key={flt}
                    onClick={() => setSelectedFilter(flt)}
                    className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                      selectedFilter === flt
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {flt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleClearLogs}
                title="Clear Event History"
                className="p-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Event Log Stream List */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {filteredLogs.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                No performance events recorded matching current filter.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-cyan-400 font-bold tabular-nums min-w-[3rem]">
                      {log.timestampSec.toFixed(1)}s
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLogTypeBadgeStyle(log.type)}`}>
                      {log.type}
                    </span>
                    <span className="font-semibold text-white text-[11px]">{log.title}</span>
                    <span className="text-slate-400 text-[11px] hidden sm:inline truncate max-w-md">
                      · {log.details}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                    <span className="hidden md:inline text-slate-500">Target: {log.trackedBeacon}</span>
                    <span>
                      Err: <strong className={log.angularErrorDeg < 0.22 ? 'text-emerald-400' : 'text-amber-400'}>{log.angularErrorDeg.toFixed(3)}°</strong>
                    </span>
                    <span>
                      Ret: <strong className="text-cyan-400">{log.lockRetention}%</strong>
                    </span>
                    <span>
                      Lat: <strong className="text-purple-400">{log.processingTimeMs}ms</strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
