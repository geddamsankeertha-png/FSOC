import React, { useState } from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import { GeneratedPerformanceReport } from '../types';
import {
  FileText,
  Copy,
  Download,
  CheckCircle2,
  X,
  Award,
  Clock,
  Zap,
  Activity,
  ShieldCheck,
  Layers,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

interface PerformanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: FSOCSimulationEngine;
}

export const PerformanceReportModal: React.FC<PerformanceReportModalProps> = ({
  isOpen,
  onClose,
  engine,
}) => {
  const [report, setReport] = useState<GeneratedPerformanceReport>(() => engine.generatePerformanceReport());
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'markdown' | 'json'>('visual');

  // Regenerate report when opened
  React.useEffect(() => {
    if (isOpen) {
      setReport(engine.generatePerformanceReport());
      setCopied(false);
    }
  }, [isOpen, engine]);

  if (!isOpen) return null;

  const handleRefresh = () => {
    setReport(engine.generatePerformanceReport());
  };

  const handleResetStats = () => {
    engine.resetPerformanceStats();
    setReport(engine.generatePerformanceReport());
  };

  const handleCopyMarkdown = async () => {
    const text = engine.exportPerformanceReportText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadFile = (format: 'md' | 'json') => {
    const content = format === 'md' ? engine.exportPerformanceReportText() : engine.exportPerformanceReportJSON();
    const mime = format === 'md' ? 'text/markdown;charset=utf-8;' : 'application/json;charset=utf-8;';
    const filename = `fsoc_performance_report_${report.reportId.toLowerCase()}_${Date.now()}.${format}`;
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

  const gradeColor = {
    'A+': 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
    A: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40',
    B: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
    C: 'text-orange-400 border-orange-500/40 bg-orange-950/40',
    FAIL: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
  }[report.overallGrade];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AUTOMATED PERFORMANCE REPORT
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                  {report.reportId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generated: {new Date(report.generatedAt).toLocaleString()} · Duration: {report.simulationDurationSec.toFixed(1)}s ({report.totalFrames} frames)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetStats}
              title="Reset Evaluation Stats and Recalibrate for Clean Assessment"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Recalibrate Run</span>
            </button>
            <button
              onClick={handleRefresh}
              title="Refresh Report Snapshot"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Toolbar & Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-950/50 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'visual' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'markdown' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Markdown View
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                activeTab === 'json' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw JSON
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copied ? 'Copied MD!' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={() => handleDownloadFile('md')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download MD</span>
            </button>

            <button
              onClick={() => handleDownloadFile('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'visual' && (
            <>
              {/* Overall Rating Header Card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-black px-3 py-1 rounded-xl border ${gradeColor}`}>
                    {report.overallGrade}
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">MIL-STD Status</div>
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{report.complianceStatus}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Lock Retention</div>
                  <div className="text-base font-bold text-emerald-400 tabular-nums">
                    {report.lockRetentionRate}% <span className="text-[10px] text-slate-400 font-normal">(&ge;85% std)</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">RMS Pointing Error</div>
                  <div className="text-base font-bold text-cyan-400 tabular-nums">
                    {report.rmsAngularErrorDeg.toFixed(3)}° <span className="text-[10px] text-slate-400 font-normal">({report.rmsAngularErrorMrad.toFixed(2)} mrad)</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Frame Rate & Latency</div>
                  <div className="text-base font-bold text-purple-400 tabular-nums">
                    {report.averageFps} FPS <span className="text-[10px] text-slate-400 font-normal">({report.averageLatencyMs}ms)</span>
                  </div>
                </div>
              </div>

              {/* 6 Key Telemetry Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>SIM DURATION</span>
                  </div>
                  <div className="text-sm font-bold text-white mt-1 tabular-nums">{report.simulationDurationSec.toFixed(1)}s</div>
                  <div className="text-[10px] text-slate-500">{report.totalFrames} Total Frames</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>AVG / MAX FPS</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-1 tabular-nums">{report.averageFps} FPS</div>
                  <div className="text-[10px] text-slate-500">Range: {report.minFps}–{report.maxFps} FPS</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>ACQUISITION TIME</span>
                  </div>
                  <div className="text-sm font-bold text-amber-400 mt-1 tabular-nums">
                    {report.timeToFirstLockSec !== null ? `${report.timeToFirstLockSec.toFixed(3)}s` : 'Searching'}
                  </div>
                  <div className="text-[10px] text-slate-500">Reacq: {report.averageReacquisitionSec !== null ? `${report.averageReacquisitionSec.toFixed(3)}s` : '0s'}</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Award className="w-3 h-3 text-cyan-400" />
                    <span>AVG ERROR</span>
                  </div>
                  <div className="text-sm font-bold text-cyan-400 mt-1 tabular-nums">{report.meanAngularErrorDeg.toFixed(3)}°</div>
                  <div className="text-[10px] text-slate-500">{report.meanAngularErrorMrad.toFixed(2)} mrad</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>MAX ERROR</span>
                  </div>
                  <div className="text-sm font-bold text-rose-400 mt-1 tabular-nums">{report.maxAngularErrorDeg.toFixed(3)}°</div>
                  <div className="text-[10px] text-slate-500">{report.maxAngularErrorMrad.toFixed(2)} mrad</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Layers className="w-3 h-3 text-purple-400" />
                    <span>PROCESSING TIME</span>
                  </div>
                  <div className="text-sm font-bold text-purple-400 mt-1 tabular-nums">{report.averageLatencyMs}ms</div>
                  <div className="text-[10px] text-slate-500">Peak: {report.maxLatencyMs}ms</div>
                </div>
              </div>

              {/* Target & Pipeline Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-white border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Active Target Formation</span>
                    <span className="text-cyan-400">{report.beaconCount} Beacons in Frame</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 text-[10px]">TRACKED TARGET:</span>
                      <div className="font-bold text-white">{report.selectedBeaconId} ({report.selectedBeaconCallsign})</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">CARRIER WAVELENGTH:</span>
                      <div className="font-bold text-emerald-400">{report.selectedBeaconWavelengthNm} nm Optical Carrier</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">FLIGHT TRAJECTORY:</span>
                      <div className="font-bold text-cyan-300 uppercase">{report.trajectoryType} Dynamics</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">LOCK LOSS COUNT:</span>
                      <div className="font-bold text-amber-300">{report.lockLossCount} Dropouts</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-white border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Perception & Pointing Compliance</span>
                    <span className="text-emerald-400">{report.perceptionMode.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 text-[10px]">LINK CONE LIMIT:</span>
                      <div className="font-bold text-emerald-400">&lt; 0.220° (3.84 mrad)</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">CURRENT FOCAL OFFSET:</span>
                      <div className="font-bold text-white">{report.currentPixelError.toFixed(1)} px</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">LINK AVAILABILITY:</span>
                      <div className="font-bold text-cyan-400">{report.opticalLinkAvailability}% Continuous</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">CURRENT ERROR:</span>
                      <div className="font-bold text-amber-400">{report.currentAngularErrorDeg.toFixed(3)}°</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagnostic Key Insights */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-white border-b border-slate-800 pb-1.5">
                  Automated Diagnostic Insights &amp; Findings
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {report.keyInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Event Log Preview */}
              {report.recentLogEntries.length > 0 && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-white border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Recent Performance Events &amp; Milestones</span>
                    <span className="text-slate-500">{report.recentLogEntries.length} items</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {report.recentLogEntries.map((log) => (
                      <div key={log.id} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400 font-bold">{log.timestampSec.toFixed(1)}s</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-semibold">{log.type}</span>
                          <span className="text-slate-200">{log.title}: {log.details}</span>
                        </div>
                        <span className="text-slate-400 tabular-nums shrink-0">{log.angularErrorDeg.toFixed(3)}° | {log.lockRetention}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'markdown' && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto">
              <pre className="text-xs text-slate-300 whitespace-pre font-mono leading-relaxed select-all">
                {engine.exportPerformanceReportText()}
              </pre>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto">
              <pre className="text-xs text-cyan-300 whitespace-pre font-mono leading-relaxed select-all">
                {engine.exportPerformanceReportJSON()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
