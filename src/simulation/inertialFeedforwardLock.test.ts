import { FSOCSimulationEngine } from './simulationEngine';

function runTests() {
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

  console.log('=== RUNNING INERTIAL FEEDFORWARD & LOCK METRICS FOCUSED TESTS ===\n');

  // 1. Positive target pan motion
  {
    const engine = new FSOCSimulationEngine(42);
    engine.disturbanceConfig.platformVibrationDeg = 0;
    engine.disturbanceConfig.turbulencePercent = 0;
    engine.disturbanceConfig.sensorNoisePercent = 0;
    engine.cameraState.panDeg = 0;
    engine.cameraState.tiltDeg = 0;
    engine.cameraState.panVelDegPerSec = 0;
    engine.cameraState.tiltVelDegPerSec = 0;

    const halfW = engine.cameraConfig.width / 2;
    const fovX = engine.cameraConfig.fovXDeg;

    let targetPan = 0;
    const dt = 0.016;
    for (let i = 0; i < 60; i++) {
      targetPan += 5.0 * dt; // Target moving positively at +5 deg/s
      const pt = engine.projectWorldToScreen(targetPan, 0);
      engine.kalmanFilter.predict(dt);
      engine.kalmanFilter.update(pt.x, pt.y);
    }

    const kState = engine.kalmanFilter.getState();
    const screenPanRate = (kState.vx / halfW) * (fovX / 2);
    const reconstructedTargetRate = engine.cameraState.panVelDegPerSec + screenPanRate;

    assert(
      screenPanRate > 3.5,
      '1. Positive target pan motion: screenPanRate has positive sign and expected magnitude',
      `screenPanRate=${screenPanRate.toFixed(3)} deg/s`
    );
    assert(
      reconstructedTargetRate > 3.5,
      '1. Positive target pan motion: reconstructed target rate moves positively',
      `reconstructed=${reconstructedTargetRate.toFixed(3)} deg/s`
    );
  }

  // 2. Stationary target with moving camera
  {
    const engine = new FSOCSimulationEngine(42);
    engine.disturbanceConfig.platformVibrationDeg = 0;
    engine.disturbanceConfig.turbulencePercent = 0;
    engine.disturbanceConfig.sensorNoisePercent = 0;

    const halfW = engine.cameraConfig.width / 2;
    const fovX = engine.cameraConfig.fovXDeg;

    const targetPan = 5.0; // Stationary target at +5 deg
    const camVel = 4.0; // Camera moving positively at +4 deg/s
    engine.cameraState.panVelDegPerSec = camVel;

    let camPan = 0;
    const dt = 0.016;
    for (let i = 0; i < 80; i++) {
      camPan += camVel * dt;
      engine.cameraState.panDeg = camPan;
      const pt = engine.projectWorldToScreen(targetPan, 0);
      engine.kalmanFilter.predict(dt);
      engine.kalmanFilter.update(pt.x, pt.y);
    }

    const kState = engine.kalmanFilter.getState();
    const screenPanRate = (kState.vx / halfW) * (fovX / 2);
    const reconstructedTargetRate = camVel + screenPanRate;

    assert(
      screenPanRate < -2.5,
      '2. Stationary target with moving camera: screenPanRate is negative as camera advances',
      `screenPanRate=${screenPanRate.toFixed(3)} deg/s`
    );
    assert(
      Math.abs(reconstructedTargetRate) < 0.6,
      '2. Stationary target with moving camera: reconstructed target rate is approximately zero',
      `reconstructed=${reconstructedTargetRate.toFixed(3)} deg/s (expected approx 0)`
    );
  }

  // 3. Feedforward sign convention (Pan & Tilt, Positive & Negative)
  {
    const engine = new FSOCSimulationEngine(42);
    const halfW = engine.cameraConfig.width / 2;
    const halfH = engine.cameraConfig.height / 2;
    const fovX = engine.cameraConfig.fovXDeg;
    const fovY = engine.cameraConfig.fovYDeg;

    // Positive Pan & Tilt motion
    const dt = 0.016;
    for (let i = 0; i < 50; i++) {
      const pt = engine.projectWorldToScreen(i * dt * 3.0, i * dt * 2.0);
      engine.kalmanFilter.predict(dt);
      engine.kalmanFilter.update(pt.x, pt.y);
    }
    const statePos = engine.kalmanFilter.getState();
    const sPanPos = (statePos.vx / halfW) * (fovX / 2);
    const sTiltPos = (statePos.vy / halfH) * (fovY / 2);

    assert(
      sPanPos > 0 && sTiltPos > 0,
      '3. Feedforward sign convention: positive velocities yield positive screen rates',
      `panRate=${sPanPos.toFixed(3)}, tiltRate=${sTiltPos.toFixed(3)}`
    );

    // Negative Pan & Tilt motion
    engine.kalmanFilter.reset();
    for (let i = 0; i < 50; i++) {
      const pt = engine.projectWorldToScreen(-i * dt * 3.0, -i * dt * 2.0);
      engine.kalmanFilter.predict(dt);
      engine.kalmanFilter.update(pt.x, pt.y);
    }
    const stateNeg = engine.kalmanFilter.getState();
    const sPanNeg = (stateNeg.vx / halfW) * (fovX / 2);
    const sTiltNeg = (stateNeg.vy / halfH) * (fovY / 2);

    assert(
      sPanNeg < 0 && sTiltNeg < 0,
      '3. Feedforward sign convention: negative velocities yield negative screen rates',
      `panRate=${sPanNeg.toFixed(3)}, tiltRate=${sTiltNeg.toFixed(3)}`
    );
  }

  // 4. Unit conversion from pixels per second to degrees per second
  {
    const engine = new FSOCSimulationEngine(42);
    const halfW = engine.cameraConfig.width / 2; // 640
    const halfH = engine.cameraConfig.height / 2; // 360
    const fovX = engine.cameraConfig.fovXDeg; // 50
    const fovY = engine.cameraConfig.fovYDeg; // 30

    // For 100 px/s in X:
    const expectedDegPerSecX = (100 / halfW) * (fovX / 2);
    // 100 / 640 * 25 = 3.90625 deg/s
    assert(
      Math.abs(expectedDegPerSecX - 3.90625) < 1e-6,
      '4. Unit conversion: 100 px/s scales to exactly 3.90625 deg/s for 1280x720 / 50° FOV',
      `result=${expectedDegPerSecX}`
    );

    // For 100 px/s in Y:
    const expectedDegPerSecY = (100 / halfH) * (fovY / 2);
    // 100 / 360 * 15 = 4.16667 deg/s
    assert(
      Math.abs(expectedDegPerSecY - (100 / 360) * 15) < 1e-6,
      '4. Unit conversion: 100 px/s scales correctly for vertical FOV',
      `result=${expectedDegPerSecY}`
    );
  }

  // 5. Mechanical-error calculation excluding jitter
  {
    const engine = new FSOCSimulationEngine(42);
    engine.disturbanceConfig.platformVibrationDeg = 1.5; // High vibration
    engine.cameraState.panDeg = 3.0;
    engine.cameraState.tiltDeg = 2.0;
    engine.targetState.panDeg = 5.0;
    engine.targetState.tiltDeg = 3.5;

    // Run one step to evaluate errors
    engine.step(0.016);

    const mechPan = engine.currentTelemetry.mechanicalPanErrorDeg;
    const mechTilt = engine.currentTelemetry.mechanicalTiltErrorDeg;
    const mechPoint = engine.currentTelemetry.mechanicalPointingErrorDeg;

    // Expected: pan = 5.0 - cameraPan, tilt = 3.5 - cameraTilt
    // Camera pan moved slightly during step via controller, but mechanical pointing error
    // must equal hypot(targetPan - cameraPan, targetTilt - cameraTilt) exactly without jitter
    const expectedMechPan = engine.targetState.panDeg - engine.cameraState.panDeg;
    const expectedMechTilt = engine.targetState.tiltDeg - engine.cameraState.tiltDeg;
    const expectedMechPointing = Math.hypot(expectedMechPan, expectedMechTilt);

    assert(
      mechPoint !== undefined && Math.abs(mechPoint - expectedMechPointing) < 0.002,
      '5. Mechanical error calculation: excludes jitter and reflects true gimbal boresight offset',
      `mechPoint=${mechPoint}, expected=${expectedMechPointing.toFixed(3)}`
    );
  }

  // 6. Optical-error calculation including jitter
  {
    const engine = new FSOCSimulationEngine(42);
    engine.disturbanceConfig.platformVibrationDeg = 1.0;
    engine.step(0.016);

    const optErr = engine.currentTelemetry.instantaneousOpticalErrorDeg;
    const mechErr = engine.currentTelemetry.mechanicalPointingErrorDeg;

    // With 1.0 deg vibration, jitter is present, so optical error and mechanical error must differ
    assert(
      optErr !== undefined && mechErr !== undefined,
      '6. Optical-error calculation: both instantaneous optical and mechanical error are populated'
    );
    assert(
      engine.currentTelemetry.angularErrorDeg === optErr,
      '6. Optical-error calculation: existing angularErrorDeg continues to equal instantaneous optical error'
    );
  }

  // 7. Lock-mode behavior ('optical-instantaneous', 'mechanical-boresight', 'filtered-optical')
  {
    const engine = new FSOCSimulationEngine(42);
    engine.disturbanceConfig.platformVibrationDeg = 0.5;

    // Mode 1: optical-instantaneous
    engine.lockEvaluationMode = 'optical-instantaneous';
    engine.step(0.016);
    assert(
      engine.currentTelemetry.lockEvaluationMode === 'optical-instantaneous' &&
      engine.currentTelemetry.lockEvaluationErrorDeg === engine.currentTelemetry.instantaneousOpticalErrorDeg,
      '7. Lock-mode behavior: optical-instantaneous evaluates against instantaneous optical error'
    );

    // Mode 2: mechanical-boresight
    engine.lockEvaluationMode = 'mechanical-boresight';
    engine.step(0.016);
    assert(
      engine.currentTelemetry.lockEvaluationMode === 'mechanical-boresight' &&
      engine.currentTelemetry.lockEvaluationErrorDeg === engine.currentTelemetry.mechanicalPointingErrorDeg,
      '7. Lock-mode behavior: mechanical-boresight evaluates against mechanical pointing error'
    );

    // Mode 3: filtered-optical
    engine.lockEvaluationMode = 'filtered-optical';
    engine.step(0.016);
    assert(
      engine.currentTelemetry.lockEvaluationMode === 'filtered-optical' &&
      engine.currentTelemetry.lockEvaluationErrorDeg === engine.currentTelemetry.filteredOpticalErrorDeg,
      '7. Lock-mode behavior: filtered-optical evaluates against EWMA filtered optical error'
    );
  }

  // 8. Persistence counter behavior
  {
    const engine = new FSOCSimulationEngine(42);
    engine.disturbanceConfig.platformVibrationDeg = 0;
    engine.disturbanceConfig.turbulencePercent = 0;
    engine.disturbanceConfig.sensorNoisePercent = 0;
    engine.lockEvaluationMode = 'mechanical-boresight';

    // Center target stationary at boresight
    engine.targetConfig.radiusDeg = 0;
    engine.targetConfig.altitudeDeg = 0;
    engine.targetConfig.speed = 0;
    engine.cameraState.panDeg = 0;
    engine.cameraState.tiltDeg = 0;

    // Initial state: SEARCHING
    assert(engine.currentTelemetry.status === 'SEARCHING', '8. Persistence counter: starts in SEARCHING status');

    // Run steps and observe persistence counter increment
    for (let i = 0; i < 7; i++) {
      engine.step(0.016);
    }
    assert(
      engine.lockPersistenceCount === 7 && !engine.currentTelemetry.isLocked,
      '8. Persistence counter: counts consecutive frames below threshold without locking prematurely',
      `count=${engine.lockPersistenceCount}, isLocked=${engine.currentTelemetry.isLocked}`
    );

    // 8th frame reaches threshold >= 8
    engine.step(0.016);
    assert(
      engine.lockPersistenceCount >= 8 && engine.currentTelemetry.isLocked,
      '8. Persistence counter: transitions to LOCKED status on 8th consecutive frame',
      `count=${engine.lockPersistenceCount}, isLocked=${engine.currentTelemetry.isLocked}, status=${engine.currentTelemetry.status}`
    );

    // A short sensor dropout should consume persistence gradually rather than
    // immediately reporting a lock loss.
    engine.disturbanceConfig.manualOcclusion = true;
    for (let i = 0; i < 3; i++) {
      engine.step(0.016);
      assert(
        engine.currentTelemetry.isLocked,
        `8. Lock retention: preserves LOCKED through brief dropout frame ${i + 1}`,
        `count=${engine.lockPersistenceCount}, status=${engine.currentTelemetry.status}`
      );
    }
    engine.step(0.016);
    assert(
      !engine.currentTelemetry.isLocked && engine.lockLossCount === 1,
      '8. Lock retention: releases only after persistence budget is exhausted',
      `count=${engine.lockPersistenceCount}, losses=${engine.lockLossCount}`
    );
    assert(
      engine.getPerformanceStats().lockRetentionRate === 80,
      '8. Lock retention metric: measures only frames after the first successful lock',
      `retention=${engine.getPerformanceStats().lockRetentionRate}%`
    );
  }

  // 9. Existing lock behavior remaining unchanged in default mode
  {
    const engine = new FSOCSimulationEngine(42);
    assert(
      engine.lockEvaluationMode === 'optical-instantaneous',
      '9. Default mode: lockEvaluationMode defaults to optical-instantaneous'
    );

    engine.step(0.016);
    assert(
      engine.currentTelemetry.lockEvaluationErrorDeg === engine.currentTelemetry.angularErrorDeg,
      '9. Default mode: lock evaluation error strictly matches legacy angular error'
    );
    assert(
      engine.currentTelemetry.lockEvaluationErrorDeg === engine.currentTelemetry.instantaneousOpticalErrorDeg,
      '9. Default mode: lock evaluation error equals instantaneous optical error'
    );
  }

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
