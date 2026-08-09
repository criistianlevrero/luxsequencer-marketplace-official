type WorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'updateUniform'; name: string; value: unknown }
  | { type: 'dispose' };

const WORKER_PROTOCOL_VERSION = '1.0.0';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let canvas: OffscreenCanvas | null = null;
let context2d: OffscreenCanvasRenderingContext2D | null = null;
let frameTimer: ReturnType<typeof setInterval> | null = null;

const renderFrameIntervals: number[] = [];
const dataIntervals: number[] = [];

let previousRenderAtMs: number | null = null;
let previousHeartbeatAtMs: number | null = null;
let latestHeartbeatAtMs: number | null = null;

let targetFps = 60;
let fpsSmoothingSamples = 45;
let dataSmoothingSamples = 45;
let stallThresholdMs = 120;
let graphRangeMs = 200;
let latestPayloadBytes = 0;
let latestSignalCount = 0;
let latestSequence = 0;
let latestProbeX = 0;
let latestProbeZ = 0;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const finiteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

const pushSample = (buffer: number[], value: number, limit: number) => {
  buffer.push(value);
  const maxLength = Math.max(1, Math.floor(limit));
  while (buffer.length > maxLength) {
    buffer.shift();
  }
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

const jitter = (values: number[], mean: number | null): number | null => {
  if (values.length < 2 || mean === null) return null;
  const variance = values.reduce((acc, value) => {
    const delta = value - mean;
    return acc + delta * delta;
  }, 0) / values.length;
  return Math.sqrt(variance);
};

const format = (value: number | null, fractionDigits = 1): string => {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(fractionDigits);
};

const recordHeartbeat = (heartbeatAtMs: number) => {
  latestHeartbeatAtMs = heartbeatAtMs;
  if (previousHeartbeatAtMs !== null) {
    const delta = heartbeatAtMs - previousHeartbeatAtMs;
    if (delta > 0 && delta < 5000) {
      pushSample(dataIntervals, delta, dataSmoothingSamples);
    }
  }
  previousHeartbeatAtMs = heartbeatAtMs;
};

const drawBackground = (context: OffscreenCanvasRenderingContext2D, width: number, height: number) => {
  context.fillStyle = '#0b1220';
  context.fillRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(34, 211, 238, 0.12)');
  gradient.addColorStop(1, 'rgba(168, 85, 247, 0.08)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
};

const drawIntervalsChart = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  intervals: number[],
  maxIntervalMs: number,
  thresholdMs: number,
) => {
  const chartX = 24;
  const chartY = 264;
  const chartWidth = Math.max(120, width - 48);
  const chartHeight = Math.max(60, height - chartY - 24);

  context.fillStyle = 'rgba(15, 23, 42, 0.75)';
  context.fillRect(chartX, chartY, chartWidth, chartHeight);

  context.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  context.lineWidth = 1;
  context.strokeRect(chartX + 0.5, chartY + 0.5, chartWidth - 1, chartHeight - 1);

  const thresholdY = chartY + chartHeight - (clamp(thresholdMs, 0, maxIntervalMs) / maxIntervalMs) * chartHeight;
  context.strokeStyle = 'rgba(248, 113, 113, 0.85)';
  context.beginPath();
  context.moveTo(chartX, thresholdY);
  context.lineTo(chartX + chartWidth, thresholdY);
  context.stroke();

  const recent = intervals.slice(-Math.min(intervals.length, Math.max(20, Math.floor(chartWidth / 3))));
  if (recent.length === 0) {
    context.fillStyle = 'rgba(148, 163, 184, 0.8)';
    context.font = '12px system-ui, sans-serif';
    context.fillText('Esperando heartbeats de datos...', chartX + 10, chartY + chartHeight / 2);
    return;
  }

  const barWidth = chartWidth / recent.length;
  recent.forEach((value, index) => {
    const clamped = clamp(value, 0, maxIntervalMs);
    const normalized = clamped / maxIntervalMs;
    const barHeight = normalized * chartHeight;
    const x = chartX + index * barWidth;
    const y = chartY + chartHeight - barHeight;
    const isStall = value >= thresholdMs;

    context.fillStyle = isStall ? 'rgba(248, 113, 113, 0.9)' : 'rgba(34, 211, 238, 0.9)';
    context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
  });

  context.fillStyle = 'rgba(226, 232, 240, 0.9)';
  context.font = '12px system-ui, sans-serif';
  context.fillText(`Intervalo ms (max ${Math.round(maxIntervalMs)} | umbral ${Math.round(thresholdMs)})`, chartX, chartY - 8);
};

const drawProbeXZPanel = (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  probeX: number,
  probeZ: number,
) => {
  const panelX = 24;
  const panelY = 176;
  const panelWidth = Math.max(220, Math.min(320, width - 48));
  const panelHeight = 72;
  const padding = 10;

  context.fillStyle = 'rgba(15, 23, 42, 0.75)';
  context.fillRect(panelX, panelY, panelWidth, panelHeight);

  context.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  context.lineWidth = 1;
  context.strokeRect(panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);

  const minX = panelX + padding;
  const maxX = panelX + panelWidth - padding;
  const minY = panelY + padding;
  const maxY = panelY + panelHeight - padding;

  const centerX = panelX + panelWidth / 2;
  const centerY = panelY + panelHeight / 2;
  context.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  context.beginPath();
  context.moveTo(centerX, minY);
  context.lineTo(centerX, maxY);
  context.moveTo(minX, centerY);
  context.lineTo(maxX, centerY);
  context.stroke();

  const normalizedX = (clamp(probeX, -1, 1) + 1) * 0.5;
  const normalizedZ = (clamp(probeZ, -1, 1) + 1) * 0.5;
  const ballX = minX + normalizedX * (maxX - minX);
  const ballY = minY + normalizedZ * (maxY - minY);

  context.fillStyle = '#ef4444';
  context.beginPath();
  context.arc(ballX, ballY, 6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#fecaca';
  context.font = '12px system-ui, sans-serif';
  context.fillText(`Probe X/Z: ${format(probeX, 2)} / ${format(probeZ, 2)}`, panelX, panelY - 8);
};

const drawScene = () => {
  if (!canvas || !context2d) return;

  const now = performance.now();

  if (previousRenderAtMs !== null) {
    const renderDelta = Math.max(0.001, now - previousRenderAtMs);
    pushSample(renderFrameIntervals, renderDelta, fpsSmoothingSamples);
  }
  previousRenderAtMs = now;

  const renderAvgMs = average(renderFrameIntervals);
  const renderFps = renderAvgMs ? 1000 / renderAvgMs : null;

  const dataAvgMs = average(dataIntervals);
  const dataFps = dataAvgMs ? 1000 / dataAvgMs : null;
  const dataJitterMs = jitter(dataIntervals, dataAvgMs);

  const sinceLastHeartbeatMs = latestHeartbeatAtMs === null ? null : now - latestHeartbeatAtMs;
  const isHeartbeatStale = sinceLastHeartbeatMs !== null && sinceLastHeartbeatMs > stallThresholdMs;

  context2d.setTransform(1, 0, 0, -1, 0, canvas.height);

  drawBackground(context2d, canvas.width, canvas.height);

  context2d.fillStyle = '#e2e8f0';
  context2d.font = 'bold 18px system-ui, sans-serif';
  context2d.fillText('Pipeline Diagnostic: FPS + Data Cadence', 24, 34);

  context2d.font = '14px system-ui, sans-serif';
  context2d.fillStyle = '#93c5fd';
  context2d.fillText(`Render FPS: ${format(renderFps, 1)}`, 24, 68);

  context2d.fillStyle = '#67e8f9';
  context2d.fillText(`Data updates/s: ${format(dataFps, 1)}`, 24, 92);

  context2d.fillStyle = '#c4b5fd';
  context2d.fillText(`Avg data interval: ${format(dataAvgMs, 1)} ms`, 24, 116);

  context2d.fillStyle = '#f9a8d4';
  context2d.fillText(`Data jitter (σ): ${format(dataJitterMs, 1)} ms`, 24, 140);

  context2d.fillStyle = isHeartbeatStale ? '#f87171' : '#86efac';
  context2d.fillText(
    `Last heartbeat: ${sinceLastHeartbeatMs === null ? 'n/a' : `${format(sinceLastHeartbeatMs, 0)} ms ago`}`,
    360,
    68,
  );

  context2d.fillStyle = '#cbd5e1';
  context2d.fillText(`Target FPS: ${Math.round(targetFps)}`, 360, 92);
  context2d.fillText(`Render smoothing: ${Math.round(fpsSmoothingSamples)} samples`, 360, 116);
  context2d.fillText(`Data smoothing: ${Math.round(dataSmoothingSamples)} samples`, 360, 140);
  context2d.fillText(`Probe payload: ${Math.round(latestPayloadBytes)} bytes`, 360, 164);
  context2d.fillText(`Probe signals: ${Math.round(latestSignalCount)} | seq ${Math.round(latestSequence)}`, 360, 188);

  drawProbeXZPanel(context2d, canvas.width, latestProbeX, latestProbeZ);

  drawIntervalsChart(context2d, canvas.width, canvas.height, dataIntervals, graphRangeMs, stallThresholdMs);

  const bitmap = canvas.transferToImageBitmap();
  workerScope.postMessage({ type: 'frame', bitmap }, [bitmap]);
};

const startLoop = () => {
  const intervalMs = Math.max(4, Math.round(1000 / clamp(targetFps, 10, 120)));

  if (frameTimer) {
    clearInterval(frameTimer);
  }

  frameTimer = setInterval(drawScene, intervalMs);
};

const stopLoop = () => {
  if (!frameTimer) return;
  clearInterval(frameTimer);
  frameTimer = null;
};

workerScope.onmessage = (event) => {
  const message = event.data;

  switch (message.type) {
    case 'init': {
      canvas = message.canvas;
      canvas.width = Math.max(1, Math.floor(message.width));
      canvas.height = Math.max(1, Math.floor(message.height));

      context2d = canvas.getContext('2d');
      if (!context2d) {
        workerScope.postMessage({ type: 'error', message: 'Canvas2D no disponible en worker diagnostic-fps' });
        return;
      }

      workerScope.postMessage({
        type: 'ready',
        rendererId: 'diagnostic-fps',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        capabilities: ['offscreen-canvas', 'canvas2d', 'uniform-updates'],
      });

      startLoop();
      break;
    }

    case 'resize': {
      if (!canvas) return;
      canvas.width = Math.max(1, Math.floor(message.width));
      canvas.height = Math.max(1, Math.floor(message.height));
      break;
    }

    case 'updateUniform': {
      const { name, value } = message;

      if (name === 'targetFps') {
        const next = finiteNumber(value);
        if (next !== null) {
          targetFps = clamp(next, 10, 120);
          startLoop();
        }
      }

      if (name === 'fpsSmoothingSamples') {
        const next = finiteNumber(value);
        if (next !== null) {
          fpsSmoothingSamples = clamp(Math.round(next), 5, 240);
        }
      }

      if (name === 'dataSmoothingSamples') {
        const next = finiteNumber(value);
        if (next !== null) {
          dataSmoothingSamples = clamp(Math.round(next), 5, 240);
          while (dataIntervals.length > dataSmoothingSamples) {
            dataIntervals.shift();
          }
        }
      }

      if (name === 'stallThresholdMs') {
        const next = finiteNumber(value);
        if (next !== null) {
          stallThresholdMs = clamp(next, 16, 1000);
        }
      }

      if (name === 'graphRangeMs') {
        const next = finiteNumber(value);
        if (next !== null) {
          graphRangeMs = clamp(next, 33, 1000);
        }
      }

      if (name === 'pipelineDataProbe' && value && typeof value === 'object') {
        const payload = value as {
          sequence?: unknown;
          timestampMs?: unknown;
          signals?: unknown;
          payload?: unknown;
          x?: unknown;
          z?: unknown;
        };

        const sequence = finiteNumber(payload.sequence);
        if (sequence !== null) {
          latestSequence = sequence;
        }

        const timestampMs = finiteNumber(payload.timestampMs);
        if (timestampMs !== null) {
          recordHeartbeat(timestampMs);
        }

        latestSignalCount = Array.isArray(payload.signals) ? payload.signals.length : 0;

        if (typeof payload.payload === 'string') {
          latestPayloadBytes = payload.payload.length;
        } else {
          latestPayloadBytes = 0;
        }

        const nextX = finiteNumber(payload.x);
        if (nextX !== null) {
          latestProbeX = clamp(nextX, -1, 1);
        }

        const nextZ = finiteNumber(payload.z);
        if (nextZ !== null) {
          latestProbeZ = clamp(nextZ, -1, 1);
        }
      }

      break;
    }

    case 'dispose': {
      stopLoop();
      canvas = null;
      context2d = null;
      previousRenderAtMs = null;
      previousHeartbeatAtMs = null;
      latestHeartbeatAtMs = null;
      latestPayloadBytes = 0;
      latestSignalCount = 0;
      latestSequence = 0;
      latestProbeX = 0;
      latestProbeZ = 0;
      renderFrameIntervals.length = 0;
      dataIntervals.length = 0;
      break;
    }
  }
};

export {};
