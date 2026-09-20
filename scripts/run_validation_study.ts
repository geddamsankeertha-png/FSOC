import { FSOCSimulationEngine } from '../src/simulation/simulationEngine';
import { generateTelemetryCSV, generateTelemetryJSON } from '../src/utils/telemetryExport';
import { FrameTelemetry } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

interface ScenarioDefinition {
  id: string;
  name: string;
  filenamePrefix: string;
  trajectory: 'circular' | 'figure8' | 'sinusoidal' | 'evasive';
  speed: number;
  durationSec: number;
  seed: number;
  multiTargetClutter: boolean;
  disturbances: {
    sensorNoisePercent?: number;
    platformVibrationDeg?: number;
    vibrationFrequencyHz?: number;
    turbulencePercent?: number;
    opticalBlurPx?: number;
    atmosphericFogPercent?: number;
    manualOcclusion?: boolean;
  };
  occlusionWindow?: { startSec: number; endSec: number };
}

interface ValidationMetrics {
  scenarioName: string;
  durationSec: number;
  telemetryRecords: number;
  acquisitionTimeSec: number | null;
  meanAngularErrorDeg: number;
  rmsAngularErrorDeg: number;
  maxAngularErrorDeg: number;
  p95AngularErrorDeg: number;
  minAngularErrorDeg: number;
  timeBelow1DegSec: number;
  timeBelow05DegSec: number;
  timeBelow022DegSec: number;
  lockRetentionRatePct: number;
  lockLossEvents: number;
  reacquisitionTimeSec: number | null;
  averageFps: number;
  averageProcessingTimeMs: number;
  maxProcessingTimeMs: number;
  detectionPrecisionPct: number;
  detectionRecallPct: number;
  decoyRejectionRatePct: number;
  selectedFalseCandidatesCount: number;
  meanDetectedToGtDistancePx: number;
  meanPredictedToGtDistancePx: number;
  maxCentroidJumpPx: number;
  minConfidence: number;
  maxConfidence: number;
  uniqueConfidences: number[];
  isLockedAchieved: boolean;
  csvPath: string;
  jsonPath: string;
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'sc-01-circular',
    name: 'Circular Target (Seed 42)',
    filenamePrefix: 'circular_target_seed42',
    trajectory: 'circular',
    speed: 1.0,
    durationSec: 10.0,
    seed: 42,
    multiTargetClutter: false,
    disturbances: {},
  },
  {
    id: 'sc-02-figure8',
    name: 'Figure-Eight Target (Seed 42)',
    filenamePrefix: 'figure_eight_seed42',
    trajectory: 'figure8',
    speed: 1.0,
    durationSec: 10.0,
    seed: 42,
    multiTargetClutter: false,
    disturbances: {},
  },
  {
    id: 'sc-03-solar-glint',
    name: 'Solar-Glint Disturbance (Seed 42)',
    filenamePrefix: 'solar_glint_disturbance',
    trajectory: 'circular',
    speed: 1.0,
    durationSec: 10.0,
    seed: 42,
    multiTargetClutter: true, // activates multi-target clutter and decoys
    disturbances: {
      sensorNoisePercent: 12,
      platformVibrationDeg: 0.25,
      turbulencePercent: 15,
      opticalBlurPx: 2.2,
    },
  },
  {
    id: 'sc-04-occlusion',
    name: 'Temporary Occlusion (Seed 42)',
    filenamePrefix: 'temporary_occlusion',
    trajectory: 'circular',
    speed: 1.0,
    durationSec: 10.0,
    seed: 42,
    multiTargetClutter: false,
    disturbances: {},
    occlusionWindow: { startSec: 3.5, endSec: 4.8 }, // 1.3s occlusion
  },
  {
    id: 'sc-05-combined-stress',
    name: 'Combined Stress Test (Seed 42)',
    filenamePrefix: 'combined_stress_test',
    trajectory: 'evasive',
    speed: 1.2,
    durationSec: 10.0,
    seed: 42,
    multiTargetClutter: true,
    disturbances: {
      sensorNoisePercent: 20,
      platformVibrationDeg: 0.8,
      vibrationFrequencyHz: 22,
      turbulencePercent: 35,
      opticalBlurPx: 3.5,
      atmosphericFogPercent: 15,
    },
    occlusionWindow: { startSec: 4.0, endSec: 5.0 },
  },
  // Scenario 6: Lock Reachability Test (to rigorously verify isLocked transition)
  {
    id: 'sc-06-lock-reachability',
    name: 'Lock Reachability Verification (Seed 42)',
    filenamePrefix: 'lock_reachability_verification',
    trajectory: 'circular',
    speed: 0.1,
    durationSec: 6.0,
    seed: 42,
    multiTargetClutter: false,
    disturbances: {
      platformVibrationDeg: 0.05,
      sensorNoisePercent: 4,
      turbulencePercent: 5,
    },
  },
];

function runScenario(sc: ScenarioDefinition): ValidationMetrics {
  const engine = new FSOCSimulationEngine(sc.seed);
  engine.targetConfig.trajectory = sc.trajectory;
  engine.targetConfig.speed = sc.speed;
  engine.targetConfig.multiTargetClutter = sc.multiTargetClutter;
  Object.assign(engine.disturbanceConfig, sc.disturbances);

  const dt = 0.016;
  const totalSteps = Math.round(sc.durationSec / dt);

  const telemetryList: FrameTelemetry[] = [];

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let decoyRejections = 0;
  let decoyOpportunities = 0;
  let falseCandidateSelections = 0;

  let sumDetGtDist = 0;
  let detGtCount = 0;
  let sumPredGtDist = 0;
  let predGtCount = 0;

  let maxCentroidJump = 0;
  let prevCentroid: { x: number; y: number } | null = null;

  const confidences: number[] = [];
  const errors: number[] = [];

  let timeBelow1 = 0;
  let timeBelow05 = 0;
  let timeBelow022 = 0;

  let lockedFramesCount = 0;
  let lockTransitions = 0;
  let prevLocked = false;
  let isLockedAchieved = false;

  for (let step = 0; step < totalSteps; step++) {
    const currentSimTime = step * dt;

    // Apply scheduled occlusion if applicable
    if (sc.occlusionWindow) {
      const isOccluded = currentSimTime >= sc.occlusionWindow.startSec && currentSimTime <= sc.occlusionWindow.endSec;
      engine.disturbanceConfig.manualOcclusion = isOccluded;
    }

    engine.step(dt);
    const t = engine.currentTelemetry;
    const det = engine.currentDetection;
    telemetryList.push({ ...t });

    // Track lock transitions
    if (t.isLocked) {
      lockedFramesCount++;
      isLockedAchieved = true;
    }
    if (prevLocked && !t.isLocked) {
      lockTransitions++;
    }
    prevLocked = t.isLocked;

    // Angular errors
    errors.push(t.angularErrorDeg);
    if (t.angularErrorDeg < 1.0) timeBelow1 += dt;
    if (t.angularErrorDeg < 0.5) timeBelow05 += dt;
    if (t.angularErrorDeg < 0.22) timeBelow022 += dt;

    // Confidence
    confidences.push(t.detectionConfidence);

    // Centroid jumps & Ground Truth Proximity
    const gt = t.groundTruthScreen;
    const isTargetVisible = gt && gt.inFov && !engine.targetState.isOccluded;

    if (t.detectedScreen) {
      if (prevCentroid) {
        const jump = Math.hypot(t.detectedScreen.x - prevCentroid.x, t.detectedScreen.y - prevCentroid.y);
        if (jump > maxCentroidJump) {
          maxCentroidJump = jump;
        }
      }
      prevCentroid = { x: t.detectedScreen.x, y: t.detectedScreen.y };

      if (gt && isTargetVisible) {
        const dist = Math.hypot(t.detectedScreen.x - gt.x, t.detectedScreen.y - gt.y);
        sumDetGtDist += dist;
        detGtCount++;

        // Precision / Recall evaluation
        if (dist <= 30.0) {
          truePositives++;
        } else {
          falsePositives++;
          falseCandidateSelections++;
        }
      } else {
        // Detected something when target was occluded or out of FOV
        falsePositives++;
        falseCandidateSelections++;
      }
    } else {
      prevCentroid = null;
      if (isTargetVisible) {
        falseNegatives++;
      }
    }

    // Predicted Screen to Ground Truth
    if (t.predictedScreen && gt && isTargetVisible) {
      const pDist = Math.hypot(t.predictedScreen.x - gt.x, t.predictedScreen.y - gt.y);
      sumPredGtDist += pDist;
      predGtCount++;
    }

    // Decoy evaluation
    if (sc.multiTargetClutter) {
      decoyOpportunities++;
      // If detection was true positive (on beacon), or no false decoy was selected
      if (t.detectedScreen && gt && isTargetVisible) {
        const dist = Math.hypot(t.detectedScreen.x - gt.x, t.detectedScreen.y - gt.y);
        if (dist <= 30.0) {
          decoyRejections++;
        }
      } else if (!t.detectedScreen) {
        // No detection means decoys were also not selected
        decoyRejections++;
      }
    }
  }

  const sortedErrors = [...errors].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedErrors.length * 0.95);
  const p95AngularErrorDeg = sortedErrors[p95Index] ?? 0;
  const minAngularErrorDeg = sortedErrors[0] ?? 0;
  const maxAngularErrorDeg = sortedErrors[sortedErrors.length - 1] ?? 0;
  const meanAngularErrorDeg = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  const rmsAngularErrorDeg = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);

  const precision = truePositives + falsePositives > 0 ? (truePositives / (truePositives + falsePositives)) * 100 : 0;
  const recall = truePositives + falseNegatives > 0 ? (truePositives / (truePositives + falseNegatives)) * 100 : 0;
  const decoyRejectionRate = decoyOpportunities > 0 ? (decoyRejections / decoyOpportunities) * 100 : 100;

  const stats = engine.getPerformanceStats();

  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const csvContent = generateTelemetryCSV(telemetryList);
  const jsonContent = generateTelemetryJSON(telemetryList, {
    scenarioName: sc.name,
    detectorMode: engine.perceptionMode,
    metadata: {
      seed: sc.seed,
      trajectory: sc.trajectory,
      speed: sc.speed,
      durationSec: sc.durationSec,
      multiTargetClutter: sc.multiTargetClutter,
      disturbances: sc.disturbances,
      stats,
    },
  });

  const csvPath = path.join(exportDir, `${sc.filenamePrefix}.csv`);
  const jsonPath = path.join(exportDir, `${sc.filenamePrefix}.json`);
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  fs.writeFileSync(jsonPath, jsonContent, 'utf-8');

  const uniqueConfs = Array.from(new Set(confidences.map((c) => Number(c.toFixed(2))))).sort((a, b) => a - b);

  return {
    scenarioName: sc.name,
    durationSec: sc.durationSec,
    telemetryRecords: telemetryList.length,
    acquisitionTimeSec: stats.acquisitionTimeSec,
    meanAngularErrorDeg: Number(meanAngularErrorDeg.toFixed(3)),
    rmsAngularErrorDeg: Number(rmsAngularErrorDeg.toFixed(3)),
    maxAngularErrorDeg: Number(maxAngularErrorDeg.toFixed(3)),
    p95AngularErrorDeg: Number(p95AngularErrorDeg.toFixed(3)),
    minAngularErrorDeg: Number(minAngularErrorDeg.toFixed(3)),
    timeBelow1DegSec: Number(timeBelow1.toFixed(2)),
    timeBelow05DegSec: Number(timeBelow05.toFixed(2)),
    timeBelow022DegSec: Number(timeBelow022.toFixed(2)),
    lockRetentionRatePct: Number(((lockedFramesCount / telemetryList.length) * 100).toFixed(1)),
    lockLossEvents: lockTransitions,
    reacquisitionTimeSec: stats.reacquisitionTimeSec,
    averageFps: Math.round(telemetryList.reduce((acc, t) => acc + t.fps, 0) / telemetryList.length),
    averageProcessingTimeMs: Number((telemetryList.reduce((acc, t) => acc + t.processingTimeMs, 0) / telemetryList.length).toFixed(2)),
    maxProcessingTimeMs: Number(Math.max(...telemetryList.map((t) => t.processingTimeMs)).toFixed(2)),
    detectionPrecisionPct: Number(precision.toFixed(1)),
    detectionRecallPct: Number(recall.toFixed(1)),
    decoyRejectionRatePct: Number(decoyRejectionRate.toFixed(1)),
    selectedFalseCandidatesCount: falseCandidateSelections,
    meanDetectedToGtDistancePx: detGtCount > 0 ? Number((sumDetGtDist / detGtCount).toFixed(2)) : 0,
    meanPredictedToGtDistancePx: predGtCount > 0 ? Number((sumPredGtDist / predGtCount).toFixed(2)) : 0,
    maxCentroidJumpPx: Number(maxCentroidJump.toFixed(2)),
    minConfidence: Math.min(...confidences),
    maxConfidence: Math.max(...confidences),
    uniqueConfidences: uniqueConfs,
    isLockedAchieved,
    csvPath,
    jsonPath,
  };
}

console.log('Running FSOC PAT Post-Fix Validation Study...\n');
const results: ValidationMetrics[] = [];

for (const sc of SCENARIOS) {
  process.stdout.write(`Executing ${sc.name}... `);
  const metrics = runScenario(sc);
  results.push(metrics);
  console.log(`Done! Exported to ${path.basename(metrics.csvPath)} and ${path.basename(metrics.jsonPath)}`);
}

console.log('\n================ VALIDATION STUDY REPORT ================\n');
for (const r of results) {
  console.log(`--- ${r.scenarioName} ---`);
  console.log(`- Simulation duration: ${r.durationSec.toFixed(2)} s`);
  console.log(`- Number of telemetry records: ${r.telemetryRecords}`);
  console.log(`- Acquisition time: ${r.acquisitionTimeSec !== null ? `${r.acquisitionTimeSec.toFixed(3)} s` : 'N/A (Threshold 0.22° not reached under dynamic tracking lag)'}`);
  console.log(`- Mean angular error: ${r.meanAngularErrorDeg}°`);
  console.log(`- RMS angular error: ${r.rmsAngularErrorDeg}°`);
  console.log(`- Maximum angular error: ${r.maxAngularErrorDeg}°`);
  console.log(`- 95th-percentile angular error: ${r.p95AngularErrorDeg}°`);
  console.log(`- Minimum angular error: ${r.minAngularErrorDeg}°`);
  console.log(`- Time below 1.0 degrees: ${r.timeBelow1DegSec} s (${((r.timeBelow1DegSec / r.durationSec) * 100).toFixed(1)}%)`);
  console.log(`- Time below 0.5 degrees: ${r.timeBelow05DegSec} s (${((r.timeBelow05DegSec / r.durationSec) * 100).toFixed(1)}%)`);
  console.log(`- Time below 0.22 degrees: ${r.timeBelow022DegSec} s (${((r.timeBelow022DegSec / r.durationSec) * 100).toFixed(1)}%)`);
  console.log(`- Lock retention rate: ${r.lockRetentionRatePct}%`);
  console.log(`- Number of lock-loss events: ${r.lockLossEvents}`);
  console.log(`- Reacquisition time: ${r.reacquisitionTimeSec !== null ? `${r.reacquisitionTimeSec.toFixed(3)} s` : 'N/A'}`);
  console.log(`- Average FPS: ${r.averageFps}`);
  console.log(`- Average processing time: ${r.averageProcessingTimeMs} ms`);
  console.log(`- Maximum processing time: ${r.maxProcessingTimeMs} ms`);
  console.log(`- Detection precision: ${r.detectionPrecisionPct}%`);
  console.log(`- Detection recall: ${r.detectionRecallPct}%`);
  console.log(`- Decoy rejection rate: ${r.decoyRejectionRatePct}%`);
  console.log(`- Number of selected false candidates: ${r.selectedFalseCandidatesCount}`);
  console.log(`- Verification - detectedScreen near groundTruthScreen: Mean distance = ${r.meanDetectedToGtDistancePx} px`);
  console.log(`- Verification - predictedScreen follows true beacon: Mean distance = ${r.meanPredictedToGtDistancePx} px`);
  console.log(`- Verification - No large centroid jumps: Max frame-to-frame jump = ${r.maxCentroidJumpPx} px`);
  console.log(`- Verification - Confidence distribution: min=${r.minConfidence}, max=${r.maxConfidence}, unique=[${r.uniqueConfidences.join(', ')}]`);
  console.log(`- Verification - isLocked transition: ${r.isLockedAchieved ? 'True (Lock successfully acquired & verified)' : 'False (Dynamic velocity lag exceeded 0.22° lock limit)'}`);
  console.log(`- Exports: CSV: ${r.csvPath} | JSON: ${r.jsonPath}\n`);
}

// Summary JSON
fs.writeFileSync(
  path.join(process.cwd(), 'exports', 'validation_study_summary.json'),
  JSON.stringify(results, null, 2),
  'utf-8'
);
console.log('All exports written to /exports/');
