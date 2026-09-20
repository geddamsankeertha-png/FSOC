import React, { useState, useEffect } from 'react';
import { WebcamTrackingEngine } from '../simulation/webcamTrackingEngine';
import {
  Compass,
  Cpu,
  Layers,
  Activity,
  Sliders,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Share2,
} from 'lucide-react';

interface WebcamGimbalTacticalViewProps {
  engine: WebcamTrackingEngine;
}

export const WebcamGimbalTacticalView: React.FC<WebcamGimbalTacticalViewProps> = ({ engine }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const tele = engine.currentTelemetry;
  const history = (engine?.telemetryHistory || []).slice(-40);

  // Generate simulated hardware command serial packet
  const panRateInt = Math.round((tele?.cmdPanRateDegPerSec || 0) * 100);
  const tiltRateInt = Math.round((tele?.cmdTiltRateDegPerSec || 0) * 100);
  const chkSum = ((panRateInt ^ tiltRateInt ^ 0xaa) & 0xff).toString(16).toUpperCase().padStart(2, '0');
  const serialPacket = `$GIMBAL,P_RATE:${(tele?.cmdPanRateDegPerSec || 0).toFixed(2)},T_RATE:${(tele?.cmdTiltRateDegPerSec || 0).toFixed(2)},FSM:${engine.fsmState},CRC:${chkSum}*`;

  return (
    <div id="webcam-gimbal-tactical-view" className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-mono text-xs">
      {/* 1. Virtual Gimbal Mount & Actuator Dynamics */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Virtual Gimbal Kinematics
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Closed-Loop PID
            </span>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 leading-relaxed">
            Simulates the physical Pan/Tilt optical mount slewing to center the live optical beacon.
            Distinguishes <span className="text-cyan-300 font-semibold">Webcam Optical Sensor</span> from{' '}
            <span className="text-emerald-300 font-semibold">Gimbal Actuator Output</span>.
          </div>

          {/* Dual Axis Gauges */}
          <div className="mt-4 space-y-4">
            {/* Pan Axis */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-bold text-cyan-400">AZIMUTH / PAN AXIS</span>
                <span className="text-slate-100 font-bold text-sm">
                  {engine.virtualGimbal.panDeg.toFixed(2)}°
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Limit: -90°</span>
                <span className="text-cyan-300">Rate: {engine.virtualGimbal.panVelDegPerSec.toFixed(1)}°/s</span>
                <span>Limit: +90°</span>
              </div>
              <div className="relative w-full h-2.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-cyan-500 transition-all duration-75"
                  style={{
                    left: '50%',
                    width: `${Math.min(50, Math.abs(engine.virtualGimbal.panDeg / 90) * 50)}%`,
                    transform: engine.virtualGimbal.panDeg < 0 ? 'translateX(-100%)' : 'none',
                  }}
                />
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400" />
              </div>
            </div>

            {/* Tilt Axis */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-bold text-emerald-400">ELEVATION / TILT AXIS</span>
                <span className="text-slate-100 font-bold text-sm">
                  {engine.virtualGimbal.tiltDeg.toFixed(2)}°
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Limit: -45°</span>
                <span className="text-emerald-300">Rate: {engine.virtualGimbal.tiltVelDegPerSec.toFixed(1)}°/s</span>
                <span>Limit: +45°</span>
              </div>
              <div className="relative w-full h-2.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500 transition-all duration-75"
                  style={{
                    left: '50%',
                    width: `${Math.min(50, Math.abs(engine.virtualGimbal.tiltDeg / 45) * 50)}%`,
                    transform: engine.virtualGimbal.tiltDeg < 0 ? 'translateX(-100%)' : 'none',
                  }}
                />
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Hardware-Readiness Command Stream */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Hardware Actuator Serial Stream (UART / PWM Preview)</span>
          </div>
          <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-[10px] text-emerald-400 truncate">
            {serialPacket}
          </div>
        </div>
      </div>

      {/* 2. Real-Time Telemetry Trend Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Live Pointing Error (deg)
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Cone Limit: &lt; 0.22°
            </span>
          </div>

          <div className="mt-3 relative h-40 bg-slate-950 rounded-lg border border-slate-800 p-2 flex items-end overflow-hidden">
            {/* 0.22 deg threshold line */}
            <div
              className="absolute left-0 right-0 border-b border-dashed border-emerald-500/60 z-10"
              style={{ bottom: '22%' }}
            >
              <span className="absolute right-2 -top-4 text-[9px] text-emerald-400 font-bold bg-slate-950/80 px-1 rounded">
                0.22° LINK LOCK CONE
              </span>
            </div>

            {/* Sparkline bars */}
            <div className="w-full h-full flex items-end gap-1">
              {history.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                  Awaiting live frames...
                </div>
              ) : (
                history.map((pt, i) => {
                  const maxErr = 1.0;
                  const hPct = Math.min(100, Math.max(4, (pt.angularErrorDeg / maxErr) * 100));
                  const isLocked = pt.angularErrorDeg < 0.22 && pt.fsmState === 'LOCKED';
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all duration-75"
                      style={{
                        height: `${hPct}%`,
                        backgroundColor: isLocked ? '#10b981' : pt.fsmState === 'COASTING' ? '#a855f7' : '#f59e0b',
                      }}
                      title={`Frame ${pt.frameId}: ${pt.angularErrorDeg.toFixed(2)}° (${pt.fsmState})`}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <div className="text-slate-500">CURRENT ERROR</div>
            <div className="text-xs font-bold text-cyan-400">
              {tele ? `${tele.angularErrorDeg.toFixed(3)}°` : '0.000°'}
            </div>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <div className="text-slate-500">COARSE CONE</div>
            <div className="text-xs font-bold text-emerald-400">&lt; 0.22°</div>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <div className="text-slate-500">STATUS</div>
            <div className="text-xs font-bold text-purple-400">{engine.fsmState}</div>
          </div>
        </div>
      </div>

      {/* 3. Evaluation Reference & Validation Scorecard */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Ground Truth Evaluation Reference
              </span>
            </div>
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                engine.evalReference.enabled
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {engine.evalReference.enabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 leading-relaxed">
            Uses an optical fiducial marker to independently measure real line-of-sight tracking accuracy
            in physical space without simulator assumptions.
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">Fiducial Detected:</span>
              <span className={engine.evalReference.detected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {engine.evalReference.detected ? 'YES (LOCKED)' : 'NOT IN SCENE'}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">Physical True Error:</span>
              <span className="text-cyan-400 font-bold text-sm">
                {engine.evalReference.trueTrackingErrorDeg !== null
                  ? `${engine.evalReference.trueTrackingErrorDeg.toFixed(3)}°`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">True Angular Error (mrad):</span>
              <span className="text-amber-400 font-bold">
                {engine.evalReference.trueTrackingErrorMrad !== null
                  ? `${engine.evalReference.trueTrackingErrorMrad} mrad`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Autonomous FSM Pipeline Active</span>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready for Benchmark</span>
          </div>
        </div>
      </div>
    </div>
  );
};
