type WorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'updateUniform'; name: string; value: unknown }
  | { type: 'dispose' };

type GradientStop = { color: string; hardStop?: boolean };

type ConcentricUniformSettings = {
  repetitionSpeed: number;
  growthSpeed: number;
  initialSize: number;
  rotationSpeed: number;
  strokeWidth: number;
  fillMode: 'stroke' | 'fill' | 'both';
  sides: number;
  gradientColors: GradientStop[];
  backgroundGradientColors: GradientStop[];
  animationSpeed: number;
};

type RingSnapshot = {
  creationTime: number;
  initialSize: number;
  sides: number;
  strokeWidth: number;
  fillMode: 'stroke' | 'fill' | 'both';
  growthSpeed: number;
  rotationSpeed: number;
  gradientColors: Array<{ r: number; g: number; b: number }>;
};

const WORKER_PROTOCOL_VERSION = '1.0.0';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let canvas: OffscreenCanvas | null = null;
let context2d: OffscreenCanvasRenderingContext2D | null = null;
let frameTimer: ReturnType<typeof setInterval> | null = null;
let settings: ConcentricUniformSettings = {
  repetitionSpeed: 0.5,
  growthSpeed: 0.5,
  initialSize: 10,
  rotationSpeed: 0,
  strokeWidth: 2,
  fillMode: 'stroke',
  sides: 6,
  gradientColors: [
    { color: '#22d3ee', hardStop: false },
    { color: '#a855f7', hardStop: false },
  ],
  backgroundGradientColors: [
    { color: '#0f172a', hardStop: false },
    { color: '#111827', hardStop: false },
  ],
  animationSpeed: 1,
};

let rings: RingSnapshot[] = [];
let lastCreationTime = 0;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    return { r: 1, g: 1, b: 1 };
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return { r: 1, g: 1, b: 1 };
  }

  return { r, g, b };
};

const lerpColor = (
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } => {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
};

const gradientToRgb = (gradient: GradientStop[]): Array<{ r: number; g: number; b: number }> => {
  if (!Array.isArray(gradient) || gradient.length === 0) {
    return [hexToRgb('#ffffff')];
  }

  return gradient.slice(0, 10).map((stop) => hexToRgb(stop.color));
};

const calculateColorFromGradient = (
  gradient: Array<{ r: number; g: number; b: number }>,
  animationValue: number,
): { r: number; g: number; b: number } => {
  if (gradient.length === 0) return { r: 1, g: 1, b: 1 };
  if (gradient.length === 1) return gradient[0];

  const effectiveGradient = [...gradient, gradient[0]];
  const numSegments = effectiveGradient.length - 1;
  const normalizedValue = ((animationValue % 1) + 1) % 1;
  const colorPosition = normalizedValue * numSegments;
  const startIndex = Math.floor(colorPosition);
  const endIndex = Math.min(startIndex + 1, effectiveGradient.length - 1);
  const amount = colorPosition - startIndex;

  return lerpColor(effectiveGradient[startIndex], effectiveGradient[endIndex], amount);
};

const drawPolygon = (
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation: number,
): void => {
  if (!context2d) {
    return;
  }

  const angleStep = (Math.PI * 2) / sides;
  const angleOffset = Math.PI / sides + rotation;

  context2d.beginPath();
  for (let index = 0; index <= sides; index++) {
    const angle = index * angleStep + angleOffset;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    if (index === 0) {
      context2d.moveTo(x, y);
    } else {
      context2d.lineTo(x, y);
    }
  }
  context2d.closePath();
};

const drawScene = () => {
  if (!canvas || !context2d) {
    return;
  }

  const timestamp = performance.now();
  const width = canvas.width;
  const height = canvas.height;
  const maxDimension = Math.max(width, height);
  const diagonal = Math.sqrt(width * width + height * height);

  const backgroundColor = settings.backgroundGradientColors[0]?.color ?? '#111827';
  context2d.fillStyle = backgroundColor;
  context2d.fillRect(0, 0, width, height);

  const repetitionMs = Math.max(100, settings.repetitionSpeed * 1000);
  if (timestamp - lastCreationTime >= repetitionMs) {
    rings.push({
      creationTime: timestamp,
      initialSize: settings.initialSize,
      sides: clamp(Math.round(settings.sides), 3, 12),
      strokeWidth: clamp(settings.strokeWidth, 0.5, 10),
      fillMode: settings.fillMode,
      growthSpeed: settings.growthSpeed,
      rotationSpeed: settings.rotationSpeed,
      gradientColors: gradientToRgb(settings.gradientColors),
    });
    lastCreationTime = timestamp;
  }

  const animationSpeed = Math.max(0.1, settings.animationSpeed);

  rings = rings.filter((ring) => {
    const age = timestamp - ring.creationTime;
    const currentSize = ring.initialSize + age * ring.growthSpeed * 0.1 * animationSpeed;
    return currentSize < diagonal * 0.5;
  });

  for (const ring of rings) {
    const age = timestamp - ring.creationTime;
    const size = ring.initialSize + age * ring.growthSpeed * 0.1 * animationSpeed;
    const rotation = (age / 1000) * ((ring.rotationSpeed * Math.PI) / 180);
    const colorValue = (size / Math.max(1, maxDimension)) % 1;
    const color = calculateColorFromGradient(ring.gradientColors, colorValue);
    const rgba = `rgba(${Math.round(clamp(color.r, 0, 1) * 255)}, ${Math.round(clamp(color.g, 0, 1) * 255)}, ${Math.round(clamp(color.b, 0, 1) * 255)}, 1)`;

    drawPolygon(width * 0.5, height * 0.5, size, ring.sides, rotation);

    if (ring.fillMode === 'fill' || ring.fillMode === 'both') {
      context2d.fillStyle = rgba;
      context2d.fill();
    }

    if (ring.fillMode === 'stroke' || ring.fillMode === 'both') {
      context2d.strokeStyle = rgba;
      context2d.lineWidth = ring.strokeWidth;
      context2d.stroke();
    }
  }

  const bitmap = canvas.transferToImageBitmap();
  workerScope.postMessage({ type: 'frame', bitmap }, [bitmap]);
};

const startLoop = () => {
  if (frameTimer) {
    return;
  }

  frameTimer = setInterval(drawScene, 16);
};

const stopLoop = () => {
  if (!frameTimer) {
    return;
  }

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
        workerScope.postMessage({
          type: 'error',
          message: 'Canvas2D no disponible en worker para concentric',
        });
        return;
      }

      rings = [];
      lastCreationTime = 0;
      workerScope.postMessage({
        type: 'ready',
        rendererId: 'concentric',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        capabilities: ['offscreen-canvas', 'canvas2d', 'uniform-updates'],
      });
      startLoop();
      break;
    }

    case 'resize': {
      if (!canvas) {
        return;
      }

      canvas.width = Math.max(1, Math.floor(message.width));
      canvas.height = Math.max(1, Math.floor(message.height));
      break;
    }

    case 'updateUniform': {
      if (message.name === 'concentricSettings' && typeof message.value === 'object' && message.value !== null) {
        const next = message.value as Partial<ConcentricUniformSettings>;
        settings = {
          ...settings,
          ...next,
          fillMode: (next.fillMode ?? settings.fillMode) as 'stroke' | 'fill' | 'both',
          gradientColors: Array.isArray(next.gradientColors) ? next.gradientColors : settings.gradientColors,
          backgroundGradientColors: Array.isArray(next.backgroundGradientColors)
            ? next.backgroundGradientColors
            : settings.backgroundGradientColors,
        };
      }
      break;
    }

    case 'dispose': {
      stopLoop();
      rings = [];
      lastCreationTime = 0;
      canvas = null;
      context2d = null;
      break;
    }
  }
};
