type WorkerMessage =
  | {
      type: 'init';
      canvas: OffscreenCanvas;
      width: number;
      height: number;
    }
  | {
      type: 'resize';
      width: number;
      height: number;
    }
  | {
      type: 'updateUniform';
      name: string;
      value: unknown;
    }
  | {
      type: 'dispose';
    };

type DvdUniformSettings = {
  assets?: Array<{
    id: string;
    type: 'text' | 'svg';
    text?: string;
    svg?: string;
    delayMs: number;
    speed: number;
    rotationSpeed: number;
    rotationDirection: 1 | -1;
    direction: number;
    scale: number;
    opacity: number;
  }>;
  background?: {
    color?: string;
  };
  globalSpeed?: number;
  globalRotationSpeed?: number;
};

type RuntimeAsset = {
  id: string;
  type: 'text' | 'svg';
  svgSource: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  rotationDirection: 1 | -1;
  opacity: number;
  scale: number;
  width: number;
  height: number;
  startMs: number;
  delayMs: number;
  active: boolean;
  bitmap: ImageBitmap | null;
};

const WORKER_PROTOCOL_VERSION = '1.0.0';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let canvas: OffscreenCanvas | null = null;
let context2d: OffscreenCanvasRenderingContext2D | null = null;
let frameTimer: ReturnType<typeof setInterval> | null = null;
let timeSeconds = 0;
let dvdSettings: DvdUniformSettings = {
  assets: [
    {
      id: 'asset-1',
      type: 'text',
      text: 'DVD',
      delayMs: 0,
      speed: 120,
      rotationSpeed: 20,
      rotationDirection: 1,
      direction: 45,
      scale: 1,
      opacity: 1,
    },
  ],
  background: { color: '#0b0b0b' },
  globalSpeed: 1,
  globalRotationSpeed: 1,
};
let runtimeAssets: RuntimeAsset[] = [];
let settingsHash = '';
let assetsGeneration = 0;

const bitmapCache = new Map<string, ImageBitmap>();
const pendingBitmapLoads = new Map<string, Promise<ImageBitmap | null>>();
const bitmapCacheOrder: string[] = [];
const MAX_BITMAP_CACHE_SIZE = 32;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    return { r: 0.05, g: 0.05, b: 0.05 };
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return { r: 0.05, g: 0.05, b: 0.05 };
  }

  return { r, g, b };
};

const ensureViewport = () => {
  if (!canvas || !context2d) {
    return;
  }

  context2d.setTransform(1, 0, 0, 1, 0, 0);
};

const resolveSvgBitmap = async (svgSource: string): Promise<ImageBitmap | null> => {
  const trimmed = svgSource.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith('<')) {
      const blob = new Blob([trimmed], { type: 'image/svg+xml;charset=utf-8' });
      return await createImageBitmap(blob);
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
};

const touchBitmapCacheKey = (key: string) => {
  const existingIndex = bitmapCacheOrder.indexOf(key);
  if (existingIndex !== -1) {
    bitmapCacheOrder.splice(existingIndex, 1);
  }
  bitmapCacheOrder.push(key);
};

const ensureBitmapCacheLimit = () => {
  while (bitmapCacheOrder.length > MAX_BITMAP_CACHE_SIZE) {
    const keyToEvict = bitmapCacheOrder.shift();
    if (!keyToEvict) {
      break;
    }
    const cached = bitmapCache.get(keyToEvict);
    cached?.close();
    bitmapCache.delete(keyToEvict);
  }
};

const getOrLoadSvgBitmap = async (cacheKey: string, source: string): Promise<ImageBitmap | null> => {
  const cached = bitmapCache.get(cacheKey);
  if (cached) {
    touchBitmapCacheKey(cacheKey);
    return cached;
  }

  const pending = pendingBitmapLoads.get(cacheKey);
  if (pending) {
    return pending;
  }

  const loadPromise = resolveSvgBitmap(source)
    .then((bitmap) => {
      if (bitmap) {
        bitmapCache.set(cacheKey, bitmap);
        touchBitmapCacheKey(cacheKey);
        ensureBitmapCacheLimit();
      }
      return bitmap;
    })
    .finally(() => {
      pendingBitmapLoads.delete(cacheKey);
    });

  pendingBitmapLoads.set(cacheKey, loadPromise);
  return loadPromise;
};

const clearBitmapCache = () => {
  for (const bitmap of bitmapCache.values()) {
    bitmap.close();
  }
  bitmapCache.clear();
  pendingBitmapLoads.clear();
  bitmapCacheOrder.length = 0;
};

const releaseRuntimeAssets = () => {
  runtimeAssets = [];
};

const createRuntimeAssets = (timestampMs: number) => {
  if (!canvas || !context2d) {
    releaseRuntimeAssets();
    return;
  }

  const assets = dvdSettings.assets ?? [];
  const width = canvas.width;
  const height = canvas.height;

  releaseRuntimeAssets();

  assetsGeneration += 1;
  const generation = assetsGeneration;

  runtimeAssets = assets.map((asset, index) => {
    const scale = Math.max(0.4, asset.scale || 1);
    const label = asset.type === 'svg' ? 'SVG' : (asset.text?.trim() || 'DVD');
    const svgSource = asset.svg?.trim() || '';

    context2d.font = `bold ${Math.floor(28 * scale)}px Arial`;
    const labelWidth = context2d.measureText(label).width;
    const boxWidth = Math.max(72, labelWidth + 24);
    const boxHeight = Math.max(36, 32 * scale + 16);

    const directionRad = (asset.direction * Math.PI) / 180;
    const speed = Math.max(20, asset.speed || 120);
    const total = Math.max(1, assets.length);

    return {
      id: asset.id || `dvd-${index}`,
      type: asset.type,
      svgSource,
      label,
      x: ((index + 1) * width) / (total + 1),
      y: height / 2,
      vx: Math.cos(directionRad) * speed,
      vy: Math.sin(directionRad) * speed,
      rotation: 0,
      rotationSpeed: asset.rotationSpeed || 0,
      rotationDirection: asset.rotationDirection || 1,
      opacity: clamp01(asset.opacity ?? 1),
      scale,
      width: boxWidth,
      height: boxHeight,
      startMs: timestampMs,
      delayMs: Math.max(0, asset.delayMs || 0),
      active: (asset.delayMs || 0) <= 0,
      bitmap: null,
    };
  });

  for (let index = 0; index < runtimeAssets.length; index++) {
    const config = assets[index];
    const runtimeAsset = runtimeAssets[index];
    if (!config || !runtimeAsset || config.type !== 'svg') {
      continue;
    }

    const svgSource = (config.svg ?? '').trim();
    const cacheKey = svgSource;
    const svgBitmapPromise = getOrLoadSvgBitmap(cacheKey, svgSource);
    void svgBitmapPromise.then((bitmap) => {
      if (!bitmap) {
        return;
      }

      if (generation !== assetsGeneration) {
        return;
      }

      const latest = runtimeAssets.find((asset) => asset.id === runtimeAsset.id);
      if (!latest) {
        return;
      }

      latest.bitmap = bitmap;
      latest.width = Math.max(24, bitmap.width * latest.scale);
      latest.height = Math.max(24, bitmap.height * latest.scale);
      latest.label = '';
    });
  }
};

const drawAsset = (asset: RuntimeAsset) => {
  if (!context2d) {
    return;
  }

  context2d.save();
  context2d.translate(asset.x, asset.y);
  context2d.rotate(asset.rotation);
  context2d.globalAlpha = asset.opacity;

  const halfW = asset.width / 2;
  const halfH = asset.height / 2;

  if (asset.bitmap) {
    context2d.shadowColor = 'rgba(255,255,255,0.25)';
    context2d.shadowBlur = 6 * asset.scale;
    context2d.drawImage(asset.bitmap, -halfW, -halfH, asset.width, asset.height);
  } else {
    context2d.fillStyle = 'rgba(255, 255, 255, 0.05)';
    context2d.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    context2d.lineWidth = Math.max(1, 1.4 * asset.scale);
    context2d.beginPath();
    context2d.roundRect(-halfW, -halfH, asset.width, asset.height, Math.max(4, 6 * asset.scale));
    context2d.fill();
    context2d.stroke();

    context2d.shadowColor = 'rgba(255,255,255,0.35)';
    context2d.shadowBlur = 8 * asset.scale;
    context2d.fillStyle = '#ffffff';
    context2d.font = `bold ${Math.floor(22 * asset.scale)}px Arial`;
    context2d.textAlign = 'center';
    context2d.textBaseline = 'middle';
    context2d.fillText(asset.label || 'DVD', 0, 0);
  }

  context2d.restore();
};

const drawScene = () => {
  if (!canvas || !context2d) {
    return;
  }

  const timestampMs = performance.now();
  const width = canvas.width;
  const height = canvas.height;

  const newHash = JSON.stringify({
    assets: dvdSettings.assets,
    background: dvdSettings.background,
    globalSpeed: dvdSettings.globalSpeed,
    globalRotationSpeed: dvdSettings.globalRotationSpeed,
  });

  if (newHash !== settingsHash) {
    settingsHash = newHash;
    createRuntimeAssets(timestampMs);
  }

  const base = hexToRgb(dvdSettings.background?.color ?? '#0b0b0b');
  const speed = Math.max(0, Number(dvdSettings.globalSpeed ?? 1));
  const rotationSpeed = Math.max(0, Number(dvdSettings.globalRotationSpeed ?? 1));
  const animationFactor = speed * 0.6 + rotationSpeed * 0.4;

  timeSeconds += 0.016 * Math.max(0.1, animationFactor);

  context2d.fillStyle = `rgb(${Math.floor(clamp01(base.r) * 255)}, ${Math.floor(clamp01(base.g) * 255)}, ${Math.floor(clamp01(base.b) * 255)})`;
  context2d.fillRect(0, 0, width, height);

  const dt = 0.016 * Math.max(0.1, speed);
  const rotationScale = Math.max(0.1, rotationSpeed);

  for (const asset of runtimeAssets) {
    if (!asset.active && timestampMs - asset.startMs >= asset.delayMs) {
      asset.active = true;
    }
    if (!asset.active) {
      continue;
    }

    asset.x += asset.vx * dt;
    asset.y += asset.vy * dt;
    asset.rotation += ((asset.rotationSpeed * asset.rotationDirection * Math.PI) / 180) * dt * rotationScale;

    const halfW = asset.width / 2;
    const halfH = asset.height / 2;

    if (asset.x - halfW <= 0 || asset.x + halfW >= width) {
      asset.vx *= -1;
      asset.x = Math.max(halfW, Math.min(width - halfW, asset.x));
    }

    if (asset.y - halfH <= 0 || asset.y + halfH >= height) {
      asset.vy *= -1;
      asset.y = Math.max(halfH, Math.min(height - halfH, asset.y));
    }

    drawAsset(asset);
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
          message: 'Canvas2D no disponible en worker para dvd-screensaver',
        });
        return;
      }

      ensureViewport();
      settingsHash = '';
      workerScope.postMessage({
        type: 'ready',
        rendererId: 'dvd-screensaver',
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
      ensureViewport();
      break;
    }

    case 'updateUniform': {
      if (message.name === 'dvdSettings' && typeof message.value === 'object' && message.value !== null) {
        dvdSettings = message.value as DvdUniformSettings;
      }
      break;
    }

    case 'dispose': {
      stopLoop();
      canvas = null;
      context2d = null;
      releaseRuntimeAssets();
      clearBitmapCache();
      settingsHash = '';
      assetsGeneration = 0;
      dvdSettings = {
        assets: [
          {
            id: 'asset-1',
            type: 'text',
            text: 'DVD',
            delayMs: 0,
            speed: 120,
            rotationSpeed: 20,
            rotationDirection: 1,
            direction: 45,
            scale: 1,
            opacity: 1,
          },
        ],
        background: { color: '#0b0b0b' },
        globalSpeed: 1,
        globalRotationSpeed: 1,
      };
      break;
    }
  }
};
