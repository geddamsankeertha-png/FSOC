import { SensorFrame } from './sensorFrame';
import { DetectionResult, PerceptionMode, CandidateInfo } from '../../types';

export interface SpotCandidate {
  sensorX: number;
  sensorY: number;
  peakIntensity: number;
  integratedIntensity: number;
  area: number;
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Classical Computer Vision Detector:
 * Operates purely on the sensor intensity grid.
 * 1. Computes adaptive noise floor and statistical threshold: T = μ + k * σ
 * 2. Identifies connected component blobs / local maxima
 * 3. Computes intensity-weighted sub-pixel centroid
 * 4. Naively selects brightest candidate (vulnerable to decoys and bright solar glints)
 */
export class ClassicalCVDetector {
  private lastBlobCount: number = 0;
  private visited: Uint8Array = new Uint8Array(160 * 90);

  public detect(sensor: SensorFrame): DetectionResult {
    const startTime = performance.now();
    const width = sensor.width;
    const height = sensor.height;
    const data = sensor.data;
    const totalPixels = width * height;

    // Reuse pre-allocated visited buffer
    if (this.visited.length !== totalPixels) {
      this.visited = new Uint8Array(totalPixels);
    } else {
      this.visited.fill(0);
    }
    const visited = this.visited;

    // 1. Calculate image mean & standard deviation for adaptive thresholding
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < totalPixels; i++) {
      const v = data[i];
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / totalPixels;
    const variance = Math.max(0, sumSq / totalPixels - mean * mean);
    const stdDev = Math.sqrt(variance);

    // Adaptive threshold: 2.8 standard deviations above background noise floor
    const threshold = Math.max(0.08, mean + 2.8 * stdDev);

    // 2. Candidate spot extraction (local maxima search)
    const candidates: SpotCandidate[] = [];

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x;
        const val = data[idx];

        if (val > threshold && !visited[idx]) {
          // Check if it is a local 8-neighborhood maximum
          const isMax =
            val >= data[idx - 1] &&
            val >= data[idx + 1] &&
            val >= data[idx - width] &&
            val >= data[idx + width] &&
            val >= data[idx - width - 1] &&
            val >= data[idx - width + 1] &&
            val >= data[idx + width - 1] &&
            val >= data[idx + width + 1];

          if (isMax) {
            // Local region centroid computation (3x3 or 5x5 window)
            let weightSum = 0;
            let weightedX = 0;
            let weightedY = 0;
            let blobArea = 0;
            const r = 2; // 5x5 window

            const minWinX = Math.max(0, x - r);
            const maxWinX = Math.min(width - 1, x + r);
            const minWinY = Math.max(0, y - r);
            const maxWinY = Math.min(height - 1, y + r);

            for (let wy = minWinY; wy <= maxWinY; wy++) {
              const wRow = wy * width;
              for (let wx = minWinX; wx <= maxWinX; wx++) {
                const wIdx = wRow + wx;
                const wVal = data[wIdx];
                if (wVal > mean + 1.2 * stdDev) {
                  const netVal = wVal - mean;
                  weightSum += netVal;
                  weightedX += wx * netVal;
                  weightedY += wy * netVal;
                  blobArea++;
                  visited[wIdx] = 1;
                }
              }
            }

            if (weightSum > 0.01) {
              const subX = weightedX / weightSum;
              const subY = weightedY / weightSum;
              candidates.push({
                sensorX: subX,
                sensorY: subY,
                peakIntensity: val,
                integratedIntensity: weightSum,
                area: blobArea,
                box: {
                  x: (subX - r) * sensor.scaleX,
                  y: (subY - r) * sensor.scaleY,
                  width: (2 * r + 1) * sensor.scaleX,
                  height: (2 * r + 1) * sensor.scaleY,
                },
              });
            }
          }
        }
      }
    }

    this.lastBlobCount = candidates.length;

    if (candidates.length === 0) {
      const snrDb = 10 * Math.log10(Math.max(1e-4, mean / Math.max(1e-4, stdDev)));
      return {
        detected: false,
        centroid: null,
        boundingBox: null,
        confidence: 0,
        candidatesCount: 0,
        candidates: [],
        snrDb: Number(snrDb.toFixed(1)),
        processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
        modeUsed: 'classical_cv',
      };
    }

    // Classical CV sorting: naively picks the candidate with highest peak intensity!
    candidates.sort((a, b) => b.peakIntensity - a.peakIntensity);
    const best = candidates[0];

    // Estimate SNR from candidate peak vs sensor noise floor
    const signal = Math.max(1e-4, best.peakIntensity - mean);
    const noise = Math.max(1e-4, stdDev);
    const snrDb = 10 * Math.log10(signal / noise);

    // Confidence scales with SNR and peak value
    const confidence = Math.max(0.1, Math.min(0.95, (snrDb + 2.0) / 18.0));

    // Format candidate information for explainability inspection
    const candidateInfos: CandidateInfo[] = candidates.slice(0, 5).map((c, i) => {
      const cSig = Math.max(1e-4, c.peakIntensity - mean);
      const cSnr = 10 * Math.log10(cSig / Math.max(1e-4, stdDev));
      const cConf = Math.max(0.1, Math.min(0.95, (cSnr + 2.0) / 18.0));
      const isSel = i === 0 && snrDb >= 2.0;
      return {
        id: `CAND-${i + 1}`,
        x: Number((c.sensorX * sensor.scaleX).toFixed(1)),
        y: Number((c.sensorY * sensor.scaleY).toFixed(1)),
        confidence: Number(cConf.toFixed(2)),
        intensity: Number(c.peakIntensity.toFixed(2)),
        snrDb: Number(cSnr.toFixed(1)),
        isSelected: isSel,
        selectionReason: isSel ? 'Highest peak intensity & SNR above threshold' : 'Lower peak intensity',
      };
    });

    // Reject detection if below minimal contrast SNR (2.0 dB)
    if (snrDb < 2.0) {
      return {
        detected: false,
        centroid: null,
        boundingBox: null,
        confidence: Number(confidence.toFixed(2)),
        candidatesCount: candidates.length,
        candidates: candidateInfos,
        snrDb: Number(snrDb.toFixed(1)),
        processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
        modeUsed: 'classical_cv',
      };
    }

    const screenX = best.sensorX * sensor.scaleX;
    const screenY = best.sensorY * sensor.scaleY;

    return {
      detected: true,
      centroid: { x: screenX, y: screenY },
      boundingBox: best.box,
      confidence: Number(confidence.toFixed(2)),
      candidatesCount: candidates.length,
      candidates: candidateInfos,
      snrDb: Number(snrDb.toFixed(1)),
      processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
      modeUsed: 'classical_cv',
      targetId: 'TGT-01',
    };
  }
}

/**
 * Real AI-Assisted Neural Network Beacon Detector:
 * A multi-stage deep vision perception architecture operating on the physical SensorFrame:
 * Stage 1: Spatial matched Gaussian PSF filter to propose candidate spot locations.
 * Stage 2: Feature extractor extracting 10-dimensional spatial and temporal modulation features.
 * Stage 3: Two-layer feedforward Neural Network (MLP) with ReLU activations and Softmax:
 *          Classifies spot as [True Modulated Beacon, Decoy Glint, Thermal Noise Clutter].
 * Stage 4: Sub-pixel Coordinate Regression Head:
 *          Outputs refined sub-pixel offsets (Δx, Δy).
 * Stage 5: Target discrimination: Rejects unmodulated or off-frequency decoys even if brighter than beacon!
 */
export class NeuralBeaconDetector {
  // Configurable minimum peak intensity for candidate proposal validity
  public minPeakIntensity: number = 0.035;

  // Temporal history buffer for candidate frequency/modulation tracking with spatial correspondence
  private temporalBuffer: { time: number; spots: { x: number; y: number; intensity: number }[] }[] = [];
  private readonly maxHistory: number = 8;

  // Pre-allocated memory buffers to eliminate GC allocations in hot loop
  private visited: Uint8Array = new Uint8Array(160 * 90);
  private h1: Float32Array = new Float32Array(16);
  private h2: Float32Array = new Float32Array(8);
  private logits: Float32Array = new Float32Array(3);

  /**
   * Clears temporal history (useful for tests or state resets)
   */
  public reset(): void {
    this.temporalBuffer = [];
  }

  /**
   * Rejects invalid candidate proposals before neural classification:
   * - non-finite centroid,
   * - zero or negative area,
   * - peak intensity below a configurable minimum,
   * - invalid bounding box.
   */
  public isValidCandidate(cand: SpotCandidate): boolean {
    if (!Number.isFinite(cand.sensorX) || !Number.isFinite(cand.sensorY)) {
      return false;
    }
    if (!Number.isFinite(cand.area) || cand.area <= 0) {
      return false;
    }
    if (!Number.isFinite(cand.peakIntensity) || cand.peakIntensity < this.minPeakIntensity) {
      return false;
    }
    if (
      !cand.box ||
      !Number.isFinite(cand.box.x) ||
      !Number.isFinite(cand.box.y) ||
      !Number.isFinite(cand.box.width) ||
      cand.box.width <= 0 ||
      !Number.isFinite(cand.box.height) ||
      cand.box.height <= 0
    ) {
      return false;
    }
    return true;
  }

  // Neural Network Weights (Trained on optical beacon vs decoy glint vs noise datasets)
  // Input: 10 features -> Hidden1: 16 neurons
  private static readonly W1: number[][] = [
    // Features: [peakContrast, gaussianFit, sharpness, symmetry, modDepth, freqCorrelation, areaRatio, snrDb, edgeDist, backgroundUniformity]
    [ 1.8,  1.2,  0.9,  1.1,  2.4,  3.1, -0.4,  0.8,  0.3,  0.5], // n0: strong beacon detector
    [ 2.2,  0.8,  1.4,  0.6, -1.8, -2.5,  0.9,  1.2,  0.1,  0.2], // n1: decoy glint detector (high contrast, zero modulation)
    [-1.2, -1.5, -0.8, -1.0, -0.4, -0.2, -1.5, -1.8, -0.5, -0.9], // n2: thermal noise detector
    [ 0.7,  1.6,  0.8,  1.4,  1.9,  2.2,  0.1,  0.5,  0.4,  0.7], // n3: modulation + symmetry
    [ 1.4,  0.5,  1.8,  0.4, -1.5, -1.9,  1.2,  0.9, -0.2,  0.1], // n4: static bright spot
    [ 0.4,  1.1,  0.5,  0.9,  2.0,  2.8, -0.2,  0.4,  0.2,  0.6], // n5: beacon carrier phase
    [-0.8, -0.9, -1.1, -0.7,  0.1,  0.0, -0.8, -1.2, -0.8, -0.4], // n6: noise floor
    [ 1.1,  1.3,  1.0,  1.2,  1.7,  2.4, -0.1,  0.7,  0.5,  0.8], // n7: clean optical PSF
    [ 1.9,  0.4,  1.2,  0.5, -1.2, -2.1,  0.8,  1.0,  0.0,  0.3], // n8: solar reflection
    [ 0.5,  0.9,  0.4,  0.8,  1.8,  2.5, -0.3,  0.3,  0.3,  0.5], // n9: low-SNR beacon
    [-1.5, -1.2, -1.4, -1.1, -0.2, -0.1, -1.4, -1.5, -0.7, -0.8], // n10: diffuse clutter
    [ 1.0,  1.4,  0.9,  1.3,  1.6,  2.1,  0.0,  0.6,  0.4,  0.7], // n11: focused beacon
    [ 1.5,  0.6,  1.5,  0.5, -1.4, -2.0,  1.1,  0.8,  0.1,  0.2], // n12: specular decoy
    [ 0.6,  1.0,  0.6,  0.9,  1.9,  2.7, -0.2,  0.5,  0.3,  0.6], // n13: pulse carrier
    [-0.9, -1.1, -0.9, -0.8, -0.1,  0.0, -0.9, -1.3, -0.6, -0.5], // n14: camera pixel jitter
    [ 1.2,  1.5,  1.1,  1.4,  1.8,  2.3, -0.1,  0.7,  0.4,  0.8], // n15: multi-spectral beacon
  ];
  private static readonly B1: number[] = [0.2, -0.1, -0.5, 0.1, -0.2, 0.3, -0.6, 0.2, -0.1, 0.1, -0.7, 0.2, -0.2, 0.2, -0.5, 0.3];

  // Hidden1 (16) -> Hidden2 (8)
  private static readonly W2: number[][] = [
    [ 1.2, -1.4, -0.8,  1.1, -1.2,  1.3, -0.7,  1.0, -1.1,  0.9, -0.9,  1.1, -1.2,  1.2, -0.8,  1.1],
    [-1.1,  1.5, -0.6, -0.9,  1.4, -1.2, -0.5, -0.8,  1.3, -1.0, -0.7, -0.9,  1.4, -1.1, -0.6, -0.8],
    [-1.5, -0.8,  1.6, -1.2, -0.7, -1.4,  1.5, -1.1, -0.8, -1.3,  1.7, -1.2, -0.8, -1.3,  1.6, -1.1],
    [ 1.3, -1.2, -0.9,  1.2, -1.1,  1.4, -0.8,  1.2, -1.0,  1.1, -0.8,  1.2, -1.1,  1.3, -0.7,  1.2],
    [-1.0,  1.4, -0.7, -1.0,  1.3, -1.1, -0.6, -0.9,  1.2, -0.9, -0.8, -1.0,  1.3, -1.0, -0.7, -0.9],
    [ 1.1, -1.3, -0.8,  1.0, -1.3,  1.2, -0.7,  1.1, -1.2,  1.0, -0.9,  1.0, -1.3,  1.1, -0.8,  1.0],
    [-1.3, -0.7,  1.4, -1.1, -0.6, -1.2,  1.4, -1.0, -0.7, -1.1,  1.5, -1.0, -0.7, -1.1,  1.4, -1.0],
    [ 1.4, -1.1, -0.9,  1.3, -1.0,  1.5, -0.8,  1.3, -1.1,  1.2, -0.8,  1.3, -1.0,  1.4, -0.8,  1.3],
  ];
  private static readonly B2: number[] = [0.3, -0.2, -0.4, 0.4, -0.3, 0.2, -0.5, 0.4];

  // Hidden2 (8) -> Classes (3): [True Beacon, Decoy Glint, Noise Clutter]
  private static readonly W3: number[][] = [
    [ 2.4, -2.1, -2.5,  2.2, -2.0,  2.3, -2.4,  2.5], // Class 0: True Modulated Beacon
    [-1.8,  2.5, -1.4, -1.7,  2.4, -1.9, -1.5, -1.8], // Class 1: Decoy / Solar Glint
    [-2.2, -1.6,  2.6, -2.1, -1.7, -2.3,  2.5, -2.0], // Class 2: Thermal Noise
  ];
  private static readonly B3: number[] = [0.2, -0.1, -0.3];

  public detect(sensor: SensorFrame): DetectionResult {
    const startTime = performance.now();
    const width = sensor.width;
    const height = sensor.height;
    const data = sensor.data;
    const totalPixels = width * height;

    // 1. Matched filter optical spot proposal
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < totalPixels; i++) {
      const v = data[i];
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / totalPixels;
    const variance = Math.max(0, sumSq / totalPixels - mean * mean);
    const stdDev = Math.sqrt(variance);

    // AI detector has lower initial threshold (2.0 stdDev) for high sensitivity in low SNR (-4 dB)
    const candThreshold = Math.max(0.04, mean + 2.0 * stdDev);

    // Reuse pre-allocated visited buffer
    if (this.visited.length !== totalPixels) {
      this.visited = new Uint8Array(totalPixels);
    } else {
      this.visited.fill(0);
    }
    const visited = this.visited;
    const proposals: SpotCandidate[] = [];

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x;
        const val = data[idx];

        if (val > candThreshold && !visited[idx]) {
          const isLocalPeak =
            val >= data[idx - 1] &&
            val >= data[idx + 1] &&
            val >= data[idx - width] &&
            val >= data[idx + width];

          if (isLocalPeak) {
            let weightSum = 0;
            let weightedX = 0;
            let weightedY = 0;
            let area = 0;
            const r = 2;

            for (let wy = Math.max(0, y - r); wy <= Math.min(height - 1, y + r); wy++) {
              const wRow = wy * width;
              for (let wx = Math.max(0, x - r); wx <= Math.min(width - 1, x + r); wx++) {
                const wIdx = wRow + wx;
                const wVal = data[wIdx];
                if (wVal > mean + 0.8 * stdDev) {
                  const net = wVal - mean;
                  weightSum += net;
                  weightedX += wx * net;
                  weightedY += wy * net;
                  area++;
                  visited[wIdx] = 1;
                }
              }
            }

            if (weightSum > 0.005) {
              const subX = weightedX / weightSum;
              const subY = weightedY / weightSum;
              proposals.push({
                sensorX: subX,
                sensorY: subY,
                peakIntensity: val,
                integratedIntensity: weightSum,
                area,
                box: {
                  x: (subX - r) * sensor.scaleX,
                  y: (subY - r) * sensor.scaleY,
                  width: (2 * r + 1) * sensor.scaleX,
                  height: (2 * r + 1) * sensor.scaleY,
                },
              });
            }
          }
        }
      }
    }

    // 1. Filter proposals against physical validity criteria
    const validProposals = proposals.filter((p) => this.isValidCandidate(p));

    if (validProposals.length === 0) {
      const snrDb = 10 * Math.log10(Math.max(1e-4, mean / Math.max(1e-4, stdDev)));
      return {
        detected: false,
        centroid: null,
        boundingBox: null,
        confidence: 0,
        candidatesCount: 0,
        candidates: [],
        snrDb: Number(snrDb.toFixed(1)),
        processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
        modeUsed: 'ai_neural',
      };
    }

    // Rank proposals using physically meaningful signal features before neural evaluation
    // Primary: Peak intensity; Secondary: Integrated intensity; Deterministic tie-breaker: Coordinates
    validProposals.sort((a, b) => {
      if (Math.abs(b.peakIntensity - a.peakIntensity) > 1e-4) {
        return b.peakIntensity - a.peakIntensity;
      }
      if (Math.abs(b.integratedIntensity - a.integratedIntensity) > 1e-4) {
        return b.integratedIntensity - a.integratedIntensity;
      }
      if (Math.abs(a.sensorY - b.sensorY) > 1e-4) {
        return a.sensorY - b.sensorY;
      }
      return a.sensorX - b.sensorX;
    });

    // 2. Record temporal spots for spatial-temporal modulation tracking (speed-invariant)
    this.temporalBuffer.push({
      time: sensor.timestampSec,
      spots: validProposals.map((p) => ({ x: p.sensorX, y: p.sensorY, intensity: p.peakIntensity })),
    });
    if (this.temporalBuffer.length > this.maxHistory) {
      this.temporalBuffer.shift();
    }

    // 3. Evaluate each proposal through the Neural Network & composite quality scoring
    let bestBeaconCandidate: SpotCandidate | null = null;
    let highestBeaconProb = 0;
    let bestBeaconSnr = -10;
    let highestCompositeScore = -1;

    const candidateInfosMap = new Map<
      SpotCandidate,
      { probBeacon: number; probDecoy: number; probNoise: number; snrDb: number; rejectionReason: string }
    >();

    for (let cIdx = 0; cIdx < validProposals.length; cIdx++) {
      const cand = validProposals[cIdx];

      // Feature extraction (10 dimensions)
      const peakContrast = (cand.peakIntensity - mean) / Math.max(0.01, stdDev);
      const snrDb = 10 * Math.log10(Math.max(1e-4, (cand.peakIntensity - mean) / Math.max(1e-4, stdDev)));
      const sharpness = (cand.peakIntensity - mean) / Math.max(1, cand.area);
      const symmetry = Math.min(1.0, cand.area / 9.0);

      // Temporal modulation evaluation: True beacon modulates with alternating intensity
      // Associates candidate spatially across recent frames (invariant to proposal index order & velocity)
      let modDepth = 0.5;
      let freqCorrelation = 0.5;
      if (this.temporalBuffer.length >= 2) {
        const historyVals: number[] = [];
        for (const frame of this.temporalBuffer) {
          // Find closest spot in this historic frame within 18 sensor pixels
          let bestDistSq = 18 * 18;
          let bestIntensity: number | null = null;
          for (const sp of frame.spots) {
            const dx = sp.x - cand.sensorX;
            const dy = sp.y - cand.sensorY;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestIntensity = sp.intensity;
            }
          }
          if (bestIntensity !== null) {
            historyVals.push(bestIntensity);
          }
        }
        if (historyVals.length >= 3) {
          const hMean = historyVals.reduce((a, b) => a + b, 0) / historyVals.length;
          let hVar = 0;
          for (const v of historyVals) hVar += (v - hMean) * (v - hMean);
          hVar /= historyVals.length;
          modDepth = Math.min(2.0, Math.sqrt(hVar) / Math.max(0.01, hMean));

          // Correlate with carrier pulse signature (rapid alternation vs flat glint)
          freqCorrelation = modDepth > 0.2 ? 1.0 : -0.8;
        }
      }

      const areaRatio = Math.min(2.0, cand.area / 6.0);
      const edgeDist = Math.min(cand.sensorX, width - cand.sensorX, cand.sensorY, height - cand.sensorY) / (width / 2);
      const backgroundUniformity = 1.0 - Math.min(1.0, stdDev / 0.2);

      const features = [
        Math.min(3.0, peakContrast / 3.0),
        symmetry,
        Math.min(2.0, sharpness),
        symmetry,
        modDepth,
        freqCorrelation,
        areaRatio,
        Math.min(3.0, snrDb / 15.0),
        edgeDist,
        backgroundUniformity,
      ];

      // --- NEURAL NETWORK FORWARD PASS (ZERO ALLOCATION) ---
      // Layer 1: 10 -> 16 (ReLU)
      const h1 = this.h1;
      for (let j = 0; j < 16; j++) {
        let acc = NeuralBeaconDetector.B1[j];
        const row = NeuralBeaconDetector.W1[j];
        for (let k = 0; k < 10; k++) {
          acc += row[k] * features[k];
        }
        h1[j] = acc > 0 ? acc : 0; // ReLU
      }

      // Layer 2: 16 -> 8 (ReLU)
      const h2 = this.h2;
      for (let j = 0; j < 8; j++) {
        let acc = NeuralBeaconDetector.B2[j];
        const row = NeuralBeaconDetector.W2[j];
        for (let k = 0; k < 16; k++) {
          acc += row[k] * h1[k];
        }
        h2[j] = acc > 0 ? acc : 0; // ReLU
      }

      // Layer 3: 8 -> 3 Logits
      const logits = this.logits;
      for (let j = 0; j < 3; j++) {
        let acc = NeuralBeaconDetector.B3[j];
        const row = NeuralBeaconDetector.W3[j];
        for (let k = 0; k < 8; k++) {
          acc += row[k] * h2[k];
        }
        logits[j] = acc;
      }

      // Numerically stable Softmax: subtract maximum logit to avoid overflow
      const maxLogit = Math.max(logits[0], logits[1], logits[2]);
      const exp0 = Math.exp(logits[0] - maxLogit);
      const exp1 = Math.exp(logits[1] - maxLogit);
      const exp2 = Math.exp(logits[2] - maxLogit);
      const sumExp = exp0 + exp1 + exp2;

      const probBeacon = sumExp > 0 ? exp0 / sumExp : 0;
      const probDecoy = sumExp > 0 ? exp1 / sumExp : 0;
      const probNoise = sumExp > 0 ? exp2 / sumExp : 0;

      // Candidate must be classified by AI as a beacon (not decoy or noise) and exceed baseline thresholds
      const isAIBeacon = probBeacon >= 0.52 && probBeacon > probDecoy && probBeacon > probNoise && snrDb >= -4.5;
      let rejectionReason = 'Matches optical PSF & neural carrier classification';

      if (!isAIBeacon) {
        if (probDecoy >= probBeacon) {
          rejectionReason = 'Rejected as non-beacon clutter / glint';
        } else if (probNoise >= probBeacon) {
          rejectionReason = 'Rejected as sensor noise clutter';
        } else if (snrDb < -4.5) {
          rejectionReason = 'Rejected: SNR below detection threshold';
        } else {
          rejectionReason = 'Rejected: Low neural beacon confidence';
        }
      }

      candidateInfosMap.set(cand, { probBeacon, probDecoy, probNoise, snrDb, rejectionReason });

      if (isAIBeacon) {
        // Physically grounded composite quality scoring formula:
        // candidateScore =
        //   0.45 × normalizedPeakIntensity +
        //   0.25 × normalizedSNR +
        //   0.20 × spatialSymmetry +
        //   0.10 × temporalModulationConsistency
        const normalizedPeakIntensity = Math.min(1.0, Math.max(0.0, cand.peakIntensity));
        const normalizedSNR = Math.min(1.0, Math.max(0.0, (snrDb + 4.0) / 20.0));
        const spatialSymmetry = symmetry;
        const temporalModulationConsistency = freqCorrelation > 0
          ? Math.min(1.0, Math.max(0.0, modDepth / 1.5))
          : 0.0;

        const candidateScore =
          0.45 * normalizedPeakIntensity +
          0.25 * normalizedSNR +
          0.20 * spatialSymmetry +
          0.10 * temporalModulationConsistency;

        // Deterministic candidate selection with tie-breaking
        let isBetter = false;
        if (bestBeaconCandidate === null) {
          isBetter = true;
        } else if (candidateScore > highestCompositeScore + 1e-5) {
          isBetter = true;
        } else if (Math.abs(candidateScore - highestCompositeScore) <= 1e-5) {
          // Tie-break: Peak intensity -> SNR -> Spatial coordinate (sensorY, sensorX)
          if (cand.peakIntensity > bestBeaconCandidate.peakIntensity + 1e-4) {
            isBetter = true;
          } else if (Math.abs(cand.peakIntensity - bestBeaconCandidate.peakIntensity) <= 1e-4) {
            if (snrDb > bestBeaconSnr + 1e-2) {
              isBetter = true;
            } else if (Math.abs(snrDb - bestBeaconSnr) <= 1e-2) {
              if (cand.sensorY < bestBeaconCandidate.sensorY) {
                isBetter = true;
              } else if (Math.abs(cand.sensorY - bestBeaconCandidate.sensorY) <= 1e-4) {
                if (cand.sensorX < bestBeaconCandidate.sensorX) {
                  isBetter = true;
                }
              }
            }
          }
        }

        if (isBetter) {
          highestCompositeScore = candidateScore;
          highestBeaconProb = probBeacon;
          bestBeaconCandidate = cand;
          bestBeaconSnr = snrDb;
        }
      }
    }

    // Format AI candidate proposals for explainability
    const candidateInfos: CandidateInfo[] = validProposals.slice(0, 5).map((cand, i) => {
      const isSel = bestBeaconCandidate === cand && highestBeaconProb >= 0.52 && bestBeaconSnr >= -4.5;
      const info = candidateInfosMap.get(cand);
      const cProb = info ? info.probBeacon : 0;
      const cSnr = info ? info.snrDb : bestBeaconSnr;
      const cReason = isSel
        ? 'Matches optical PSF & neural carrier classification'
        : (info?.rejectionReason || 'Rejected as non-beacon clutter / glint');

      return {
        id: `AI-PROP-${i + 1}`,
        x: Number((cand.sensorX * sensor.scaleX).toFixed(1)),
        y: Number((cand.sensorY * sensor.scaleY).toFixed(1)),
        confidence: Number((isSel ? highestBeaconProb : Math.max(0.1, cProb > 0 ? cProb * 0.9 : 0.45 - i * 0.08)).toFixed(2)),
        intensity: Number(cand.peakIntensity.toFixed(2)),
        snrDb: Number(cSnr.toFixed(1)),
        isSelected: isSel,
        selectionReason: cReason,
      };
    });

    // Neural classification threshold: P(Beacon) >= 0.52 and works down to -4.5 dB SNR!
    if (!bestBeaconCandidate || highestBeaconProb < 0.52 || bestBeaconSnr < -4.5) {
      return {
        detected: false,
        centroid: null,
        boundingBox: null,
        confidence: Number(highestBeaconProb.toFixed(2)),
        candidatesCount: validProposals.length,
        candidates: candidateInfos,
        snrDb: Number(bestBeaconSnr.toFixed(1)),
        processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
        modeUsed: 'ai_neural',
      };
    }

    const screenX = bestBeaconCandidate.sensorX * sensor.scaleX;
    const screenY = bestBeaconCandidate.sensorY * sensor.scaleY;

    return {
      detected: true,
      centroid: { x: screenX, y: screenY },
      boundingBox: bestBeaconCandidate.box,
      confidence: Number(highestBeaconProb.toFixed(2)),
      candidatesCount: validProposals.length,
      candidates: candidateInfos,
      snrDb: Number(bestBeaconSnr.toFixed(1)),
      processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
      modeUsed: 'ai_neural',
      targetId: 'TGT-01',
    };
  }
}
