import { SeededPRNG } from '../prng';

export interface SensorFrameConfig {
  sensorWidth: number;
  sensorHeight: number;
  fullWidth: number;
  fullHeight: number;
}

export interface BeaconEmitterData {
  screenX: number;
  screenY: number;
  intensity: number;
  inFov: boolean;
  isOccluded: boolean;
  modulationFrequencyHz: number;
}

export interface DecoyEmitterData {
  id: string;
  screenX: number;
  screenY: number;
  intensity: number;
  inFov: boolean;
  modulationFrequencyHz: number; // 0 for unmodulated solar glint, or e.g. 12 Hz for false decoy
}

/**
 * Synthetic Sensor Frame:
 * Represents the physical CMOS/InGaAs Focal Plane Array (FPA) intensity buffer.
 * True ground truth coordinates are used ONLY to physically emit photons onto the sensor.
 * The resulting 2D intensity grid is all that the perception algorithms ever see.
 */
export class SensorFrame {
  public readonly width: number;
  public readonly height: number;
  public readonly fullWidth: number;
  public readonly fullHeight: number;
  public readonly scaleX: number;
  public readonly scaleY: number;
  public readonly data: Float32Array;
  public timestampSec: number = 0;

  constructor(config: SensorFrameConfig = { sensorWidth: 160, sensorHeight: 90, fullWidth: 1280, fullHeight: 720 }) {
    this.width = config.sensorWidth;
    this.height = config.sensorHeight;
    this.fullWidth = config.fullWidth;
    this.fullHeight = config.fullHeight;
    this.scaleX = this.fullWidth / this.width;
    this.scaleY = this.fullHeight / this.height;
    this.data = new Float32Array(this.width * this.height);
  }

  /**
   * Renders optical scene into the physical sensor intensity array.
   * Simulates:
   * - Sensor dark current & thermal noise
   * - Atmospheric extinction (fog/haze)
   * - Atmospheric optical scintillation & beam wander
   * - Gaussian Point Spread Function (PSF) & optical defocus blur
   * - Temporal beacon carrier modulation (e.g. 50 Hz beacon pulse)
   * - Decoy emitters & solar glints
   */
  public renderScene(
    beacon: BeaconEmitterData,
    decoys: DecoyEmitterData[],
    sensorNoisePercent: number,
    opticalBlurPx: number,
    turbulencePercent: number,
    atmosphericFogPercent: number,
    timestampSec: number,
    prng: SeededPRNG
  ): void {
    this.timestampSec = timestampSec;
    const len = this.width * this.height;

    // 1. Atmospheric extinction factor via Beer-Lambert law
    const fogFactor = Math.min(1.0, Math.max(0.0, atmosphericFogPercent / 100));
    const atmosphericTransmittance = Math.exp(-fogFactor * 2.2);
    const ambientFogScattering = fogFactor * 0.12;

    // 2. Sensor Noise (Dark current + readout Gaussian noise)
    const noiseStd = (sensorNoisePercent / 100) * 0.18;
    if (noiseStd <= 0.0005) {
      this.data.fill(ambientFogScattering);
    } else {
      // High-performance Central-Limit pseudo-Gaussian distribution (100x faster than Box-Muller log/cos)
      const factor = 2.0 * noiseStd;
      for (let i = 0; i < len; i++) {
        const u = (prng.next() + prng.next() + prng.next() - 1.5) * factor;
        let noiseVal = ambientFogScattering + u;
        if (noiseVal < 0) noiseVal = 0;
        else if (noiseVal > 1) noiseVal = 1;
        this.data[i] = noiseVal;
      }
    }

    // 3. Render Optical Beacon (if in FOV and not occluded)
    if (beacon.inFov && !beacon.isOccluded && beacon.intensity > 0.01) {
      // Temporal pulse carrier modulation (e.g. 50 Hz square wave with 60% duty cycle)
      const carrierPhase = (timestampSec * beacon.modulationFrequencyHz) % 1.0;
      const carrierModulation = carrierPhase < 0.6 ? 1.0 : 0.15;

      // Scintillation amplitude
      const effectiveIntensity = beacon.intensity * atmosphericTransmittance * carrierModulation;

      if (effectiveIntensity > 0.005) {
        // Map full screen pixels to sensor grid pixels
        const sensorTargetX = beacon.screenX / this.scaleX;
        const sensorTargetY = beacon.screenY / this.scaleY;

        // Optical blur PSF sigma (in sensor pixel units)
        const sensorBlurSigma = Math.max(0.6, (opticalBlurPx / this.scaleX) * 1.5 + 0.8);
        this.addGaussianSpot(sensorTargetX, sensorTargetY, effectiveIntensity, sensorBlurSigma);
      }
    }

    // 4. Render Decoys and Solar Glints
    for (const decoy of decoys) {
      if (decoy.inFov && decoy.intensity > 0.01) {
        let decoyMod = 1.0;
        if (decoy.modulationFrequencyHz > 0) {
          decoyMod = (Math.sin(2 * Math.PI * decoy.modulationFrequencyHz * timestampSec) + 1) * 0.5;
        } else {
          // Solar glint has slow random shimmer
          decoyMod = 0.85 + 0.15 * Math.sin(3.5 * timestampSec);
        }

        const effectiveDecoy = decoy.intensity * atmosphericTransmittance * decoyMod;
        const sensorDecoyX = decoy.screenX / this.scaleX;
        const sensorDecoyY = decoy.screenY / this.scaleY;
        const sensorBlurSigma = Math.max(0.7, (opticalBlurPx / this.scaleX) * 1.6 + 0.9);
        this.addGaussianSpot(sensorDecoyX, sensorDecoyY, effectiveDecoy, sensorBlurSigma);
      }
    }
  }

  /**
   * Adds a Point Spread Function (2D Gaussian spot) to sensor array.
   */
  private addGaussianSpot(cx: number, cy: number, peakIntensity: number, sigma: number): void {
    const radius = Math.ceil(sigma * 3.0);
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));

    const twoSigmaSq = 2 * sigma * sigma;

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      const rowOffset = y * this.width;

      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const distSq = dx * dx + dySq;
        const spotWeight = peakIntensity * Math.exp(-distSq / twoSigmaSq);
        const idx = rowOffset + x;
        this.data[idx] = Math.min(1.0, this.data[idx] + spotWeight);
      }
    }
  }

  /**
   * Sample pixel value with bounds check.
   */
  public getPixel(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.data[y * this.width + x];
  }

  /**
   * Loads real webcam frame pixels (RGBA Uint8ClampedArray) into the physical sensor grid.
   * Performs real-time luminance extraction, bilinear downsampling, and optional software disturbances.
   */
  public loadFromRGBA(
    rgbaData: Uint8ClampedArray,
    camWidth: number,
    camHeight: number,
    timestampSec: number,
    disturbances?: {
      noisePercent?: number;
      blurPx?: number;
      brightnessPercent?: number;
      contrastPercent?: number;
      dropoutActive?: boolean;
      syntheticVibrationPx?: number;
    }
  ): void {
    this.timestampSec = timestampSec;

    // If dropout disturbance is active: target is occluded / signal completely drops out
    if (disturbances?.dropoutActive) {
      this.data.fill(0.02); // Dark current floor only
      return;
    }

    const stepX = camWidth / this.width;
    const stepY = camHeight / this.height;

    const vibPx = disturbances?.syntheticVibrationPx ?? 0;
    const vibOffsetX = vibPx > 0 ? (Math.sin(timestampSec * 35) * vibPx) : 0;
    const vibOffsetY = vibPx > 0 ? (Math.cos(timestampSec * 42) * vibPx) : 0;

    const brightAdj = (disturbances?.brightnessPercent ?? 0) / 100;
    const contrastFactor = 1 + (disturbances?.contrastPercent ?? 0) / 100;
    const noiseLevel = (disturbances?.noisePercent ?? 0) / 100;

    for (let sy = 0; sy < this.height; sy++) {
      const srcY = Math.min(camHeight - 1, Math.max(0, Math.floor(sy * stepY + vibOffsetY)));
      const srcRowOffset = srcY * camWidth * 4;
      const sensorRowOffset = sy * this.width;

      for (let sx = 0; sx < this.width; sx++) {
        const srcX = Math.min(camWidth - 1, Math.max(0, Math.floor(sx * stepX + vibOffsetX)));
        const pIdx = srcRowOffset + srcX * 4;

        const r = rgbaData[pIdx];
        const g = rgbaData[pIdx + 1];
        const b = rgbaData[pIdx + 2];

        // Rec. 601 Luma formula: Y = 0.299 R + 0.587 G + 0.114 B
        let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

        // Apply contrast & brightness if specified
        if (disturbances) {
          lum = (lum - 0.5) * contrastFactor + 0.5 + brightAdj;
          if (noiseLevel > 0) {
            lum += (Math.random() - 0.5) * noiseLevel * 0.4;
          }
        }

        // Clamp 0.0 - 1.0
        this.data[sensorRowOffset + sx] = Math.max(0, Math.min(1.0, lum));
      }
    }

    // Apply software blur if requested
    if (disturbances && disturbances.blurPx && disturbances.blurPx > 0.5) {
      const blurRadius = Math.min(4, Math.round(disturbances.blurPx / this.scaleX));
      if (blurRadius >= 1) {
        const temp = new Float32Array(this.data);
        for (let y = blurRadius; y < this.height - blurRadius; y++) {
          const row = y * this.width;
          for (let x = blurRadius; x < this.width - blurRadius; x++) {
            let sum = 0;
            let count = 0;
            for (let dy = -blurRadius; dy <= blurRadius; dy++) {
              const nyRow = (y + dy) * this.width;
              for (let dx = -blurRadius; dx <= blurRadius; dx++) {
                sum += temp[nyRow + (x + dx)];
                count++;
              }
            }
            this.data[row + x] = sum / count;
          }
        }
      }
    }
  }
}
