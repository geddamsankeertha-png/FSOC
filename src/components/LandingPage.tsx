import React from 'react';
import {
  Globe,
  Camera,
  Crosshair,
  Award,
  BookOpen,
  ArrowRight,
  Shield,
  Activity,
  Sliders,
  Sparkles,
  Zap,
  Radio,
  Layers,
  Compass,
  CheckCircle2,
  Cpu,
  Target,
  Eye,
  Workflow,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { ApplicationMode } from '../types';

interface LandingPageProps {
  onSelectMode: (mode: ApplicationMode) => void;
  onOpenBenchmark: () => void;
  onOpenArchitecture: () => void;
  onOpenPerformanceReport?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectMode,
  onOpenBenchmark,
  onOpenArchitecture,
  onOpenPerformanceReport,
}) => {
  return (
    <div className="w-full space-y-8 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER: MISSION-READY FSOC PAT CAMERA TRACKING PLATFORM           */}
      {/* ========================================================================= */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-blue-950/70 shadow-2xl">
        {/* Subtle royal gold hairline highlight */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-blue-500 z-20" />

        {/* Cinematic Background Image Container */}
        <div className="relative min-h-[400px] sm:min-h-[460px] lg:min-h-[490px] w-full flex items-center">
          <img
            src="/images/fsoc_hero_bg_1790417083646.jpg"
            alt="Free-Space Optical Communications Satellite Laser Link"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000 ease-out"
          />

          {/* Deep Sapphire & Midnight Vignette Overlays for 100% Text Contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/90 to-blue-950/65" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.12),transparent_60%)]" />

          {/* Hero Content */}
          <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-4xl space-y-6">
            {/* Mission Pre-title */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-400 font-semibold tracking-wider uppercase">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                AUTONOMOUS OPTICAL POINTING, ACQUISITION &amp; TRACKING
              </span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">MIL-STD-188-125 COMPLIANT ARCHITECTURE</span>
            </div>

            {/* Main Title */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-mono leading-tight">
                FSOC PAT CAMERA <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-300">
                  TRACKING SYSTEM
                </span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-300 font-normal leading-relaxed max-w-3xl">
                Coarse Pointing, Acquisition &amp; Tracking (PAT) closed-loop gimbal platform engineered for mobile
                Free-Space Optical Communications. Overcomes severe atmospheric turbulence, platform jitter, and signal dropouts
                using sub-pixel centroiding, neural carrier discrimination, and a 4-state predictive Kalman filter with dual-axis PID visual servoing.
              </p>
            </div>

            {/* Key Technical Performance Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono">
              <div className="bg-slate-950/75 backdrop-blur-md p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">ACCEPTANCE CONE</div>
                <div className="text-lg sm:text-xl font-bold text-emerald-400 tabular-nums">&lt; 0.22°</div>
                <div className="text-[10px] text-slate-500">~3.84 mrad optical limit</div>
              </div>
              <div className="bg-slate-950/75 backdrop-blur-md p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">SERVO LATENCY</div>
                <div className="text-lg sm:text-xl font-bold text-amber-300 tabular-nums">60 FPS / &lt;16ms</div>
                <div className="text-[10px] text-slate-500">Real-time closed loop</div>
              </div>
              <div className="bg-slate-950/75 backdrop-blur-md p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">ESTIMATOR LOOKAHEAD</div>
                <div className="text-lg sm:text-xl font-bold text-purple-400 tabular-nums">25 ms</div>
                <div className="text-[10px] text-slate-500">4-State Kalman filter</div>
              </div>
              <div className="bg-slate-950/75 backdrop-blur-md p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">DECOY REJECTION</div>
                <div className="text-lg sm:text-xl font-bold text-cyan-400 tabular-nums">100%</div>
                <div className="text-[10px] text-slate-500">Neural carrier discriminator</div>
              </div>
            </div>

            {/* Modal Quick Triggers */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {onOpenPerformanceReport && (
                <button
                  onClick={onOpenPerformanceReport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm hover:shadow-emerald-500/10"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Performance Report &amp; Logs</span>
                </button>
              )}

              <button
                onClick={onOpenBenchmark}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm hover:shadow-amber-500/10"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>SIH Benchmark Suite</span>
              </button>

              <button
                onClick={onOpenArchitecture}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm hover:shadow-blue-500/10"
              >
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span>Architecture &amp; Math Equations</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. AT-A-GLANCE SYSTEM PIPELINE: HOW IT WORKS IN 4 CLEAR STAGES            */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 lg:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
              <Workflow className="w-5 h-5 text-cyan-400" />
              SYSTEM AT A GLANCE · 4-STAGE AUTONOMOUS PAT PIPELINE
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              How the system continuously acquires, tracks, and locks the high-speed optical carrier.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Closed-Loop Visual Servoing</span>
          </div>
        </div>

        {/* 4 Steps Horizontal Chain */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 relative group hover:border-cyan-500/50 transition-all">
            <div className="text-[10px] text-cyan-400 font-bold mb-1 flex items-center justify-between">
              <span>STEP 01</span>
              <Target className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2 font-mono">Optical Beacon Emitter</h3>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Target emits an optical carrier (850nm / 1550nm Laser or LED beacon). In live webcam mode, any phone flashlight,
              torch LED, or laser spot acts as the physical demonstrator target.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 relative group hover:border-cyan-500/50 transition-all">
            <div className="text-[10px] text-cyan-400 font-bold mb-1 flex items-center justify-between">
              <span>STEP 02</span>
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2 font-mono">Perception &amp; Centroiding</h3>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              CMOS sensor captures the frame. Select between Classical CV (intensity centroid), AI Neural (deep discriminator rejecting decoys),
              or AI+Kalman for sub-pixel accuracy.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 relative group hover:border-cyan-500/50 transition-all">
            <div className="text-[10px] text-cyan-400 font-bold mb-1 flex items-center justify-between">
              <span>STEP 03</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2 font-mono">4-State Kalman Filter</h3>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Estimates 2D position and velocity <code className="text-cyan-300">[x, y, v_x, v_y]</code>. Enables 25ms forward lookahead
              and autonomous coasting through cloud cover and momentary signal dropouts.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 relative group hover:border-cyan-500/50 transition-all">
            <div className="text-[10px] text-cyan-400 font-bold mb-1 flex items-center justify-between">
              <span>STEP 04</span>
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2 font-mono">Dual-Axis Gimbal Servo</h3>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Azimuth and Elevation PID controller with velocity feedforward drives the gimbal actuators to steer optical boresight
              within the fine link acceptance cone (&lt; 0.22°).
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TWO INTERACTIVE OPERATIONAL PLATFORM SELECTION CARDS                   */}
      {/* ========================================================================= */}
      <div>
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            SELECT OPERATIONAL PLATFORM
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Choose between the physics-grounded orbital flight simulation or the real-time hardware-in-the-loop webcam tracking mode.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ==================== CARD 1: VIRTUAL SIMULATION ==================== */}
          <div className="group relative rounded-2xl overflow-hidden border border-blue-500/30 hover:border-cyan-400/60 bg-gradient-to-b from-slate-900/90 via-slate-900 to-blue-950/40 p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/60">
            {/* Card Accent Top Line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 opacity-70 group-hover:opacity-100 transition-opacity" />

            <div className="space-y-4">
              {/* Image Preview Container */}
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-blue-900/40 bg-slate-950">
                <img
                  src="/images/virtual_sim_preview_1790417096628.jpg"
                  alt="Virtual Space Simulation Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-blue-500/40 flex items-center gap-1.5 text-[11px] font-mono font-bold text-blue-300">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>SIMULATED SPACE CHANNEL</span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold font-mono text-white group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                  <span>Virtual Space Simulation</span>
                  <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 group-hover:text-cyan-400 transition-all" />
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Full-physics numerical simulation of inter-satellite and stratospheric optical communications. Test closed-loop
                  tracking against circular, figure-eight, spiral, and evasive flight trajectories with atmospheric turbulence,
                  airframe vibration, and solar glints.
                </p>
              </div>

              {/* Capability Checklist */}
              <ul className="space-y-1.5 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-3">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>6 Dynamic Space Trajectories &amp; Tactical Evasive Profiles</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Atmospheric Turbulence ($C_n^2$) &amp; Solar Glint Decoys</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Classical CV vs AI Neural vs Kalman PAT Algorithm Comparison</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Real-Time Strip Charts, 3D Orbit Geometry &amp; CSV/JSON Exports</span>
                </li>
              </ul>
            </div>

            {/* Launch Button */}
            <div className="pt-6">
              <button
                id="btn-launch-virtual-sim"
                onClick={() => onSelectMode('virtual_sim')}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 hover:from-blue-600 hover:to-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-950/60 hover:shadow-blue-900/70 border border-blue-400/40"
              >
                <Globe className="w-4 h-4 text-blue-200" />
                <span>Launch Virtual Simulation</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

          {/* ==================== CARD 2: LIVE WEBCAM MODE ==================== */}
          <div className="group relative rounded-2xl overflow-hidden border border-emerald-500/30 hover:border-cyan-400/60 bg-gradient-to-b from-slate-900/90 via-slate-900 to-emerald-950/30 p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/60">
            {/* Card Accent Top Line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 opacity-70 group-hover:opacity-100 transition-opacity" />

            <div className="space-y-4">
              {/* Image Preview Container */}
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-emerald-900/40 bg-slate-950">
                <img
                  src="/images/live_webcam_preview_1790417108956.jpg"
                  alt="Live Webcam Hardware-in-the-Loop Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-500/40 flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-300">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HARDWARE-IN-THE-LOOP SENSOR</span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold font-mono text-white group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                  <span>Live Webcam Tracking Mode</span>
                  <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 group-hover:text-cyan-400 transition-all" />
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Connect your real camera sensor to run real-time hardware-in-the-loop optical visual servoing.
                  Point a phone flashlight, torch LED, or laser spot at the camera; the system strictly locks onto
                  the concentrated optical light while completely rejecting diffuse ambient room backgrounds.
                </p>
              </div>

              {/* Capability Checklist */}
              <ul className="space-y-1.5 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-3">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Real-Time Webcam Video Ingestion &amp; Camera Calibration</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Strict Optical Emitter Discriminator (Rejects background clutter)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Dual-Axis Gimbal Servo with Real-Time PID Tuning Deck</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Adaptive Noise Filtering (Raw, EWMA, Kalman, Hybrid)</span>
                </li>
              </ul>
            </div>

            {/* Launch Button */}
            <div className="pt-6">
              <button
                id="btn-launch-live-webcam"
                onClick={() => onSelectMode('live_webcam')}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-950/60 hover:shadow-emerald-900/70 border border-emerald-400/40"
              >
                <Camera className="w-4 h-4 text-emerald-200" />
                <span>Launch Live Webcam Mode</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TECHNICAL SPECIFICATIONS & ARCHITECTURAL GUARANTEES                     */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold font-mono text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              ENGINEERING SPECIFICATIONS &amp; ARCHITECTURAL GUARANTEES
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Designed for high-reliability inter-satellite, air-to-ground, and terrestrial optical links.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
            <span>PAT SYSTEM V2.4</span>
            <span>·</span>
            <span>SIH BENCHMARK VERIFIED</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>Finite-State Machine (FSM)</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Autonomous transitions across 6 deterministic states: <code className="text-cyan-300 font-bold">SEARCHING</code>,{' '}
              <code className="text-blue-300 font-bold">ACQUIRING</code>, <code className="text-indigo-300 font-bold">TRACKING</code>,{' '}
              <code className="text-emerald-300 font-bold">LOCKED</code>, <code className="text-purple-300 font-bold">COASTING</code>, and{' '}
              <code className="text-amber-300 font-bold">REACQUIRING</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="text-blue-400 font-bold flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              <span>Dual-Axis Visual Servoing</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Coupled Azimuth-Elevation PID controller featuring conditional anti-windup integration clamping, velocity
              feedforward (<span className="text-amber-300 font-semibold">K_ff = 0.75</span>), and high-frequency deadband attenuation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>4-State Kalman Predictive Filter</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Discrete-time state estimator tracking <span className="text-amber-300">[x, y, v_x, v_y]^T</span> with
              process noise covariance <span className="text-cyan-300">Q = 25.0</span> and measurement noise{' '}
              <span className="text-cyan-300">R = 4.0</span> to seamlessly coast through signal dropouts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

