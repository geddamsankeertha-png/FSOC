/**
 * Closed-Loop Dual-Axis (Pan / Tilt) PID Controller for FSOC PAT Gimbal.
 * Converts pixel error to angular error, applies PID with anti-windup,
 * incorporates velocity feedforward, and honors physical actuator slew rates.
 */

import { CameraConfig, PIDGains, PIDTerms } from '../types';

export class PATGimbalController {
  private integralPan: number = 0;
  private integralTilt: number = 0;
  private prevErrorPanDeg: number = 0;
  private prevErrorTiltDeg: number = 0;
  private prevDPan: number = 0;
  private prevDTilt: number = 0;

  public lastTerms: PIDTerms = {
    pPan: 0,
    iPan: 0,
    dPan: 0,
    ffPan: 0,
    totalPan: 0,
    pTilt: 0,
    iTilt: 0,
    dTilt: 0,
    ffTilt: 0,
    totalTilt: 0,
  };

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.integralPan = 0;
    this.integralTilt = 0;
    this.prevErrorPanDeg = 0;
    this.prevErrorTiltDeg = 0;
    this.prevDPan = 0;
    this.prevDTilt = 0;
    this.lastTerms = {
      pPan: 0,
      iPan: 0,
      dPan: 0,
      ffPan: 0,
      totalPan: 0,
      pTilt: 0,
      iTilt: 0,
      dTilt: 0,
      ffTilt: 0,
      totalTilt: 0,
    };
  }

  /**
   * Converts pixel offset from center to angular offset in degrees.
   */
  public pixelToAngularError(
    pixelX: number,
    pixelY: number,
    cameraConfig: CameraConfig
  ): { errorPanDeg: number; errorTiltDeg: number } {
    const halfW = cameraConfig.width / 2;
    const halfH = cameraConfig.height / 2;

    const errorPixelX = pixelX - halfW;
    const errorPixelY = pixelY - halfH;

    // Pin-hole focal length model
    const fx = halfW / Math.tan((cameraConfig.fovXDeg * Math.PI) / 360);
    const fy = halfH / Math.tan((cameraConfig.fovYDeg * Math.PI) / 360);

    const errorPanDeg = (Math.atan(errorPixelX / fx) * 180) / Math.PI;
    // In screen coords, positive Y is downward, so positive tilt tilts down
    const errorTiltDeg = (Math.atan(errorPixelY / fy) * 180) / Math.PI;

    return { errorPanDeg, errorTiltDeg };
  }

  /**
   * Computes gimbal rate commands (deg/s) from angular error and Kalman feedforward.
   */
  public computeCommand(
    errorPanDeg: number,
    errorTiltDeg: number,
    feedforwardPanRate: number,
    feedforwardTiltRate: number,
    dt: number,
    gains: PIDGains,
    cameraConfig: CameraConfig
  ): { cmdPanRateDegPerSec: number; cmdTiltRateDegPerSec: number } {
    const dtSafe = Math.min(Math.max(dt, 0.001), 0.1);

    // Deadband check to eliminate jitter around zero
    const deadbandDeg = (gains.deadbandPx / (cameraConfig.width / 2)) * (cameraConfig.fovXDeg / 2);
    const effErrorPan = Math.abs(errorPanDeg) < deadbandDeg ? 0 : errorPanDeg;
    const effErrorTilt = Math.abs(errorTiltDeg) < deadbandDeg ? 0 : errorTiltDeg;

    // 1. Proportional term
    const pPan = gains.kp * effErrorPan;
    const pTilt = gains.kp * effErrorTilt;

    // 2. Integral term with anti-windup clamping
    this.integralPan += effErrorPan * dtSafe;
    this.integralTilt += effErrorTilt * dtSafe;
    this.integralPan = Math.max(-gains.integralClamp, Math.min(gains.integralClamp, this.integralPan));
    this.integralTilt = Math.max(-gains.integralClamp, Math.min(gains.integralClamp, this.integralTilt));
    const iPan = gains.ki * this.integralPan;
    const iTilt = gains.ki * this.integralTilt;

    // 3. Derivative term with low-pass filter (alpha = 0.7) to attenuate sensor noise
    const rawDPan = (effErrorPan - this.prevErrorPanDeg) / dtSafe;
    const rawDTilt = (effErrorTilt - this.prevErrorTiltDeg) / dtSafe;
    const alpha = 0.7;
    const filteredDPan = alpha * this.prevDPan + (1 - alpha) * rawDPan;
    const filteredDTilt = alpha * this.prevDTilt + (1 - alpha) * rawDTilt;
    this.prevDPan = filteredDPan;
    this.prevDTilt = filteredDTilt;
    this.prevErrorPanDeg = effErrorPan;
    this.prevErrorTiltDeg = effErrorTilt;
    const dPan = gains.kd * filteredDPan;
    const dTilt = gains.kd * filteredDTilt;

    // 4. Feedforward term (Kalman estimated target velocity)
    const ffPan = gains.feedforward ? gains.kff * feedforwardPanRate : 0;
    const ffTilt = gains.feedforward ? gains.kff * feedforwardTiltRate : 0;

    // Total angular velocity command
    let cmdPan = pPan + iPan + dPan + ffPan;
    let cmdTilt = pTilt + iTilt + dTilt + ffTilt;

    // Slew rate limits
    cmdPan = Math.max(-cameraConfig.maxPanRateDegPerSec, Math.min(cameraConfig.maxPanRateDegPerSec, cmdPan));
    cmdTilt = Math.max(-cameraConfig.maxTiltRateDegPerSec, Math.min(cameraConfig.maxTiltRateDegPerSec, cmdTilt));

    // Save actual controller term contributions for explainability
    this.lastTerms = {
      pPan: Number(pPan.toFixed(3)),
      iPan: Number(iPan.toFixed(3)),
      dPan: Number(dPan.toFixed(3)),
      ffPan: Number(ffPan.toFixed(3)),
      totalPan: Number(cmdPan.toFixed(3)),
      pTilt: Number(pTilt.toFixed(3)),
      iTilt: Number(iTilt.toFixed(3)),
      dTilt: Number(dTilt.toFixed(3)),
      ffTilt: Number(ffTilt.toFixed(3)),
      totalTilt: Number(cmdTilt.toFixed(3)),
    };

    return {
      cmdPanRateDegPerSec: cmdPan,
      cmdTiltRateDegPerSec: cmdTilt,
    };
  }

  public getLastTerms(): PIDTerms {
    return this.lastTerms;
  }
}
