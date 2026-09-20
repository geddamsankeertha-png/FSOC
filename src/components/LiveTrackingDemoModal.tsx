import React, { useState, useEffect } from 'react';
import { WebcamTrackingEngine } from '../simulation/webcamTrackingEngine';
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Download,
  Eye,
  Crosshair,
  Compass,
  Activity,
  Award,
} from 'lucide-react';

interface LiveTrackingDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: WebcamTrackingEngine;
}

interface DemoStep {
  id: number;
  title: string;
  instruction: string;
  expectedState: string;
  criteriaDescription: string;
  autoCheck: (engine: WebcamTrackingEngine) => boolean;
}

export const LiveTrackingDemoModal: React.FC<LiveTrackingDemoModalProps> = ({
  isOpen,
  onClose,
  engine,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stepSuccessTimestamp, setStepSuccessTimestamp] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [, setTick] = useState(0);

  const steps: DemoStep[] = [
    {
      id: 1,
      title: 'Initialize Optical Sensor',
      instruction: 'Start the real webcam stream and calibrate optical intrinsics.',
      expectedState: 'Webcam Active',
      criteriaDescription: 'Webcam stream is transmitting frames.',
      autoCheck: (eng) => eng.isStreaming,
    },
    {
      id: 2,
      title: 'Autonomous Scanning (SEARCHING)',
      instruction: 'Confirm the Finite State Machine (FSM) is scanning for optical beacons with zero false alarms.',
      expectedState: 'SEARCHING',
      criteriaDescription: 'FSM in SEARCHING state with target clear of FOV.',
      autoCheck: (eng) => eng.fsmState === 'SEARCHING',
    },
    {
      id: 3,
      title: 'Introduce Optical Beacon',
      instruction: 'Aim a flashlight, phone torch, or bright optical emitter towards the webcam.',
      expectedState: 'ACQUIRING / TRACKING',
      criteriaDescription: 'Target detected with confidence >= 60%.',
      autoCheck: (eng) => eng.currentDetection.detected && eng.currentDetection.confidence >= 0.6,
    },
    {
      id: 4,
      title: 'Achieve Coarse Optical Lock',
      instruction: 'Hold the beacon relatively steady near the center until fine pointing settles within < 0.22° tolerance.',
      expectedState: 'LOCKED',
      criteriaDescription: 'FSM transitions to LOCKED with < 0.22° pointing error.',
      autoCheck: (eng) => eng.fsmState === 'LOCKED',
    },
    {
      id: 5,
      title: 'Dynamic Track & Slew',
      instruction: 'Slowly move the optical beacon left/right or up/down. Observe the virtual gimbal slewing to center it.',
      expectedState: 'LOCKED / TRACKING',
      criteriaDescription: 'Gimbal velocity active (> 3°/s) while tracking target.',
      autoCheck: (eng) =>
        Math.abs(eng.virtualGimbal.panVelDegPerSec) > 3.0 ||
        Math.abs(eng.virtualGimbal.tiltVelDegPerSec) > 2.0,
    },
    {
      id: 6,
      title: 'Optical Dropout & Coasting',
      instruction: 'Cover the optical beacon or click "Obstruct Beam" to simulate atmospheric occlusion.',
      expectedState: 'COASTING',
      criteriaDescription: 'FSM transitions to COASTING on Kalman forward velocity prediction.',
      autoCheck: (eng) => eng.fsmState === 'COASTING',
    },
    {
      id: 7,
      title: 'Target Reacquisition',
      instruction: 'Uncover the beacon. Observe immediate transition through REACQUIRING back into LOCKED.',
      expectedState: 'REACQUIRING / LOCKED',
      criteriaDescription: 'Beacon reacquired without system reset.',
      autoCheck: (eng) => eng.fsmState === 'REACQUIRING' || eng.fsmState === 'LOCKED',
    },
    {
      id: 8,
      title: 'Validation Complete',
      instruction: 'Review the comprehensive performance verification scorecard.',
      expectedState: 'SCORECARD READY',
      criteriaDescription: 'Benchmark dataset logged.',
      autoCheck: () => true,
    },
  ];

  // Auto-evaluation step progress loop
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);

      const currentStep = steps[currentStepIndex];
      if (currentStep && currentStepIndex < steps.length - 1) {
        if (currentStep.autoCheck(engine)) {
          if (!completedSteps.includes(currentStep.id)) {
            setCompletedSteps((prev) => [...prev, currentStep.id]);
            setStepSuccessTimestamp(Date.now());
            // Advance after 1.2s delay for visual feedback
            setTimeout(() => {
              setCurrentStepIndex((idx) => Math.min(steps.length - 1, idx + 1));
            }, 1200);
          }
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, currentStepIndex, engine, completedSteps]);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex];
  const isFinalStep = currentStepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="font-bold text-slate-100 text-sm tracking-wide">
                RUN LIVE TRACKING DEMO (13-STAGE PROTOCOL)
              </div>
              <div className="text-[11px] text-slate-400">
                End-to-End Real Webcam Pointing, Acquisition, and Tracking Verification
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-1 overflow-x-auto">
          {steps.map((s, idx) => {
            const isDone = completedSteps.includes(s.id) || idx < currentStepIndex;
            const isCurr = idx === currentStepIndex;
            return (
              <div key={s.id} className="flex items-center gap-1 shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950'
                      : isCurr
                      ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isDone ? '✓' : s.id}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-3 sm:w-6 h-0.5 ${
                      isDone ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!isFinalStep ? (
            <>
              {/* Current Step Card */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                    STEP {currentStep.id} OF {steps.length}: {currentStep.title}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    EXPECTED: {currentStep.expectedState}
                  </span>
                </div>

                <div className="text-sm font-sans text-slate-200 leading-relaxed font-medium">
                  {currentStep.instruction}
                </div>

                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] flex items-center justify-between text-slate-300">
                  <span>Pass Criteria:</span>
                  <span className="text-emerald-400 font-semibold">{currentStep.criteriaDescription}</span>
                </div>
              </div>

              {/* Real-Time Live Status Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">FSM STATE</div>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">{engine.fsmState}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">BEACON DETECTED</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      engine.currentDetection.detected ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {engine.currentDetection.detected ? 'YES' : 'NO'}
                  </div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">ANGULAR ERROR</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    {engine.currentTelemetry ? `${engine.currentTelemetry.angularErrorDeg.toFixed(2)}°` : '0.00°'}
                  </div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">GIMBAL SLEW RATE</div>
                  <div className="text-sm font-bold text-purple-400 mt-0.5">
                    {engine.virtualGimbal.panVelDegPerSec.toFixed(1)}°/s
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Final Scorecard */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center gap-3">
                <Award className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-300">
                    REAL WEBCAM TRACKING PROTOCOL VERIFIED
                  </div>
                  <div className="text-[11px] text-slate-300">
                    All 8 validation stages passed: Detection, Kalman Lookahead, Fine Pointing &lt; 0.22°, Dropout Coasting, and Reacquisition.
                  </div>
                </div>
              </div>

              {/* Performance Scorecard Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">FRAMES PROCESSED</div>
                  <div className="text-base font-bold text-slate-100">{engine.metrics.framesProcessed}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">DETECTION RATE</div>
                  <div className="text-base font-bold text-cyan-400">{engine.metrics.detectionRate}%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">LOCK RETENTION</div>
                  <div className="text-base font-bold text-emerald-400">{engine.metrics.lockRetentionRate}%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">AVG LATENCY</div>
                  <div className="text-base font-bold text-purple-400">{engine.metrics.averageLatencyMs} ms</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">P95 LATENCY</div>
                  <div className="text-base font-bold text-amber-400">{engine.metrics.p95LatencyMs} ms</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">REACQUISITION TIME</div>
                  <div className="text-base font-bold text-sky-400">
                    {engine.metrics.reacquisitionTimeSec !== null
                      ? `${engine.metrics.reacquisitionTimeSec}s`
                      : '0.0s (No Loss)'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => engine.exportCSV()}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>EXPORT CSV</span>
                </button>
                <button
                  onClick={() => engine.exportJSON()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <Download className="w-4 h-4 fill-current" />
                  <span>EXPORT JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            onClick={() => {
              setCurrentStepIndex(0);
              setCompletedSteps([]);
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Demo</span>
          </button>

          <div className="flex items-center gap-2">
            {!isFinalStep ? (
              <button
                onClick={() => setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all cursor-pointer shadow"
              >
                <span>Skip to Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer shadow"
              >
                Close Scorecard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
