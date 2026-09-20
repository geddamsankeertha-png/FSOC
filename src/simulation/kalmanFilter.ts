/**
 * 2D Constant-Velocity Discrete Kalman Filter for Optical Beacon Tracking.
 * State vector: [x, y, vx, vy]^T (screen pixel space)
 * Handles prediction, measurement updates, coasting during occlusion,
 * and lookahead latency compensation.
 */

import { KalmanState } from '../types';

export class BeaconKalmanFilter {
  // State: [x, y, vx, vy]
  private x: number = 0;
  private y: number = 0;
  private vx: number = 0;
  private vy: number = 0;

  // Covariance matrix 4x4 stored as flat array of 16 elements
  private P: number[] = [
    100, 0, 0, 0,
    0, 100, 0, 0,
    0, 0, 50, 0,
    0, 0, 0, 50
  ];

  // Process noise parameter (acceleration variance)
  private qVar: number = 25.0;

  // Measurement noise variance (sensor pixel jitter)
  private rVar: number = 4.0;

  private isInitialized: boolean = false;
  private coastingFrames: number = 0;

  // Measurement innovation & position tracking history for real-time visualization
  public lastResidual: { resX: number; resY: number } = { resX: 0, resY: 0 };
  public positionHistory: Array<{
    t: number;
    measuredX: number | null;
    measuredY: number | null;
    predX: number;
    predY: number;
  }> = [];

  constructor(qVariance: number = 25.0, rVariance: number = 4.0) {
    this.qVar = qVariance;
    this.rVar = rVariance;
    this.reset();
  }

  public reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.P = [
      100, 0, 0, 0,
      0, 100, 0, 0,
      0, 0, 50, 0,
      0, 0, 0, 50
    ];
    this.isInitialized = false;
    this.coastingFrames = 0;
    this.lastResidual = { resX: 0, resY: 0 };
    this.positionHistory = [];
  }

  public setNoiseParameters(qVariance: number, rVariance: number): void {
    this.qVar = Math.max(0.1, qVariance);
    this.rVar = Math.max(0.1, rVariance);
  }

  /**
   * Predict step forward by dt seconds
   */
  public predict(dt: number): { predX: number; predY: number } {
    if (!this.isInitialized) {
      return { predX: this.x, predY: this.y };
    }

    const dtSafe = Math.min(Math.max(dt, 0.001), 0.2);

    // State extrapolation: x = x + vx * dt; y = y + vy * dt
    this.x += this.vx * dtSafe;
    this.y += this.vy * dtSafe;

    // Process noise covariance addition Q with velocity-adaptive scaling for high-speed tracking
    const dt2 = dtSafe * dtSafe;
    const dt3 = (dt2 * dtSafe) / 2;
    const dt4 = (dt2 * dt2) / 4;
    const speedSq = this.vx * this.vx + this.vy * this.vy;
    const speedBoost = 1.0 + Math.min(6.0, speedSq / 15000);
    const q = this.qVar * speedBoost;

    // Update covariance P = F * P * F^T + Q
    // F is [1 0 dt 0; 0 1 0 dt; 0 0 1 0; 0 0 0 1]
    const p00 = this.P[0] + 2 * dtSafe * this.P[2] + dt2 * this.P[10] + dt4 * q;
    const p02 = this.P[2] + dtSafe * this.P[10] + dt3 * q;
    const p11 = this.P[5] + 2 * dtSafe * this.P[7] + dt2 * this.P[15] + dt4 * q;
    const p13 = this.P[7] + dtSafe * this.P[15] + dt3 * q;
    const p22 = this.P[10] + dt2 * q;
    const p33 = this.P[15] + dt2 * q;

    this.P[0] = p00;
    this.P[2] = p02;
    this.P[8] = p02;
    this.P[5] = p11;
    this.P[7] = p13;
    this.P[13] = p13;
    this.P[10] = p22;
    this.P[15] = p33;

    return { predX: this.x, predY: this.y };
  }

  /**
   * Update step with detected beacon centroid (zx, zy)
   */
  public update(zx: number, zy: number): void {
    if (!this.isInitialized) {
      this.x = zx;
      this.y = zy;
      this.vx = 0;
      this.vy = 0;
      this.isInitialized = true;
      this.coastingFrames = 0;
      return;
    }

    this.coastingFrames = 0;

    // Measurement residual y = z - H * x
    const resX = zx - this.x;
    const resY = zy - this.y;
    this.lastResidual = { resX: Number(resX.toFixed(2)), resY: Number(resY.toFixed(2)) };

    // Residual covariance S = H * P * H^T + R
    const sX = this.P[0] + this.rVar;
    const sY = this.P[5] + this.rVar;

    // Kalman Gain K = P * H^T * inv(S)
    const k0 = this.P[0] / sX;
    const k2 = this.P[8] / sX;
    const k1 = this.P[5] / sY;
    const k3 = this.P[13] / sY;

    // State update: x = x + K * y
    this.x += k0 * resX;
    this.vx += k2 * resX;
    this.y += k1 * resY;
    this.vy += k3 * resY;

    // Record position history for real-time explainability chart
    this.positionHistory.push({
      t: performance.now() / 1000,
      measuredX: zx,
      measuredY: zy,
      predX: this.x,
      predY: this.y,
    });
    if (this.positionHistory.length > 120) {
      this.positionHistory.shift();
    }

    // Covariance update: P = (I - K * H) * P
    this.P[0] *= (1 - k0);
    this.P[2] *= (1 - k0);
    this.P[8] = this.P[2];
    this.P[10] -= k2 * this.P[2];

    this.P[5] *= (1 - k1);
    this.P[7] *= (1 - k1);
    this.P[13] = this.P[7];
    this.P[15] -= k3 * this.P[7];
  }

  /**
   * Coasting update when target is missing (e.g. occlusion or blur dropout)
   */
  public coast(): void {
    this.coastingFrames++;
    this.lastResidual = { resX: 0, resY: 0 };
    // Covariance expands slightly to reflect increasing uncertainty
    this.P[0] += 5.0;
    this.P[5] += 5.0;

    // Record coasting predicted state (measured = null)
    this.positionHistory.push({
      t: performance.now() / 1000,
      measuredX: null,
      measuredY: null,
      predX: this.x,
      predY: this.y,
    });
    if (this.positionHistory.length > 120) {
      this.positionHistory.shift();
    }

    if (this.coastingFrames > 120) {
      // If lost for too long (> 2 seconds at 60fps), lose track
      this.isInitialized = false;
    }
  }

  /**
   * Lookahead prediction: Predict location at future time (e.g. to compensate gimbal latency)
   */
  public predictAhead(lookaheadSec: number): { x: number; y: number } {
    return {
      x: this.x + this.vx * lookaheadSec,
      y: this.y + this.vy * lookaheadSec,
    };
  }

  public getState(): KalmanState {
    const trace = this.P[0] + this.P[5] + this.P[10] + this.P[15];
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      predX: this.x,
      predY: this.y,
      covarianceTrace: trace,
      coastingFrames: this.coastingFrames,
      isInitialized: this.isInitialized,
    };
  }
}
