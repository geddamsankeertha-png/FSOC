import { FrameTelemetry } from '../types';

export interface ExportOptions {
  scenarioName?: string;
  detectorMode?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  recordCount?: number;
  error?: string;
}

/**
 * Escapes a single value for standard CSV compatibility (RFC 4180).
 * Handles commas, quotation marks, and line breaks.
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val.toString() : '';
  }

  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a safe, standardized filename containing:
 * fsoc-pat, scenario name (if available), detector mode (if available), and timestamp.
 */
export function generateTelemetryFilename(
  format: 'csv' | 'json',
  scenarioName?: string,
  detectorMode?: string,
  date: Date = new Date()
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const parts = ['fsoc-pat'];
  if (scenarioName && scenarioName.trim()) {
    const cleanScenario = sanitize(scenarioName);
    if (cleanScenario) parts.push(cleanScenario);
  }
  if (detectorMode && detectorMode.trim()) {
    const cleanMode = sanitize(detectorMode);
    if (cleanMode) parts.push(cleanMode);
  }
  parts.push(ts);

  return `${parts.join('_')}.${format}`;
}

/**
 * CSV column definitions for virtual simulation telemetry.
 */
export const TELEMETRY_CSV_COLUMNS: Array<{
  header: string;
  getValue: (sample: FrameTelemetry) => unknown;
}> = [
  { header: 'timestamp_s', getValue: (s) => (s.timestamp !== undefined ? Number(s.timestamp.toFixed(4)) : '') },
  { header: 'frame_number', getValue: (s) => s.frameNumber },
  { header: 'tracking_status', getValue: (s) => s.status },
  { header: 'target_pan_deg', getValue: (s) => (s.targetPanDeg !== undefined ? Number(s.targetPanDeg.toFixed(3)) : '') },
  { header: 'target_tilt_deg', getValue: (s) => (s.targetTiltDeg !== undefined ? Number(s.targetTiltDeg.toFixed(3)) : '') },
  { header: 'estimated_pan_deg', getValue: (s) => (s.estimatedPanDeg !== undefined ? Number(s.estimatedPanDeg.toFixed(3)) : '') },
  { header: 'estimated_tilt_deg', getValue: (s) => (s.estimatedTiltDeg !== undefined ? Number(s.estimatedTiltDeg.toFixed(3)) : '') },
  { header: 'gimbal_pan_deg', getValue: (s) => (s.cameraPanDeg !== undefined ? Number(s.cameraPanDeg.toFixed(3)) : '') },
  { header: 'gimbal_tilt_deg', getValue: (s) => (s.cameraTiltDeg !== undefined ? Number(s.cameraTiltDeg.toFixed(3)) : '') },
  { header: 'pan_error_deg', getValue: (s) => (s.panErrorDeg !== undefined ? Number(s.panErrorDeg.toFixed(4)) : '') },
  { header: 'tilt_error_deg', getValue: (s) => (s.tiltErrorDeg !== undefined ? Number(s.tiltErrorDeg.toFixed(4)) : '') },
  { header: 'total_angular_error_deg', getValue: (s) => (s.angularErrorDeg !== undefined ? Number(s.angularErrorDeg.toFixed(4)) : '') },
  { header: 'total_angular_error_mrad', getValue: (s) => (s.angularErrorMrad !== undefined ? Number(s.angularErrorMrad.toFixed(2)) : '') },
  { header: 'pixel_error_px', getValue: (s) => (s.pixelError !== undefined ? Number(s.pixelError.toFixed(2)) : '') },
  { header: 'rssi_signal_strength', getValue: (s) => (s.signalStrength !== undefined ? Number(s.signalStrength.toFixed(3)) : (s.snrDb !== undefined ? s.snrDb : '')) },
  { header: 'pan_pid_output', getValue: (s) => (s.panPidOutput !== undefined ? Number(s.panPidOutput.toFixed(3)) : '') },
  { header: 'tilt_pid_output', getValue: (s) => (s.tiltPidOutput !== undefined ? Number(s.tiltPidOutput.toFixed(3)) : '') },
  { header: 'detection_confidence', getValue: (s) => (s.detectionConfidence !== undefined ? Number(s.detectionConfidence.toFixed(3)) : '') },
  { header: 'beacon_visible', getValue: (s) => (s.beaconVisible !== undefined ? s.beaconVisible : (s.groundTruthScreen?.inFov ?? '')) },
  { header: 'ground_truth_in_fov', getValue: (s) => s.groundTruthScreen?.inFov ?? '' },
  { header: 'ground_truth_x_px', getValue: (s) => (s.groundTruthScreen?.x !== undefined ? Number(s.groundTruthScreen.x.toFixed(1)) : '') },
  { header: 'ground_truth_y_px', getValue: (s) => (s.groundTruthScreen?.y !== undefined ? Number(s.groundTruthScreen.y.toFixed(1)) : '') },
  { header: 'detected_x_px', getValue: (s) => (s.detectedScreen ? Number(s.detectedScreen.x.toFixed(1)) : '') },
  { header: 'detected_y_px', getValue: (s) => (s.detectedScreen ? Number(s.detectedScreen.y.toFixed(1)) : '') },
  { header: 'predicted_x_px', getValue: (s) => (s.predictedScreen ? Number(s.predictedScreen.x.toFixed(1)) : '') },
  { header: 'predicted_y_px', getValue: (s) => (s.predictedScreen ? Number(s.predictedScreen.y.toFixed(1)) : '') },
  { header: 'link_locked', getValue: (s) => s.isLocked },
  { header: 'mechanical_pan_error_deg', getValue: (s) => (s.mechanicalPanErrorDeg !== undefined ? Number(s.mechanicalPanErrorDeg.toFixed(4)) : '') },
  { header: 'mechanical_tilt_error_deg', getValue: (s) => (s.mechanicalTiltErrorDeg !== undefined ? Number(s.mechanicalTiltErrorDeg.toFixed(4)) : '') },
  { header: 'mechanical_pointing_error_deg', getValue: (s) => (s.mechanicalPointingErrorDeg !== undefined ? Number(s.mechanicalPointingErrorDeg.toFixed(4)) : '') },
  { header: 'instantaneous_optical_error_deg', getValue: (s) => (s.instantaneousOpticalErrorDeg !== undefined ? Number(s.instantaneousOpticalErrorDeg.toFixed(4)) : '') },
  { header: 'filtered_optical_error_deg', getValue: (s) => (s.filteredOpticalErrorDeg !== undefined ? Number(s.filteredOpticalErrorDeg.toFixed(4)) : '') },
  { header: 'lock_evaluation_error_deg', getValue: (s) => (s.lockEvaluationErrorDeg !== undefined ? Number(s.lockEvaluationErrorDeg.toFixed(4)) : '') },
  { header: 'lock_evaluation_mode', getValue: (s) => s.lockEvaluationMode ?? '' },
  { header: 'feedforward_pan_rate_dps', getValue: (s) => (s.feedforwardPanRateDegPerSec !== undefined ? Number(s.feedforwardPanRateDegPerSec.toFixed(3)) : '') },
  { header: 'feedforward_tilt_rate_dps', getValue: (s) => (s.feedforwardTiltRateDegPerSec !== undefined ? Number(s.feedforwardTiltRateDegPerSec.toFixed(3)) : '') },
  { header: 'fps', getValue: (s) => s.fps },
  { header: 'processing_time_ms', getValue: (s) => s.processingTimeMs },
];

/**
 * Generates standard RFC 4180 CSV string from recorded FrameTelemetry array.
 */
export function generateTelemetryCSV(telemetry: FrameTelemetry[]): string {
  const headerRow = TELEMETRY_CSV_COLUMNS.map((col) => escapeCsvValue(col.header)).join(',');
  if (!telemetry || telemetry.length === 0) {
    return `${headerRow}\n`;
  }

  const rows = telemetry.map((sample) => {
    return TELEMETRY_CSV_COLUMNS.map((col) => escapeCsvValue(col.getValue(sample))).join(',');
  });

  return `${headerRow}\n${rows.join('\n')}\n`;
}

/**
 * Generates formatted JSON serialization for virtual simulation telemetry.
 */
export function generateTelemetryJSON(
  telemetry: FrameTelemetry[],
  options?: ExportOptions
): string {
  const payload = {
    format: 'fsoc-pat-telemetry-v1',
    exportedAt: new Date().toISOString(),
    scenario: options?.scenarioName || null,
    detectorMode: options?.detectorMode || null,
    totalRecords: telemetry.length,
    metadata: options?.metadata || {},
    telemetry,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Browser file download helper using Blob and URL.createObjectURL.
 * Automatically revokes object URL after download trigger.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL cleanly
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 250);
}

/**
 * High-level CSV export function with input validation and safe filename generation.
 */
export function exportTelemetryCSV(
  telemetry: FrameTelemetry[],
  options?: ExportOptions
): ExportResult {
  if (!telemetry || telemetry.length === 0) {
    return {
      success: false,
      error: 'No telemetry records available to export.',
    };
  }

  try {
    const csvContent = generateTelemetryCSV(telemetry);
    const filename = generateTelemetryFilename(
      'csv',
      options?.scenarioName,
      options?.detectorMode
    );
    triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');

    return {
      success: true,
      filename,
      recordCount: telemetry.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export CSV telemetry';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * High-level JSON export function with input validation and safe filename generation.
 */
export function exportTelemetryJSON(
  telemetry: FrameTelemetry[],
  options?: ExportOptions
): ExportResult {
  if (!telemetry || telemetry.length === 0) {
    return {
      success: false,
      error: 'No telemetry records available to export.',
    };
  }

  try {
    const jsonContent = generateTelemetryJSON(telemetry, options);
    const filename = generateTelemetryFilename(
      'json',
      options?.scenarioName,
      options?.detectorMode
    );
    triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');

    return {
      success: true,
      filename,
      recordCount: telemetry.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export JSON telemetry';
    return {
      success: false,
      error: message,
    };
  }
}
