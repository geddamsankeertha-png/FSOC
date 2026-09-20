import {
  escapeCsvValue,
  generateTelemetryCSV,
  generateTelemetryJSON,
  generateTelemetryFilename,
  exportTelemetryCSV,
  exportTelemetryJSON,
  TELEMETRY_CSV_COLUMNS,
} from './telemetryExport';
import type { FrameTelemetry, TrackingStatus } from '../types';

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  console.log('=== RUNNING TELEMETRY EXPORT TESTS ===\n');

  // 1. CSV escaping tests
  {
    assert(escapeCsvValue('normal') === 'normal', 'CSV escaping: normal string unchanged');
    assert(escapeCsvValue('hello, world') === '"hello, world"', 'CSV escaping: comma wrapped in quotes');
    assert(escapeCsvValue('quote "here"') === '"quote ""here"""', 'CSV escaping: quotes escaped with double quotes');
    assert(escapeCsvValue('line\nbreak') === '"line\nbreak"', 'CSV escaping: newline wrapped in quotes');
    assert(escapeCsvValue('line\r\nbreak') === '"line\r\nbreak"', 'CSV escaping: CRLF wrapped in quotes');
    assert(escapeCsvValue(null) === '', 'CSV escaping: null produces empty string');
    assert(escapeCsvValue(undefined) === '', 'CSV escaping: undefined produces empty string');
    assert(escapeCsvValue(123.45) === '123.45', 'CSV escaping: number converted properly');
    assert(escapeCsvValue(true) === 'TRUE', 'CSV escaping: boolean true becomes TRUE');
    assert(escapeCsvValue(false) === 'FALSE', 'CSV escaping: boolean false becomes FALSE');
  }

  // 2. CSV header generation tests
  {
    const csvEmpty = generateTelemetryCSV([]);
    const lines = csvEmpty.trim().split('\n');
    assert(lines.length === 1, 'CSV header: Empty array produces exactly 1 header line');

    const headers = lines[0].split(',');
    assert(headers.length === TELEMETRY_CSV_COLUMNS.length, `CSV header: Column count matches (${headers.length})`);
    assert(headers.includes('timestamp_s'), 'CSV header: includes timestamp_s');
    assert(headers.includes('tracking_status'), 'CSV header: includes tracking_status');
    assert(headers.includes('target_pan_deg'), 'CSV header: includes target_pan_deg');
    assert(headers.includes('gimbal_pan_deg'), 'CSV header: includes gimbal_pan_deg');
    assert(headers.includes('total_angular_error_deg'), 'CSV header: includes total_angular_error_deg');
    assert(headers.includes('link_locked'), 'CSV header: includes link_locked');
  }

  // 3. Empty telemetry handling tests
  {
    const csvResult = exportTelemetryCSV([]);
    assert(csvResult.success === false, 'Empty telemetry: CSV export returns success=false');
    assert(Boolean(csvResult.error), 'Empty telemetry: CSV export returns descriptive error message');

    const jsonResult = exportTelemetryJSON([]);
    assert(jsonResult.success === false, 'Empty telemetry: JSON export returns success=false');
    assert(Boolean(jsonResult.error), 'Empty telemetry: JSON export returns descriptive error message');
  }

  // 4. JSON serialization tests
  {
    const mockTelemetry: FrameTelemetry[] = [
      {
        timestamp: 1.234,
        frameNumber: 42,
        status: 'TRACKING',
        groundTruthScreen: { x: 320, y: 240, inFov: true },
        detectedScreen: { x: 322, y: 239 },
        predictedScreen: { x: 321, y: 240 },
        pixelError: 2.24,
        angularErrorDeg: 0.035,
        angularErrorMrad: 0.61,
        cameraPanDeg: 12.5,
        cameraTiltDeg: -3.2,
        targetPanDeg: 12.53,
        targetTiltDeg: -3.18,
        isLocked: true,
        fps: 60,
        processingTimeMs: 1.8,
        panErrorDeg: 0.03,
        tiltErrorDeg: 0.02,
        estimatedPanDeg: 12.52,
        estimatedTiltDeg: -3.19,
        panPidOutput: 0.15,
        tiltPidOutput: 0.08,
        detectionConfidence: 0.98,
        signalStrength: 0.95,
        beaconVisible: true,
      },
    ];

    const jsonStr = generateTelemetryJSON(mockTelemetry, {
      scenarioName: 'circular_orbit',
      detectorMode: 'classic_threshold',
      metadata: { seed: 42 },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
      assert(true, 'JSON serialization: Output is valid parseable JSON');
    } catch (e) {
      assert(false, 'JSON serialization: Output is valid parseable JSON');
    }

    if (parsed) {
      assert(parsed.format === 'fsoc-pat-telemetry-v1', 'JSON schema: format is fsoc-pat-telemetry-v1');
      assert(parsed.totalRecords === 1, 'JSON schema: totalRecords matches sample count');
      assert(parsed.scenario === 'circular_orbit', 'JSON schema: scenario name retained');
      assert(parsed.detectorMode === 'classic_threshold', 'JSON schema: detectorMode retained');
      assert(parsed.telemetry.length === 1, 'JSON schema: telemetry array length matches');
      assert(parsed.telemetry[0].frameNumber === 42, 'JSON schema: frame data correctly preserved');
      assert(parsed.telemetry[0].isLocked === true, 'JSON schema: isLocked boolean correctly preserved');
      assert(parsed.telemetry[0].panErrorDeg === 0.03, 'JSON schema: panErrorDeg correctly preserved');
    }

    // Check safe filename generation
    const testDate = new Date(2026, 8, 19, 14, 30, 0);
    const filenameCsv = generateTelemetryFilename('csv', 'LEO Spiral Track', 'blob_detector', testDate);
    assert(filenameCsv === 'fsoc-pat_leo-spiral-track_blob_detector_20260919_143000.csv', `Safe filename CSV: ${filenameCsv}`);

    const filenameJson = generateTelemetryFilename('json', undefined, undefined, testDate);
    assert(filenameJson === 'fsoc-pat_20260919_143000.json', `Safe filename JSON fallback: ${filenameJson}`);
  }

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
