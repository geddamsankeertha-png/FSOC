import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Layers,
  Cpu,
  Compass,
  Activity,
  ShieldCheck,
  ExternalLink,
  Camera,
  Wind,
  Navigation,
  FileText,
  CheckCircle2,
} from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'objectives' | 'camera' | 'targets' | 'disturbances' | 'perception' | 'kalman' | 'pid' | 'fsm' | 'visualization' | 'webcam'
  >('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight">
                FSOC PAT VIRTUAL CAMERA TRACKING SIMULATOR — SPECIFICATION ARCHITECTURE
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                SIH26169 Technical Documentation & Complete Mathematical Model (Sections 1–11)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 overflow-x-auto text-xs font-mono">
          {[
            { id: 'overview', label: '1. Overview', icon: Layers },
            { id: 'objectives', label: '2. Objectives', icon: Activity },
            { id: 'camera', label: '3. Camera & Gimbal', icon: Camera },
            { id: 'targets', label: '4. Target Dynamics', icon: Navigation },
            { id: 'disturbances', label: '5. Disturbances', icon: Wind },
            { id: 'perception', label: '6. Perception & AI', icon: Cpu },
            { id: 'kalman', label: '7. Kalman Filter', icon: Compass },
            { id: 'pid', label: '8. PID Control', icon: ShieldCheck },
            { id: 'fsm', label: '9. Lock FSM', icon: CheckCircle2 },
            { id: 'visualization', label: '10–11. UI & Tactical', icon: FileText },
            { id: 'webcam', label: '12. Live Webcam & Calibration', icon: Camera },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-3 border-b-2 font-semibold whitespace-nowrap transition-colors ${
                  activeSection === tab.id
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 font-mono text-xs text-slate-300">
          {/* SECTION 1: PROJECT OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <Layers className="w-4 h-4" /> 1. PROJECT OVERVIEW
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The <strong>FSOC PAT Virtual Camera Tracking Simulator</strong> is a software-based simulation and validation platform developed for the coarse Pointing, Acquisition, and Tracking (PAT) problem in next-generation Free Space Optical Communication (FSOC) systems.
                </p>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  Free Space Optical Communication enables high-capacity wireless communication through highly directional optical beams, offering significant advantages such as high data rates, license-free optical spectrum, low electromagnetic interference, and enhanced security. However, the extremely narrow beam divergence associated with optical communication introduces stringent pointing requirements. Even small angular deviations between communicating terminals can result in beam misalignment and loss of the optical link.
                </p>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The developed simulator addresses the initial coarse alignment and tracking stage of the PAT process. It provides a realistic, configurable, and hardware-independent environment in which optical beacon acquisition, target detection, position estimation, tracking, and virtual pan-tilt camera control can be developed and evaluated without requiring expensive optical sensors, cameras, gimbals, or laboratory equipment.
                </p>
              </div>

              {/* Complete Closed-Loop Block Diagram */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  The Complete Closed-Loop Tracking Architecture
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-cyan-300 text-[11px] leading-relaxed flex flex-wrap items-center gap-2">
                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-200">Virtual Environment</span>
                  <span className="text-emerald-400">→</span>
                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-200">Camera Sensing</span>
                  <span className="text-emerald-400">→</span>
                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-200">Beacon Detection</span>
                  <span className="text-emerald-400">→</span>
                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-200">State Estimation</span>
                  <span className="text-emerald-400">→</span>
                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-200">Camera Control</span>
                  <span className="text-emerald-400">→</span>
                  <span className="bg-emerald-950 border border-emerald-500/40 px-2 py-1 rounded text-emerald-300 font-bold">
                    Target Re-acquisition / Tracking
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  The platform is designed to support algorithm development, performance benchmarking, robustness testing, visualization, and future hardware-in-the-loop (HIL) integration.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 2: SYSTEM OBJECTIVE */}
          {activeSection === 'objectives' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Activity className="w-4 h-4" /> 2. SYSTEM OBJECTIVE
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The primary objective of the project is to develop an <strong>AI-assisted virtual camera tracking system</strong> capable of autonomously detecting, acquiring, and continuously tracking a designated moving optical beacon under realistic environmental and platform disturbances.
                </p>
                <div className="text-xs font-bold text-slate-200 pt-2">
                  The simulator reproduces the essential behavior of a coarse PAT subsystem by providing:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {[
                    'A configurable virtual environment',
                    'Dynamically moving optical targets',
                    'A controllable virtual pan-tilt camera',
                    'Realistic camera field-of-view and perspective projection',
                    'Automated optical beacon detection',
                    'Classical computer-vision and AI-based perception modes',
                    'Predictive target tracking (Kalman Filter)',
                    'Closed-loop pan-tilt control (PID + Feedforward)',
                    'Atmospheric and platform disturbance simulation',
                    'Real-time tracking visualization (Synthetic HUD + Radar)',
                    'Automated performance evaluation and benchmarking',
                  ].map((obj, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-slate-200">{obj}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 pt-2">
                  The architecture is intentionally hardware-independent, enabling PAT algorithms to be developed and validated before deployment on physical cameras and gimbal systems.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 3: VIRTUAL CAMERA AND GIMBAL DYNAMICS */}
          {activeSection === 'camera' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-purple-400">
                  <Camera className="w-4 h-4" /> 3. VIRTUAL CAMERA AND GIMBAL DYNAMICS
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The simulator incorporates a physically motivated virtual camera and pan-tilt gimbal model.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Image Resolution</span>
                    <strong className="text-cyan-300 text-xs">1280×720 / 1920×1080</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">FOV (Horiz × Vert)</span>
                    <strong className="text-cyan-300 text-xs">50° × 30° (Configurable)</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Max Pan / Tilt Rates</span>
                    <strong className="text-cyan-300 text-xs">Up to 80°/s Slew Rate</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Pan Travel Limits</span>
                    <strong className="text-cyan-300 text-xs">-90° to +90° Physical Limit</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Tilt Travel Limits</span>
                    <strong className="text-cyan-300 text-xs">-45° to +45° Physical Limit</strong>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Actuator Dynamic Model</span>
                    <strong className="text-cyan-300 text-xs">Euler Inertia & Latency</strong>
                  </div>
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  A pinhole camera projection model is used to transform the three-dimensional angular position of the optical beacon into its corresponding two-dimensional sensor coordinates.
                </p>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-purple-300 text-[11px]">
                  <strong>Kinematic Relationship:</strong> Target Line-of-Sight → Camera Orientation → Image Position
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  The virtual gimbal incorporates angular-rate constraints and physical angle clamping to prevent unrealistically instantaneous camera movements. This allows the controller to be evaluated under realistic actuator limitations and introduces an important source of latency into the tracking loop.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 4: DYNAMIC TARGET AND SCENE GENERATION */}
          {activeSection === 'targets' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <Navigation className="w-4 h-4" /> 4. DYNAMIC TARGET AND SCENE GENERATION
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  To evaluate the robustness of the tracking algorithms under different target-motion conditions, the simulator provides multiple configurable trajectory models:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                  {[
                    { name: 'Circular Orbit', desc: 'Predictable smooth orbital trajectory with continuous angular acceleration.' },
                    { name: 'Sinusoidal Wave', desc: 'Elevation and azimuth wave sweeps mimicking aerodynamic loitering.' },
                    { name: 'Figure-8 / Lissajous', desc: 'Multi-frequency orthogonal motion testing dual-axis coupling.' },
                    { name: 'Linear Sweep', desc: 'Constant-velocity horizon crossing evaluating target transit acquisition.' },
                    { name: 'Stochastic Walk', desc: 'Non-linear random-walk model with superimposed multi-band drift.' },
                    { name: 'High-G Evasive Maneuver', desc: 'Rapid direction reversals and speed bursts testing controller slew limits.' },
                  ].map((traj, idx) => (
                    <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                      <div className="text-amber-400 font-bold text-xs">{traj.name}</div>
                      <div className="text-slate-400 text-[10px] mt-1">{traj.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-slate-300 text-[11px] mt-2">
                  <strong className="text-rose-400">Multi-Target & Clutter Sources:</strong> The simulator additionally supports multiple optical targets and clutter sources, including false decoy lights and solar-glint-like objects. This allows the perception system to be evaluated not only for target detection but also for <strong>target discrimination and false-lock rejection</strong>.
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: ATMOSPHERIC AND PLATFORM DISTURBANCE MODELING */}
          {activeSection === 'disturbances' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-rose-400">
                  <Wind className="w-4 h-4" /> 5. ATMOSPHERIC AND PLATFORM DISTURBANCE MODELING
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  Real-world FSOC PAT systems operate in the presence of disturbances caused by platform dynamics, atmospheric propagation, and sensor imperfections. The simulator therefore incorporates configurable disturbance models to reproduce these effects:
                </p>

                {/* 5.1 Airframe Vibration */}
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-cyan-400 font-bold text-xs">5.1 Airframe Vibration</div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    The platform vibration model introduces multi-frequency oscillations representative of UAV motor resonances, structural vibration, and wind-induced motion. The vibration model introduces disturbances in the approximate <strong>18–25 Hz range</strong> and allows the severity of the disturbance to be varied during testing. This evaluates whether the tracking controller can maintain target lock despite rapid camera orientation disturbances.
                  </p>
                </div>

                {/* 5.2 Atmospheric Turbulence */}
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-purple-400 font-bold text-xs">5.2 Atmospheric Turbulence</div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    An atmospheric turbulence model is incorporated to simulate the effects of refractive-index fluctuations (Cn²) and optical propagation disturbances. The model reproduces:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 pl-2">
                    <li><strong>Beam wandering:</strong> Spatial deviation of the optical centroid.</li>
                    <li><strong>Apparent beacon-position fluctuations:</strong> Random refractive angle shifts.</li>
                    <li><strong>Intensity scintillation:</strong> Rapid log-normal intensity fluctuations.</li>
                    <li><strong>Temporal variation in beacon visibility:</strong> Low-frequency fades and surges.</li>
                  </ul>
                </div>

                {/* 5.3 Optical and Sensor Degradation */}
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-amber-400 font-bold text-xs">5.3 Optical and Sensor Degradation</div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    The simulator supports several sensor-level degradation mechanisms:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                      • Gaussian sensor/readout noise
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                      • Optical defocus blur
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                      • Point-Spread-Function (PSF)
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                      • Diffraction / bloom spikes
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                      • Temporary beam obstruction
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                      • Cloud / obstacle target dropout
                    </div>
                  </div>
                  <p className="text-slate-400 text-[10px] pt-1">
                    These disturbances allow the perception and tracking algorithms to be tested under progressively degraded sensing conditions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: BEACON DETECTION AND PERCEPTION */}
          {activeSection === 'perception' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Cpu className="w-4 h-4" /> 6. BEACON DETECTION AND PERCEPTION ARCHITECTURE
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The simulator provides two complementary perception pipelines for evaluating coarse optical beacon detection:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-emerald-400 font-bold text-xs">6.1 Classical Computer Vision Mode</div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Uses deterministic image-processing techniques to identify optical beacon candidates:
                    </p>
                    <div className="p-2.5 bg-black/60 rounded text-cyan-300 text-[10px] font-mono leading-relaxed">
                      Adaptive Intensity Thresholding<br />
                      → Connected Component / Contour Extraction<br />
                      → Candidate Geometry & Spatial Filtering<br />
                      → Intensity Centroid Estimation (Center-of-Mass)
                    </div>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      <strong>Characteristics:</strong> Extremely fast execution (&lt;1.5 ms), zero training requirements. However, susceptible to false positives in high clutter, solar glints, or low SNR (&lt;2 dB).
                    </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-purple-400 font-bold text-xs">6.2 AI-Based Neural Detection Mode</div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      A deep vision neural architecture tailored for difficult, high-interference optical communication scenarios:
                    </p>
                    <div className="p-2.5 bg-black/60 rounded text-purple-300 text-[10px] font-mono leading-relaxed">
                      Deep Convolutional Feature Extractor<br />
                      → Temporal Modulation Pattern Classifier<br />
                      → Optical Beacon Discriminator (Rejects Decoys)<br />
                      → Sub-Pixel Bounding Box & Centroid Regression
                    </div>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      <strong>Characteristics:</strong> Robust target discrimination, rejects decoy light sources, operates reliably in low SNR environments (down to -4 dB) with 96%+ classification confidence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: POSITION ESTIMATION & KALMAN TRACKING */}
          {activeSection === 'kalman' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-purple-400">
                  <Compass className="w-4 h-4" /> 7. POSITION ESTIMATION AND PREDICTIVE TRACKING
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  Raw optical detections contain measurement noise, blur, and frame latency. The simulator implements a <strong>2D Discrete-Time Kalman Filter</strong> with a Constant-Velocity (CV) kinematic motion model:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-slate-100 font-bold text-xs">State Vector & System Matrices</div>
                    <div className="p-2.5 bg-black/60 rounded text-emerald-400 text-[11px] font-mono leading-relaxed">
                      State: x = [u, v, v_u, v_v]^T<br />
                      F = [[1, 0, Δt, 0],<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[0, 1, 0, Δt],<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[0, 0, 1, 0],<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[0, 0, 0, 1]]<br />
                      H = [[1, 0, 0, 0],<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[0, 1, 0, 0]]
                    </div>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-slate-100 font-bold text-xs">Latency Compensation & Coasting</div>
                    <div className="p-2.5 bg-black/60 rounded text-cyan-400 text-[11px] font-mono leading-relaxed">
                      Lookahead Prediction:<br />
                      x(t + τ) = x(t) + v_u · τ<br />
                      y(t + τ) = y(t) + v_v · τ<br />
                      where τ = camera sensor & compute latency (~20ms)<br />
                      Coasting: P_k = F P_(k-1) F^T + Q (no H update)
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  <strong>Coasting Mode:</strong> When an optical dropout occurs (e.g. temporary cloud occlusion or heavy fog), the Kalman filter transitions to coasting. It propagates the target trajectory forward based on estimated velocity vectors, allowing the gimbal to track smoothly until optical reacquisition occurs.
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: CLOSED-LOOP GIMBAL CONTROL */}
          {activeSection === 'pid' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <ShieldCheck className="w-4 h-4" /> 8. CLOSED-LOOP VIRTUAL CAMERA CONTROL (PID + FEEDFORWARD)
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The tracking loop computes pointing errors relative to the optical center (W/2, H/2) and issues angular rate commands to the virtual pan-tilt gimbal:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-slate-100 font-bold text-xs">Image Centroid to Angular Error Mapping</div>
                    <div className="p-2.5 bg-black/60 rounded text-amber-400 text-[11px] font-mono leading-relaxed">
                      e_x = x_target - (W / 2)<br />
                      e_y = y_target - (H / 2)<br />
                      θ_pan_err = (e_x / (W / 2)) · (FOV_x / 2)<br />
                      θ_tilt_err = (e_y / (H / 2)) · (FOV_y / 2)
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Converts pixel displacements directly into physical gimbal angular tracking errors.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-slate-100 font-bold text-xs">Dual-Axis PID with Velocity Feedforward</div>
                    <div className="p-2.5 bg-black/60 rounded text-emerald-400 text-[11px] font-mono leading-relaxed">
                      u(t) = K_p e(t) + K_i ∫ e(τ) dτ + K_d D_filt + K_ff v_tgt<br />
                      D_filt(k) = α D_filt(k-1) + (1 - α) [e(k) - e(k-1)] / Δt<br />
                      Clamping: |u(t)| ≤ MaxSlewRate (35°/s pan, 25°/s tilt)<br />
                      Anti-windup: |∫ e dτ| ≤ 15.0°
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Derivative low-pass filtering (α=0.7) prevents high-frequency chatter from camera noise.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 9: LOCK STATE MANAGEMENT */}
          {activeSection === 'fsm' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> 9. ACQUISITION, TRACKING, AND LOCK STATE MANAGEMENT
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The PAT process is modeled as a formal finite-state tracking system with multi-condition lock verification:
                </p>

                <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-cyan-400 font-bold text-xs">Finite State Machine Transitions</div>
                  <div className="p-2.5 bg-black/60 rounded text-slate-200 text-[11px] font-mono leading-relaxed">
                    SEARCHING → ACQUIRING → TRACKING → LOCKED<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↘ (loss) COASTING → REACQUIRING ↗
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 pt-1">
                    <li><strong>SEARCHING:</strong> Target not detected in field of view. Gimbal scans or decays velocity.</li>
                    <li><strong>ACQUIRING:</strong> Initial candidate detected; Kalman filter initializes state.</li>
                    <li><strong>TRACKING:</strong> Target actively tracked; closed-loop controller converging.</li>
                    <li><strong>LOCKED:</strong> Formal optical lock criteria satisfied with temporal persistence.</li>
                    <li><strong>COASTING:</strong> Detection temporarily lost; predictive Kalman extrapolation maintains pointing.</li>
                    <li><strong>REACQUIRING:</strong> Target re-detected following coasting; re-establishing fine alignment.</li>
                    <li><strong>LOST:</strong> Covariance threshold or maximum coast duration exceeded without reacquisition.</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-emerald-400 font-bold text-xs">Formal Lock Criterion Formulation</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    To prevent transient camera detections from incorrectly triggering fine optical communication:
                  </p>
                  <div className="p-2.5 bg-black/60 rounded text-emerald-300 text-[11px] font-mono leading-relaxed">
                    1. Target within sensor FOV: (0 ≤ x ≤ W, 0 ≤ y ≤ H)<br />
                    2. Detector Confidence: C_det ≥ 0.70 (70%)<br />
                    3. Angular Pointing Error: θ_err &lt; 0.22° (~3.84 mrad, inside fine link divergence)<br />
                    4. Temporal Persistence: Criteria 1–3 sustained for N ≥ 8 consecutive frames (~130 ms)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10 & 11: VISUALIZATION & SPATIAL TACTICAL VIEW */}
          {activeSection === 'visualization' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-400">
                  <FileText className="w-4 h-4" /> 10 & 11. VISUALIZATION, SENSOR HUD, AND SPATIAL TACTICAL VIEW
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The platform couples two synchronized visual validation viewpoints running at 60 FPS:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-cyan-400 font-bold text-xs">Section 10: Synthetic Visual Sensor Feed & HUD</div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                      <li>Simulated optical scene with sky background & celestial stars</li>
                      <li>Pulsing beacon with optical glow, diffraction spikes, & lens flare</li>
                      <li>Optical boresight reticle with calibrated crosshair ticks</li>
                      <li>Fine-pointing lock boundary (&lt;0.22° / 3.8 mrad)</li>
                      <li>Detection bounding box with real-time confidence readout</li>
                      <li>Kalman lookahead prediction point and velocity vector</li>
                      <li>HUD with instantaneous pointing error in degrees & mrad</li>
                    </ul>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-emerald-400 font-bold text-xs">Section 11: Spatial Tactical View & Geometry</div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                      <li>Top-down radar link geometry with calibrated distance rings</li>
                      <li>UAV-A (Transmitter / Tracking terminal) position</li>
                      <li>UAV-B (Target terminal) trajectory & historical breadcrumb trail</li>
                      <li>Virtual camera field-of-view (FOV) projection cone frustum</li>
                      <li>Target line-of-sight (LOS) vector</li>
                      <li>Simulated optical laser communication beam with beam divergence</li>
                      <li>Real-time azimuth / elevation alignment indicators</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 12: LIVE WEBCAM TRACKING & REAL-WORLD VALIDATION */}
          {activeSection === 'webcam' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Camera className="w-4 h-4" /> 12. LIVE WEBCAM TRACKING & REAL-WORLD PAT VALIDATION
                </div>
                <p className="text-slate-300 leading-relaxed text-[12px]">
                  The Live Webcam Mode transforms the simulator into a real-time hardware-in-the-loop tracking testbed. A real USB/built-in camera replaces the synthetic camera feed, while the existing Classical CV, AI Neural, 2D Kalman filter, and closed-loop PID gimbal controller execute in real-time.
                </p>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed">
                  <div className="text-cyan-400 font-bold mb-1">Pinhole Camera Calibration Model:</div>
                  f_x = (W / 2) / tan(FOV_x / 2), &nbsp; f_y = (H / 2) / tan(FOV_y / 2)<br />
                  x_norm = (x - c_x) / f_x, &nbsp; y_norm = (y - c_y) / f_y<br />
                  r² = x_norm² + y_norm², &nbsp; x_undist = x_norm · (1 + k₁ · r²)<br />
                  θ_pan = arctan(x_undist) · (180 / π), &nbsp; θ_tilt = arctan(y_undist) · (180 / π)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-cyan-400 font-bold text-xs">Evaluation Reference (Ground Truth)</div>
                    <p className="text-[11px] text-slate-300">
                      An optical fiducial marker provides independent ground-truth line-of-sight tracking verification in real physical space, computing true angular error without synthetic simulator assumptions.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="text-emerald-400 font-bold text-xs">Software Disturbance Verification</div>
                    <p className="text-[11px] text-slate-300">
                      Controlled additive noise, defocus blur, contrast degradation, synthetic platform vibration, and beam dropout can be injected into the real video stream to stress-test Kalman coasting and recovery.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-[11px] text-amber-200">
                  <strong>Engineering Note on Hardware Translation:</strong> A consumer webcam operates across the visible spectrum (RGB). In deployed FSOC field hardware, this is replaced by an InGaAs sensor array centered at 850 nm / 1550 nm with narrow-band dielectric optical bandpass filters to reject ambient solar radiance.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs font-mono text-slate-400">
          <span>Standards: IEEE FSO PAT Guidelines & SIH 2026 SIH26169 Specification</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
