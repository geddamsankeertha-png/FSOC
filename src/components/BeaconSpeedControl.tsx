import React from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import { Gauge, Minus, Plus, RotateCcw, Zap } from 'lucide-react';

interface BeaconSpeedControlProps {
  engine: FSOCSimulationEngine;
  compact?: boolean;
  onSpeedChange?: (speed: number) => void;
}

export const BeaconSpeedControl: React.FC<BeaconSpeedControlProps> = ({
  engine,
  compact = false,
  onSpeedChange,
}) => {
  const currentSpeed = engine.targetConfig.speed;
  const targetVelPan = engine.targetState.velPanDegPerSec;
  const targetVelTilt = engine.targetState.velTiltDegPerSec;
  const angularSpeedDeg = Math.sqrt(targetVelPan * targetVelPan + targetVelTilt * targetVelTilt);

  const handleSpeedUpdate = (val: number) => {
    const clamped = Math.max(0.1, Math.min(5.0, Math.round(val * 10) / 10));
    engine.setBeaconSpeed(clamped);
    if (onSpeedChange) {
      onSpeedChange(clamped);
    }
  };

  const presets = [
    { label: '0.2x Low', value: 0.2 },
    { label: '0.5x Slow', value: 0.5 },
    { label: '1.0x Nominal', value: 1.0 },
    { label: '1.5x Fast', value: 1.5 },
    { label: '2.5x Sprint', value: 2.5 },
    { label: '4.0x Max', value: 4.0 },
  ];

  if (compact) {
    return (
      <div id="beacon-speed-compact-bar" className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-700/70 rounded-lg text-xs font-mono backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Beacon Spd:</span>
        </div>

        <button
          id="btn-beacon-speed-dec"
          type="button"
          onClick={() => handleSpeedUpdate(currentSpeed - 0.1)}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 active:bg-cyan-950 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
          title="Decrease speed by 0.1x"
        >
          <Minus className="w-3 h-3" />
        </button>

        <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
          <input
            id="input-beacon-speed-compact"
            type="number"
            min="0.1"
            max="5.0"
            step="0.1"
            value={currentSpeed}
            onChange={(e) => handleSpeedUpdate(parseFloat(e.target.value) || 1.0)}
            className="w-12 bg-transparent text-right font-mono font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <span className="text-slate-400 text-[11px]">x</span>
        </div>

        <button
          id="btn-beacon-speed-inc"
          type="button"
          onClick={() => handleSpeedUpdate(currentSpeed + 0.1)}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 active:bg-cyan-950 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
          title="Increase speed by 0.1x"
        >
          <Plus className="w-3 h-3" />
        </button>

        <input
          id="slider-beacon-speed-compact"
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={currentSpeed}
          onChange={(e) => handleSpeedUpdate(parseFloat(e.target.value))}
          className="w-20 md:w-28 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
        />

        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-700 text-slate-400 text-[11px]">
          <Gauge className="w-3 h-3 text-slate-400" />
          <span>{angularSpeedDeg.toFixed(1)}°/s</span>
        </div>
      </div>
    );
  }

  return (
    <div id="beacon-speed-control-card" className="p-4 bg-slate-900/95 border border-slate-800 rounded-xl shadow-lg font-sans">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Beacon Kinematic Velocity</h4>
            <p className="text-xs text-slate-400 font-mono">Dynamic optical target trajectory speed multiplier</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-reset-beacon-speed"
            type="button"
            onClick={() => handleSpeedUpdate(1.0)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/60"
            title="Reset to 1.0x Nominal"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset 1.0x</span>
          </button>
        </div>
      </div>

      {/* Main Input Row */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center mb-3">
        {/* Number Input with Steppers */}
        <div className="sm:col-span-5 flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
          <button
            id="btn-speed-minus-large"
            type="button"
            onClick={() => handleSpeedUpdate(currentSpeed - 0.1)}
            className="p-2 rounded bg-slate-900 hover:bg-slate-800 active:bg-cyan-950 text-slate-300 hover:text-white transition-colors border border-slate-800"
            title="Decrease speed"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-1 font-mono">
            <input
              id="input-beacon-speed-direct"
              type="number"
              min="0.1"
              max="5.0"
              step="0.1"
              value={currentSpeed}
              onChange={(e) => handleSpeedUpdate(parseFloat(e.target.value) || 1.0)}
              className="w-16 bg-transparent text-center font-mono font-bold text-lg text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
            />
            <span className="text-slate-400 font-semibold text-sm">x</span>
          </div>

          <button
            id="btn-speed-plus-large"
            type="button"
            onClick={() => handleSpeedUpdate(currentSpeed + 0.1)}
            className="p-2 rounded bg-slate-900 hover:bg-slate-800 active:bg-cyan-950 text-slate-300 hover:text-white transition-colors border border-slate-800"
            title="Increase speed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time Angular Velocity Gauge badge */}
        <div className="sm:col-span-7 flex items-center justify-between px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Angular Velocity:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-bold text-sm">{angularSpeedDeg.toFixed(2)}°/s</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
              angularSpeedDeg > 20
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {angularSpeedDeg > 20 ? 'High Dynamics' : 'Nominal PAT'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Range Slider */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>0.1x (Creep)</span>
          <span className="text-cyan-400 font-semibold">{currentSpeed.toFixed(1)}x Velocity Factor</span>
          <span>5.0x (Sprint)</span>
        </div>
        <input
          id="slider-beacon-speed-main"
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={currentSpeed}
          onChange={(e) => handleSpeedUpdate(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
        />
      </div>

      {/* Preset Quick-Pills */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {presets.map((preset) => (
          <button
            key={preset.value}
            id={`preset-speed-${preset.value}`}
            type="button"
            onClick={() => handleSpeedUpdate(preset.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all ${
              Math.abs(currentSpeed - preset.value) < 0.05
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};
