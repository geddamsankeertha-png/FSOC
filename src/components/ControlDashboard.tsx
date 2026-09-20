import React, { useState } from 'react';
import { FSOCSimulationEngine } from '../simulation/simulationEngine';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Wind,
  Cpu,
  Navigation,
  Camera,
  Zap,
  Shield,
  Layers,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { PerceptionMode, TrajectoryType } from '../types';
import { BeaconSpeedControl } from './BeaconSpeedControl';

interface ControlDashboardProps {
  engine: FSOCSimulationEngine;
  onStateChange: () => void;
}

export const ControlDashboard: React.FC<ControlDashboardProps> = ({ engine, onStateChange }) => {
  const [activeTab, setActiveTab] = useState<'disturbances' | 'target' | 'camera_gimbal' | 'controller' | 'presets'>('disturbances');
  const [, setTick] = useState(0);

  const forceUpdate = () => {
    setTick((t) => t + 1);
    onStateChange();
  };

  const handlePlayPause = () => {
    engine.isRunning = !engine.isRunning;
    forceUpdate();
  };

  const handleReset = () => {
    engine.resetSimulation();
    forceUpdate();
  };

  const setPerceptionMode = (mode: PerceptionMode) => {
    engine.perceptionMode = mode;
    forceUpdate();
  };

  const setTrajectory = (traj: TrajectoryType) => {
    engine.targetConfig.trajectory = traj;
    forceUpdate();
  };

  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'baseline':
        engine.disturbanceConfig.sensorNoisePercent = 3;
        engine.disturbanceConfig.platformVibrationDeg = 0.05;
        engine.disturbanceConfig.turbulencePercent = 5;
        engine.disturbanceConfig.opticalBlurPx = 1.0;
        engine.targetConfig.multiTargetClutter = false;
        engine.targetConfig.speed = 1.0;
        engine.targetConfig.trajectory = 'circular';
        engine.perceptionMode = 'kalman_predictive';
        break;
      case 'vibration':
        engine.disturbanceConfig.sensorNoisePercent = 10;
        engine.disturbanceConfig.platformVibrationDeg = 1.5;
        engine.disturbanceConfig.vibrationFrequencyHz = 22; // 18-25 Hz range
        engine.disturbanceConfig.turbulencePercent = 15;
        engine.targetConfig.trajectory = 'sinusoidal';
        engine.perceptionMode = 'kalman_predictive';
        break;
      case 'turbulence':
        engine.disturbanceConfig.sensorNoisePercent = 25;
        engine.disturbanceConfig.turbulencePercent = 65;
        engine.disturbanceConfig.opticalBlurPx = 5.5;
        engine.disturbanceConfig.platformVibrationDeg = 0.4;
        engine.perceptionMode = 'ai_neural';
        break;
      case 'clutter':
        engine.targetConfig.multiTargetClutter = true;
        engine.targetConfig.trajectory = 'evasive';
        engine.targetConfig.speed = 1.4;
        engine.disturbanceConfig.sensorNoisePercent = 18;
        engine.disturbanceConfig.turbulencePercent = 30;
        engine.perceptionMode = 'ai_neural';
        break;
      case 'dropout':
        engine.targetConfig.trajectory = 'circular';
        engine.targetConfig.speed = 0.9;
        engine.perceptionMode = 'kalman_predictive';
        engine.disturbanceConfig.manualOcclusion = true;
        setTimeout(() => {
          engine.disturbanceConfig.manualOcclusion = false;
          forceUpdate();
        }, 2000);
        break;
      case 'low_snr':
        engine.disturbanceConfig.sensorNoisePercent = 30;
        engine.disturbanceConfig.opticalBlurPx = 6.0;
        engine.disturbanceConfig.atmosphericFogPercent = 50;
        engine.disturbanceConfig.turbulencePercent = 65;
        engine.targetConfig.speed = 0.8;
        engine.perceptionMode = 'ai_neural';
        break;
    }
    forceUpdate();
  };

  const handleSeedChange = (newSeed: number) => {
    engine.resetSimulation(newSeed);
    forceUpdate();
  };

  return (
    <div id="control-dashboard" className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Top Header & Simulation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/90 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          <button
            id="btn-play-pause"
            onClick={handlePlayPause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all shadow ${
              engine.isRunning
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold'
            }`}
          >
            {engine.isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" /> PAUSE
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> RESUME
              </>
            )}
          </button>

          <button
            id="btn-reset-sim"
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> RESET
          </button>

          {/* Reproducible PRNG Seed Control */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 font-bold">SEED:</span>
            <span className="text-emerald-400 font-bold px-1">{engine.currentSeed}</span>
            <button
              onClick={() => handleSeedChange(Math.floor(Math.random() * 900) + 100)}
              className="text-slate-400 hover:text-cyan-300 ml-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              title="Generate new pseudorandom seed"
            >
              Random
            </button>
            <button
              onClick={() => handleSeedChange(42)}
              className="text-slate-400 hover:text-cyan-300 px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              title="Set to canonical Seed 42"
            >
              #42
            </button>
            <button
              onClick={() => handleSeedChange(101)}
              className="text-slate-400 hover:text-cyan-300 px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              title="Set to Test Seed 101"
            >
              #101
            </button>
          </div>

          <button
            id="btn-trigger-occlusion"
            onClick={() => {
              engine.disturbanceConfig.manualOcclusion = !engine.disturbanceConfig.manualOcclusion;
              forceUpdate();
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all border ${
              engine.disturbanceConfig.manualOcclusion
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Simulates temporary beam obstruction / cloud target dropout"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {engine.disturbanceConfig.manualOcclusion ? 'CLOUD DROPOUT ACTIVE' : 'OBSTRUCT BEAM'}
          </button>
        </div>

        {/* Perception Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <span className="text-slate-400 text-[10px] uppercase px-2">PERCEPTION:</span>
          <button
            id="mode-cv-btn"
            onClick={() => setPerceptionMode('classical_cv')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              engine.perceptionMode === 'classical_cv'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Classical CV: Adaptive intensity thresholding and centroiding"
          >
            Classical CV
          </button>
          <button
            id="mode-ai-btn"
            onClick={() => setPerceptionMode('ai_neural')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              engine.perceptionMode === 'ai_neural'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="AI Neural Detector: Modulation classification and decoy rejection"
          >
            AI Neural
          </button>
          <button
            id="mode-kalman-btn"
            onClick={() => setPerceptionMode('kalman_predictive')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              engine.perceptionMode === 'kalman_predictive'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="AI + Kalman: State estimation, lookahead prediction, and occlusion coasting"
          >
            AI + Kalman (PAT)
          </button>
        </div>
      </div>

      {/* Sub-Tabs Bar */}
      <div className="flex border-b border-slate-800 bg-slate-950/50 px-3 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveTab('disturbances')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'disturbances'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wind className="w-3.5 h-3.5" /> Disturbances & Atmosphere
        </button>
        <button
          onClick={() => setActiveTab('camera_gimbal')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'camera_gimbal'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Camera & Gimbal Dynamics
        </button>
        <button
          onClick={() => setActiveTab('target')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'target'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" /> Target Flight Dynamics
        </button>
        <button
          onClick={() => setActiveTab('controller')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'controller'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> PID Controller Tuning
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'presets'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Test Presets
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-4 text-xs font-mono">
        {/* 1. DISTURBANCES & ATMOSPHERE PANEL */}
        {activeTab === 'disturbances' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 5.1 Airframe Vibration Amplitude */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>5.1 Platform Vibration Amplitude</span>
                  <span className="text-cyan-400 font-bold">±{engine.disturbanceConfig.platformVibrationDeg.toFixed(2)}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3.0"
                  step="0.05"
                  value={engine.disturbanceConfig.platformVibrationDeg}
                  onChange={(e) => {
                    engine.disturbanceConfig.platformVibrationDeg = parseFloat(e.target.value);
                    forceUpdate();
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.0° (Rigid Base)</span>
                  <span>UAV Structural / Motor Jitter</span>
                  <span>3.0° (High)</span>
                </div>
              </div>

              {/* 5.1 Airframe Vibration Frequency (18-25 Hz) */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>5.1 Motor Vibration Frequency (Section 5.1)</span>
                  <span className="text-cyan-400 font-bold">{engine.disturbanceConfig.vibrationFrequencyHz.toFixed(1)} Hz</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="28"
                  step="0.5"
                  value={engine.disturbanceConfig.vibrationFrequencyHz}
                  onChange={(e) => {
                    engine.disturbanceConfig.vibrationFrequencyHz = parseFloat(e.target.value);
                    forceUpdate();
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>16 Hz (Low)</span>
                  <span className="text-emerald-400 font-semibold">18–25 Hz Standard UAV Range</span>
                  <span>28 Hz</span>
                </div>
              </div>

              {/* 5.2 Atmospheric Turbulence */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>5.2 Atmospheric Turbulence & Scintillation</span>
                  <span className="text-purple-400 font-bold">{engine.disturbanceConfig.turbulencePercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={engine.disturbanceConfig.turbulencePercent}
                  onChange={(e) => {
                    engine.disturbanceConfig.turbulencePercent = parseInt(e.target.value);
                    forceUpdate();
                  }}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Calm Air (Cn² ≈ 10⁻¹⁶)</span>
                  <span>Beam Wandering & Scintillation</span>
                  <span>Deep Fading</span>
                </div>
              </div>

              {/* 5.3 Sensor Gaussian Noise */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>5.3 Sensor Gaussian / Readout Noise</span>
                  <span className="text-amber-400 font-bold">{engine.disturbanceConfig.sensorNoisePercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={engine.disturbanceConfig.sensorNoisePercent}
                  onChange={(e) => {
                    engine.disturbanceConfig.sensorNoisePercent = parseInt(e.target.value);
                    forceUpdate();
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0% (Ideal Sensor)</span>
                  <span>Poisson Shot & Readout Noise</span>
                  <span>50% (High Degrade)</span>
                </div>
              </div>

              {/* 5.3 Optical Defocus & PSF Blur */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 col-span-1 md:col-span-2">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>5.3 Optical Defocus / Point-Spread-Function (PSF) Blur</span>
                  <span className="text-rose-400 font-bold">{engine.disturbanceConfig.opticalBlurPx.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={engine.disturbanceConfig.opticalBlurPx}
                  onChange={(e) => {
                    engine.disturbanceConfig.opticalBlurPx = parseFloat(e.target.value);
                    forceUpdate();
                  }}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Diffraction-Limited Airy Disk</span>
                  <span>Lens Defocus & Atmospheric Optical Dispersion</span>
                  <span>10 px (Extreme Defocus)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. VIRTUAL CAMERA & GIMBAL DYNAMICS PANEL (Section 3) */}
        {activeTab === 'camera_gimbal' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Resolution selection */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>Sensor Resolution</span>
                  <span className="text-cyan-400 font-bold">{engine.cameraConfig.width} × {engine.cameraConfig.height}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      engine.cameraConfig.width = 1280;
                      engine.cameraConfig.height = 720;
                      forceUpdate();
                    }}
                    className={`p-2 rounded text-center border font-mono ${
                      engine.cameraConfig.width === 1280
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    720p HD (1280×720)
                  </button>
                  <button
                    onClick={() => {
                      engine.cameraConfig.width = 1920;
                      engine.cameraConfig.height = 1080;
                      forceUpdate();
                    }}
                    className={`p-2 rounded text-center border font-mono ${
                      engine.cameraConfig.width === 1920
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1080p FHD (1920×1080)
                  </button>
                </div>
                <div className="text-[10px] text-slate-500">Pinhole focal length scales automatically.</div>
              </div>

              {/* Horizontal FOV */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>Horizontal Field of View (FOV_x)</span>
                  <span className="text-cyan-400 font-bold">{engine.cameraConfig.fovXDeg}°</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="75"
                  step="2"
                  value={engine.cameraConfig.fovXDeg}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    engine.cameraConfig.fovXDeg = val;
                    engine.cameraConfig.fovYDeg = Math.round(val * 0.6);
                    forceUpdate();
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>30° (Narrow Telephoto)</span>
                  <span>FOV_y: {engine.cameraConfig.fovYDeg}° (16:9 Aspect)</span>
                  <span>75° (Wide Angle)</span>
                </div>
              </div>

              {/* Max Slew Rate Limits */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>Maximum Pan Slew Rate</span>
                  <span className="text-emerald-400 font-bold">{engine.cameraConfig.maxPanRateDegPerSec}°/s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={engine.cameraConfig.maxPanRateDegPerSec}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    engine.setMaxPanSlewRate(val);
                    engine.cameraConfig.maxTiltRateDegPerSec = Math.round(val * 0.7);
                    forceUpdate();
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>10°/s (Slow Actuator)</span>
                  <span>Tilt Slew: {engine.cameraConfig.maxTiltRateDegPerSec}°/s</span>
                  <span>90°/s (High Speed)</span>
                </div>
              </div>

              {/* Physical Travel Limits */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-200 font-semibold">
                  <span>Physical Pan Angle Clamping</span>
                  <span className="text-emerald-400 font-bold">±{engine.cameraConfig.panMaxDeg}°</span>
                </div>
                <input
                  type="range"
                  min="45"
                  max="180"
                  step="15"
                  value={engine.cameraConfig.panMaxDeg}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    engine.setPanTravelLimit(val);
                    forceUpdate();
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>±45° (Restricted Azimuth)</span>
                  <span>Mechanical Hard Stop Limits</span>
                  <span>±180° (Full 360°)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. TARGET FLIGHT DYNAMICS PANEL (Section 4) */}
        {activeTab === 'target' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { id: 'circular', label: 'Circular Orbit', desc: 'Continuous orbital path' },
                { id: 'sinusoidal', label: 'Sinusoidal', desc: 'Elevation sweep loitering' },
                { id: 'figure8', label: 'Figure-8', desc: 'Lissajous 3D pattern' },
                { id: 'linear', label: 'Linear Sweep', desc: 'Cross-horizon transit' },
                { id: 'stochastic', label: 'Stochastic', desc: 'Random-walk trajectory' },
                { id: 'evasive', label: 'Evasive Flight', desc: 'High-G tactical maneuver' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTrajectory(item.id as TrajectoryType)}
                  className={`p-3 rounded-lg text-left border transition-all ${
                    engine.targetConfig.trajectory === item.id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="font-bold text-xs">{item.label}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{item.desc}</div>
                </button>
              ))}
            </div>

            <div className="space-y-4 pt-2">
              <BeaconSpeedControl engine={engine} onSpeedChange={() => forceUpdate()} />

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-200 font-bold">Multi-Target Clutter & Solar Glint</div>
                  <div className="text-[10px] text-slate-400">Tests AI false-alarm rejection against decoy lights</div>
                </div>
                <button
                  onClick={() => {
                    engine.targetConfig.multiTargetClutter = !engine.targetConfig.multiTargetClutter;
                    forceUpdate();
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    engine.targetConfig.multiTargetClutter
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {engine.targetConfig.multiTargetClutter ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. PID CONTROLLER TUNING PANEL */}
        {activeTab === 'controller' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-200">
                <span>Proportional Gain (Kp)</span>
                <span className="text-emerald-400 font-bold">{engine.pidGains.kp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.1"
                value={engine.pidGains.kp}
                onChange={(e) => {
                  engine.pidGains.kp = parseFloat(e.target.value);
                  forceUpdate();
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">Fast reaction to angular pointing error</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-200">
                <span>Integral Gain (Ki)</span>
                <span className="text-emerald-400 font-bold">{engine.pidGains.ki.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={engine.pidGains.ki}
                onChange={(e) => {
                  engine.pidGains.ki = parseFloat(e.target.value);
                  forceUpdate();
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">Eliminates steady-state bias (anti-windup clamped)</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-200">
                <span>Derivative Gain (Kd)</span>
                <span className="text-emerald-400 font-bold">{engine.pidGains.kd.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={engine.pidGains.kd}
                onChange={(e) => {
                  engine.pidGains.kd = parseFloat(e.target.value);
                  forceUpdate();
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">Low-pass filtered damping (α=0.7)</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between col-span-1 md:col-span-3">
              <div>
                <div className="text-slate-200 font-bold">Kalman Velocity Feedforward Compensation</div>
                <div className="text-[10px] text-slate-400">Pre-emptively drives gimbal using estimated target velocity</div>
              </div>
              <button
                onClick={() => {
                  engine.pidGains.feedforward = !engine.pidGains.feedforward;
                  forceUpdate();
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  engine.pidGains.feedforward
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {engine.pidGains.feedforward ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 col-span-1 md:col-span-3">
              <div>
                <div className="text-slate-200 font-bold">Lock Evaluation Mode (PAT Link Criteria)</div>
                <div className="text-[10px] text-slate-400">Selects error signal used for coarse-PAT lock persistence threshold (&lt;0.22°)</div>
              </div>
              <div className="flex gap-1">
                {(['optical-instantaneous', 'mechanical-boresight', 'filtered-optical'] as const).map((m) => (
                  <button
                    key={m}
                    id={`lock-mode-${m}-btn`}
                    onClick={() => {
                      engine.lockEvaluationMode = m;
                      forceUpdate();
                    }}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-all ${
                      engine.lockEvaluationMode === m
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'optical-instantaneous' ? 'Optical (Instant)' : m === 'mechanical-boresight' ? 'Mechanical (Boresight)' : 'Filtered Optical (EWMA)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. TEST PRESETS PANEL */}
        {activeTab === 'presets' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => applyPreset('baseline')}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group"
            >
              <div className="text-emerald-400 font-bold group-hover:underline">1. Clean Baseline</div>
              <div className="text-[11px] text-slate-300 mt-1">Zero disturbances, smooth circular trajectory.</div>
              <div className="text-[10px] text-slate-500 mt-2">Validates nominal PAT tracking & acquisition.</div>
            </button>

            <button
              onClick={() => applyPreset('vibration')}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
            >
              <div className="text-cyan-400 font-bold group-hover:underline">2. UAV Rotor Vibration</div>
              <div className="text-[11px] text-slate-300 mt-1">±1.5° jitter at 22 Hz motor resonance.</div>
              <div className="text-[10px] text-slate-500 mt-2">Tests disturbance rejection & PID D-filtering.</div>
            </button>

            <button
              onClick={() => applyPreset('turbulence')}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-purple-500/50 text-left transition-all group"
            >
              <div className="text-purple-400 font-bold group-hover:underline">3. Severe Turbulence</div>
              <div className="text-[11px] text-slate-300 mt-1">65% scintillation + 5.5px lens defocus.</div>
              <div className="text-[10px] text-slate-500 mt-2">Tests AI neural perception under low SNR.</div>
            </button>

            <button
              onClick={() => applyPreset('clutter')}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-rose-500/50 text-left transition-all group"
            >
              <div className="text-rose-400 font-bold group-hover:underline">4. Tactical Decoys & Clutter</div>
              <div className="text-[11px] text-slate-300 mt-1">False optical beacons + agile evasive target.</div>
              <div className="text-[10px] text-slate-500 mt-2">AI discrimination against decoy spoofing.</div>
            </button>

            <button
              onClick={() => applyPreset('dropout')}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 text-left transition-all group"
            >
              <div className="text-amber-400 font-bold group-hover:underline">5. Beacon Dropout & Coast</div>
              <div className="text-[11px] text-slate-300 mt-1">Temporary 2-second beam obstruction.</div>
              <div className="text-[10px] text-slate-500 mt-2">Evaluates Kalman coasting and reacquisition.</div>
            </button>

            <button
              onClick={() => applyPreset('low_snr')}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-sky-500/50 text-left transition-all group"
            >
              <div className="text-sky-400 font-bold group-hover:underline">6. Deep Fog (-2.5 dB SNR)</div>
              <div className="text-[11px] text-slate-300 mt-1">50% fog attenuation with 6.0px blur.</div>
              <div className="text-[10px] text-slate-500 mt-2">Sub-pixel centroiding in heavy fog.</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
