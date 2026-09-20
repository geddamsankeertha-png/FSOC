import { NeuralBeaconDetector, ClassicalCVDetector, SpotCandidate } from './detectors';
import { SensorFrame } from './sensorFrame';
import { SeededPRNG } from '../prng';

function runDetectorTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  console.log('=== RUNNING NEURAL BEACON DETECTOR BUG FIX TESTS ===\n');

  const prng = new SeededPRNG(12345);

  // Helper to place a synthetic Gaussian spot on a sensor frame
  function addSpot(
    sensor: SensorFrame,
    cx: number,
    cy: number,
    peakVal: number,
    radius: number = 2
  ) {
    for (let y = Math.max(0, cy - radius); y <= Math.min(sensor.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(sensor.width - 1, cx + radius); x++) {
        const dSq = (x - cx) ** 2 + (y - cy) ** 2;
        const val = peakVal * Math.exp(-dSq / (2 * 1.0));
        const idx = y * sensor.width + x;
        sensor.data[idx] = Math.max(sensor.data[idx], val);
      }
    }
  }

  // 1. Invalid Candidate Rejection Tests
  {
    const detector = new NeuralBeaconDetector();

    const validCand: SpotCandidate = {
      sensorX: 80,
      sensorY: 45,
      peakIntensity: 0.85,
      integratedIntensity: 1.5,
      area: 5,
      box: { x: 78 * 8, y: 43 * 8, width: 40, height: 40 },
    };
    assert(detector.isValidCandidate(validCand), 'Invalid candidate rejection: Valid candidate passes');

    // Non-finite centroid
    assert(
      !detector.isValidCandidate({ ...validCand, sensorX: NaN }),
      'Invalid candidate rejection: NaN sensorX rejected'
    );
    assert(
      !detector.isValidCandidate({ ...validCand, sensorY: Infinity }),
      'Invalid candidate rejection: Infinite sensorY rejected'
    );

    // Zero or negative area
    assert(
      !detector.isValidCandidate({ ...validCand, area: 0 }),
      'Invalid candidate rejection: Zero area rejected'
    );
    assert(
      !detector.isValidCandidate({ ...validCand, area: -3 }),
      'Invalid candidate rejection: Negative area rejected'
    );

    // Peak intensity below minimum threshold
    assert(
      !detector.isValidCandidate({ ...validCand, peakIntensity: 0.01 }),
      'Invalid candidate rejection: Sub-threshold peak intensity (0.01 < 0.035) rejected'
    );

    // Invalid bounding box
    assert(
      !detector.isValidCandidate({ ...validCand, box: { ...validCand.box, width: 0 } }),
      'Invalid candidate rejection: Zero width bounding box rejected'
    );
    assert(
      !detector.isValidCandidate({ ...validCand, box: { ...validCand.box, height: -10 } }),
      'Invalid candidate rejection: Negative height bounding box rejected'
    );
    assert(
      !detector.isValidCandidate({ ...validCand, box: { ...validCand.box, x: NaN } }),
      'Invalid candidate rejection: NaN box position rejected'
    );
  }

  // 2. Saturated Logits & Stable Softmax Test
  {
    // Verify that the forward pass does not overflow and accurately normalizes saturated logits
    const sensor = new SensorFrame();
    sensor.timestampSec = 0.05;
    // Add bright beacon
    addSpot(sensor, 80, 45, 0.90);

    const detector = new NeuralBeaconDetector();
    const result = detector.detect(sensor);

    assert(result.detected === true, 'Stable Softmax: Detection succeeds with large logits');
    assert(Number.isFinite(result.confidence), 'Stable Softmax: Confidence is finite');
    assert(result.confidence >= 0.52 && result.confidence <= 1.0, 'Stable Softmax: Confidence bounded in [0.52, 1.0]');
    assert(result.centroid !== null && Number.isFinite(result.centroid.x), 'Stable Softmax: Centroid coordinate is finite');
  }

  // 3. Two Candidates with probBeacon = 1.0 Where Brighter Beacon Wins
  {
    const detector = new NeuralBeaconDetector();
    const sensor = new SensorFrame();
    sensor.timestampSec = 0.02;

    // Spot 1 (earlier in raster scan: y=15, x=30): faint clutter peak 0.06
    addSpot(sensor, 30, 15, 0.06);
    // Spot 2 (later in raster scan: y=65, x=110): true strong beacon peak 0.88
    addSpot(sensor, 110, 65, 0.88);

    const result = detector.detect(sensor);
    assert(result.detected === true, 'Two Candidates: Detection occurs');
    // Screen X for spot 2 should be approx 110 * 8 = 880, Y approx 65 * 8 = 520
    const expectedX = 110 * 8;
    const expectedY = 65 * 8;
    const distToBeacon = Math.hypot(result.centroid!.x - expectedX, result.centroid!.y - expectedY);
    assert(
      distToBeacon < 16,
      'Two Candidates: Brighter beacon (0.88) wins over earlier raster clutter (0.06)',
      `dist was ${distToBeacon.toFixed(1)}px, centroid=(${result.centroid?.x.toFixed(1)},${result.centroid?.y.toFixed(1)})`
    );
  }

  // 4. Raster-Order Independence Test
  {
    // Test that beacon wins regardless of whether it appears before or after clutter in raster scan
    const detectorA = new NeuralBeaconDetector();
    const sensorA = new SensorFrame();
    sensorA.timestampSec = 0.02;
    // Order 1: Clutter at (30, 15), Beacon at (110, 65)
    addSpot(sensorA, 30, 15, 0.06);
    addSpot(sensorA, 110, 65, 0.85);
    const resultA = detectorA.detect(sensorA);

    const detectorB = new NeuralBeaconDetector();
    const sensorB = new SensorFrame();
    sensorB.timestampSec = 0.02;
    // Order 2: Beacon at (30, 15), Clutter at (110, 65)
    addSpot(sensorB, 30, 15, 0.85);
    addSpot(sensorB, 110, 65, 0.06);
    const resultB = detectorB.detect(sensorB);

    assert(resultA.detected && resultB.detected, 'Raster Independence: Both frames detect');
    const beaconDistA = Math.hypot(resultA.centroid!.x - 110 * 8, resultA.centroid!.y - 65 * 8);
    const beaconDistB = Math.hypot(resultB.centroid!.x - 30 * 8, resultB.centroid!.y - 15 * 8);
    assert(beaconDistA < 16, 'Raster Independence: Case A selects beacon at (110, 65)');
    assert(beaconDistB < 16, 'Raster Independence: Case B selects beacon at (30, 15)');
  }

  // 5. Low-Intensity Noise Rejection Test
  {
    const detector = new NeuralBeaconDetector();
    const sensor = new SensorFrame();
    sensor.timestampSec = 0.05;

    // Fill with only very low intensity random noise below detection threshold
    for (let i = 0; i < sensor.data.length; i++) {
      sensor.data[i] = prng.next() * 0.02;
    }

    const result = detector.detect(sensor);
    assert(result.detected === false, 'Low-Intensity Noise: Background noise rejected with detected=false');
    assert(result.centroid === null, 'Low-Intensity Noise: Centroid is null');
  }

  // 6. Decoy / Solar Glint Rejection Test
  {
    const detector = new NeuralBeaconDetector();
    const sensor = new SensorFrame();

    // Simulate multi-frame scene with:
    // - Unmodulated bright solar glint at (40, 30) with constant intensity 0.90
    // - Modulated optical beacon at (120, 60) alternating at 50 Hz (0.15 low, 0.85 high)
    let glintRejectedCount = 0;
    for (let frame = 0; frame < 8; frame++) {
      const t = frame * 0.016;
      sensor.timestampSec = t;
      sensor.data.fill(0.01); // baseline dark current

      // Constant glint
      addSpot(sensor, 40, 30, 0.90);

      // Modulated beacon (50 Hz, 60% duty cycle)
      const carrierPhase = (t * 50) % 1.0;
      const beaconIntensity = carrierPhase < 0.6 ? 0.85 : 0.15;
      addSpot(sensor, 120, 60, beaconIntensity);

      const res = detector.detect(sensor);
      if (res.detected && res.centroid) {
        const distToBeacon = Math.hypot(res.centroid.x - 120 * 8, res.centroid.y - 60 * 8);
        const distToGlint = Math.hypot(res.centroid.x - 40 * 8, res.centroid.y - 30 * 8);
        if (distToBeacon < 20 && distToGlint > 40) {
          glintRejectedCount++;
        }
      }
    }

    assert(
      glintRejectedCount >= 5,
      `Decoy/Glint Rejection: Modulated beacon preferred over static bright glint (${glintRejectedCount}/8 frames)`
    );
  }

  // 7. Deterministic Tie-Breaking Test
  {
    const detector = new NeuralBeaconDetector();
    const sensor = new SensorFrame();
    sensor.timestampSec = 0.02;

    // Create two identical spots at (50, 40) and (100, 40) with exact identical peak intensity and shape
    addSpot(sensor, 50, 40, 0.75);
    addSpot(sensor, 100, 40, 0.75);

    const run1 = detector.detect(sensor);
    detector.reset();
    const run2 = detector.detect(sensor);

    assert(run1.detected && run2.detected, 'Tie-breaking: Both runs detect');
    assert(
      run1.centroid!.x === run2.centroid!.x && run1.centroid!.y === run2.centroid!.y,
      'Tie-breaking: Deterministic selection yields identical centroids across repeated calls'
    );
  }

  // 8. Classical CV Detector Unchanged Baseline Test
  {
    const classicalDetector = new ClassicalCVDetector();
    const sensor = new SensorFrame();
    sensor.timestampSec = 0.05;
    addSpot(sensor, 80, 45, 0.80);

    const result = classicalDetector.detect(sensor);
    assert(result.detected === true, 'Classical CV Baseline: Classical detector functions unchanged');
    assert(result.modeUsed === 'classical_cv', 'Classical CV Baseline: Mode reported as classical_cv');
    const dist = Math.hypot(result.centroid!.x - 80 * 8, result.centroid!.y - 45 * 8);
    assert(dist < 8, 'Classical CV Baseline: Centroid tracks physical spot');
  }

  console.log(`\nDetector Test Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runDetectorTests();
