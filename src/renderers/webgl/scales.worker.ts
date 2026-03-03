type WorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'updateUniform'; name: string; value: unknown }
  | { type: 'dispose' };

type GradientStop = { color: string; hardStop?: boolean };

const WORKER_PROTOCOL_VERSION = '1.0.0';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

const vertexShaderSource = `
attribute vec4 a_position;
void main() {
  gl_Position = a_position;
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_rotation;
uniform float u_scaleSize;
uniform float u_scaleSpacing;
uniform float u_verticalOverlap;
uniform float u_horizontalOffset;
uniform float u_shapeMorph;
uniform float u_animationDirection;
uniform float u_scaleBorderWidth;
uniform vec3 u_scaleBorderColor;

uniform vec3 u_gradientColors[10];
uniform bool u_hardStops[10];
uniform int u_gradientColorCount;
uniform vec3 u_prevGradientColors[10];
uniform bool u_prevHardStops[10];
uniform int u_prevGradientColorCount;
uniform vec3 u_backgroundGradientColors[10];
uniform bool u_backgroundHardStops[10];
uniform int u_backgroundGradientColorCount;
uniform vec3 u_prevBackgroundGradientColors[10];
uniform bool u_prevBackgroundHardStops[10];
uniform int u_prevBackgroundGradientColorCount;
uniform float u_transitionProgress;

const float PI = 3.14159265359;
const int MAX_GRADIENT_COLORS = 10;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdDiamond(vec2 p, float r) {
  p = abs(p);
  return (p.x + p.y - r) * 0.70710678118;
}

float sdStar4(vec2 p, float r) {
  float r_in = r * 0.5;
  vec2 p_in_vtx = vec2(r_in * cos(PI/4.0), r_in * sin(PI/4.0));
  vec2 p_abs = abs(p);
  if (p_abs.y > p_abs.x) p_abs = p_abs.yx;
  vec2 p_out_vtx = vec2(r, 0.0);
  vec2 v = p_abs - p_in_vtx;
  vec2 e = p_out_vtx - p_in_vtx;
  float t = clamp(dot(v, e) / dot(e, e), 0.0, 1.0);
  float dist = length(v - e * t);
  float sign_val = e.x * v.y - e.y * v.x;
  return dist * sign(sign_val);
}

vec3 lerpColor(vec3 a, vec3 b, float t) { return a + (b - a) * t; }

vec3 calculateColorFromGradient(float animationValue, vec3 colors[MAX_GRADIENT_COLORS], bool hardStops[MAX_GRADIENT_COLORS], int colorCount) {
  if (colorCount < 1) return vec3(1.0);
  if (colorCount == 1) return colors[0];

  bool shouldLoop = !hardStops[0];
  float effectiveSegments = float(colorCount - 1);
  if (shouldLoop) effectiveSegments = float(colorCount);

  float normalizedValue = fract(animationValue / 360.0);
  if (normalizedValue < 0.0) normalizedValue += 1.0;

  float colorPosition = normalizedValue * effectiveSegments;
  float startIndex_f = floor(colorPosition);
  int startIndex = int(startIndex_f);
  float amount = colorPosition - startIndex_f;

  vec3 startColor = colors[0];
  vec3 endColor = colors[0];
  bool useHardStop = false;

  for (int i = 0; i < MAX_GRADIENT_COLORS; ++i) {
    if (i >= colorCount) break;
    if (i == startIndex) startColor = colors[i];

    int endIndex = startIndex + 1;
    if (shouldLoop) {
      endIndex = int(mod(float(startIndex + 1), float(colorCount)));
    } else {
      endIndex = int(min(float(startIndex + 1), float(colorCount - 1)));
    }

    if (i == endIndex) {
      endColor = colors[i];
      if (i > 0) useHardStop = hardStops[i];
    }
  }

  if (useHardStop) return startColor;
  return lerpColor(startColor, endColor, amount);
}

float is_odd(float val) {
  return abs(val - floor(val / 2.0) * 2.0) >= 0.5 ? 1.0 : 0.0;
}

void main() {
  vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  st = rotate2d(u_rotation * PI / 180.0) * st;

  vec2 st_bg = (st * 0.5) + 0.5;
  float bgAnimationValue = u_time * 0.2 + st_bg.y * 360.0;
  vec3 backgroundColor = calculateColorFromGradient(bgAnimationValue, u_backgroundGradientColors, u_backgroundHardStops, u_backgroundGradientColorCount);

  if (u_transitionProgress < 1.0 && u_prevBackgroundGradientColorCount > 0) {
    vec3 prevBgColor = calculateColorFromGradient(bgAnimationValue, u_prevBackgroundGradientColors, u_prevBackgroundHardStops, u_prevBackgroundGradientColorCount);
    backgroundColor = lerpColor(prevBgColor, backgroundColor, u_transitionProgress);
  }

  float radius = u_scaleSize / min(u_resolution.x, u_resolution.y);
  float horizontalStep = radius + (u_scaleSize * u_scaleSpacing / min(u_resolution.x, u_resolution.y));
  float verticalStep = radius + (u_scaleSize * u_verticalOverlap / min(u_resolution.x, u_resolution.y));

  if (horizontalStep <= 0.0 || verticalStep <= 0.0) {
    gl_FragColor = vec4(backgroundColor, 1.0);
    return;
  }

  vec2 simpleGridId = floor(st / vec2(horizontalStep, verticalStep));
  float winnerShapeDist = 1000.0;
  vec2 winnerGridId = vec2(0.0);
  vec3 winnerScore = vec3(-1.0, -1.0e9, -1.0e9);

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 offset = vec2(float(i), float(j));
      vec2 currentGridId = simpleGridId + offset;
      float staggerOffset = is_odd(currentGridId.y) * horizontalStep * u_horizontalOffset;
      vec2 cellCenter = vec2((currentGridId.x + 0.5) * horizontalStep + staggerOffset, (currentGridId.y + 0.5) * verticalStep);
      vec2 p = st - cellCenter;
      float circle = sdCircle(p, radius);
      float diamond = sdDiamond(p, radius);
      float star = sdStar4(p, radius);
      float currentShapeDist = (u_shapeMorph <= 0.5) ? mix(circle, diamond, u_shapeMorph * 2.0) : mix(diamond, star, (u_shapeMorph - 0.5) * 2.0);
      float is_inside = currentShapeDist <= 0.0 ? 1.0 : 0.0;
      vec3 currentScore = vec3(is_inside, currentGridId.y, currentGridId.x);

      if (currentScore.x > winnerScore.x || (currentScore.x == winnerScore.x && currentScore.y > winnerScore.y) || (currentScore.x == winnerScore.x && currentScore.y == winnerScore.y && currentScore.z > winnerScore.z)) {
        winnerScore = currentScore;
        winnerShapeDist = currentShapeDist;
        winnerGridId = currentGridId;
      }
    }
  }

  float shapeDist = winnerShapeDist;
  vec2 finalGridId = winnerGridId;

  float angleInRadians = u_animationDirection * (PI / 180.0);
  vec2 dir = vec2(cos(angleInRadians), sin(angleInRadians));
  float colorSpread = 15.0;
  float hueOffset = (finalGridId.x * dir.x + finalGridId.y * dir.y) * colorSpread;
  float animationValue = u_time + hueOffset;
  vec3 mainColor = calculateColorFromGradient(animationValue, u_gradientColors, u_hardStops, u_gradientColorCount);

  if (u_transitionProgress < 1.0 && u_prevGradientColorCount > 0) {
    vec3 prevColor = calculateColorFromGradient(animationValue, u_prevGradientColors, u_prevHardStops, u_prevGradientColorCount);
    mainColor = lerpColor(prevColor, mainColor, u_transitionProgress);
  }

  vec3 finalColor;
  float edgeSoftness = 1.0 / min(u_resolution.x, u_resolution.y);

  if (u_scaleBorderWidth < 0.01) {
    float fillAlpha = shapeDist <= 0.0 ? 1.0 : 0.0;
    finalColor = mix(backgroundColor, mainColor, fillAlpha);
  } else {
    float borderWidth_norm = u_scaleBorderWidth / min(u_resolution.x, u_resolution.y);
    float borderAlpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, shapeDist);
    float fillAlpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, shapeDist + borderWidth_norm);
    finalColor = mix(backgroundColor, u_scaleBorderColor, borderAlpha);
    finalColor = mix(finalColor, mainColor, fillAlpha);
  }

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

let canvas: OffscreenCanvas | null = null;
let gl: WebGLRenderingContext | null = null;
let frameTimer: ReturnType<typeof setInterval> | null = null;
let timeValue = 0;
let program: WebGLProgram | null = null;
let uniforms: Record<string, WebGLUniformLocation | null> = {};

type RuntimeUniforms = {
  animationSpeed: number;
  animationDirection: number;
  scaleSize: number;
  scaleSpacing: number;
  verticalOverlap: number;
  horizontalOffset: number;
  shapeMorph: number;
  textureRotation: number;
  scaleBorderWidth: number;
  scaleBorderColor: [number, number, number];
  gradientColors: GradientStop[];
  previousGradientColors: GradientStop[];
  backgroundGradientColors: GradientStop[];
  previousBackgroundGradientColors: GradientStop[];
  transitionProgress: number;
};

const runtimeUniforms: RuntimeUniforms = {
  animationSpeed: 1,
  animationDirection: 90,
  scaleSize: 150,
  scaleSpacing: 0,
  verticalOverlap: 0,
  horizontalOffset: 0.5,
  shapeMorph: 0,
  textureRotation: 0,
  scaleBorderWidth: 0,
  scaleBorderColor: [0, 0, 0],
  gradientColors: [
    { color: '#22d3ee', hardStop: false },
    { color: '#a855f7', hardStop: false },
  ],
  previousGradientColors: [],
  backgroundGradientColors: [
    { color: '#0f172a', hardStop: false },
    { color: '#111827', hardStop: false },
  ],
  previousBackgroundGradientColors: [],
  transitionProgress: 1,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [1, 1, 1];
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return [1, 1, 1];
  return [r, g, b];
};

const compileShader = (context: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = context.createShader(type);
  if (!shader) return null;
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    context.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (context: WebGLRenderingContext): WebGLProgram | null => {
  const vs = compileShader(context, context.VERTEX_SHADER, vertexShaderSource);
  const fs = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vs || !fs) return null;
  const p = context.createProgram();
  if (!p) return null;
  context.attachShader(p, vs);
  context.attachShader(p, fs);
  context.linkProgram(p);
  context.deleteShader(vs);
  context.deleteShader(fs);
  if (!context.getProgramParameter(p, context.LINK_STATUS)) {
    context.deleteProgram(p);
    return null;
  }
  return p;
};

const uploadGradient = (
  context: WebGLRenderingContext,
  stops: GradientStop[],
  colorPrefix: string,
  stopPrefix: string,
  countUniform: string,
) => {
  const colorCount = clamp(stops.length, 1, 10);
  context.uniform1i(uniforms[countUniform], colorCount);
  for (let index = 0; index < 10; index++) {
    const stop = stops[Math.min(index, colorCount - 1)] ?? stops[0];
    const [r, g, b] = hexToRgb(stop?.color ?? '#ffffff');
    context.uniform3f(uniforms[`${colorPrefix}[${index}]`], r, g, b);
    context.uniform1i(uniforms[`${stopPrefix}[${index}]`], stop?.hardStop ? 1 : 0);
  }
};

const drawScene = () => {
  if (!canvas || !gl || !program) return;

  timeValue += Math.max(0, runtimeUniforms.animationSpeed) * 1.2;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, timeValue);
  gl.uniform1f(uniforms.rotation, runtimeUniforms.textureRotation);
  gl.uniform1f(uniforms.scaleSize, runtimeUniforms.scaleSize);
  gl.uniform1f(uniforms.scaleSpacing, runtimeUniforms.scaleSpacing);
  gl.uniform1f(uniforms.verticalOverlap, runtimeUniforms.verticalOverlap);
  gl.uniform1f(uniforms.horizontalOffset, runtimeUniforms.horizontalOffset);
  gl.uniform1f(uniforms.shapeMorph, runtimeUniforms.shapeMorph);
  gl.uniform1f(uniforms.animationDirection, runtimeUniforms.animationDirection);
  gl.uniform1f(uniforms.scaleBorderWidth, runtimeUniforms.scaleBorderWidth);
  gl.uniform3f(uniforms.scaleBorderColor, runtimeUniforms.scaleBorderColor[0], runtimeUniforms.scaleBorderColor[1], runtimeUniforms.scaleBorderColor[2]);
  gl.uniform1f(uniforms.transitionProgress, runtimeUniforms.transitionProgress);

  uploadGradient(gl, runtimeUniforms.gradientColors, 'gradientColors', 'hardStops', 'gradientColorCount');
  uploadGradient(gl, runtimeUniforms.previousGradientColors, 'prevGradientColors', 'prevHardStops', 'prevGradientColorCount');
  uploadGradient(gl, runtimeUniforms.backgroundGradientColors, 'backgroundGradientColors', 'backgroundHardStops', 'backgroundGradientColorCount');
  uploadGradient(gl, runtimeUniforms.previousBackgroundGradientColors, 'prevBackgroundGradientColors', 'prevBackgroundHardStops', 'prevBackgroundGradientColorCount');

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const bitmap = canvas.transferToImageBitmap();
  workerScope.postMessage({ type: 'frame', bitmap }, [bitmap]);
};

const startLoop = () => {
  if (frameTimer) return;
  frameTimer = setInterval(drawScene, 16);
};

const stopLoop = () => {
  if (!frameTimer) return;
  clearInterval(frameTimer);
  frameTimer = null;
};

const normalizeGradient = (value: unknown): GradientStop[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((entry): entry is GradientStop => typeof entry === 'object' && entry !== null && typeof (entry as { color?: string }).color === 'string')
    .map((entry) => ({ color: entry.color, hardStop: Boolean(entry.hardStop) }));
  return normalized.slice(0, 10);
};

workerScope.onmessage = (event) => {
  const message = event.data;

  switch (message.type) {
    case 'init': {
      canvas = message.canvas;
      canvas.width = Math.max(1, Math.floor(message.width));
      canvas.height = Math.max(1, Math.floor(message.height));
      gl = canvas.getContext('webgl', { antialias: true, alpha: false });

      if (!gl) {
        workerScope.postMessage({ type: 'error', message: 'WebGL no disponible en worker scales' });
        return;
      }

      program = createProgram(gl);
      if (!program) {
        workerScope.postMessage({ type: 'error', message: 'No se pudo compilar shader scales worker' });
        return;
      }

      gl.useProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

      uniforms = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        rotation: gl.getUniformLocation(program, 'u_rotation'),
        scaleSize: gl.getUniformLocation(program, 'u_scaleSize'),
        scaleSpacing: gl.getUniformLocation(program, 'u_scaleSpacing'),
        verticalOverlap: gl.getUniformLocation(program, 'u_verticalOverlap'),
        horizontalOffset: gl.getUniformLocation(program, 'u_horizontalOffset'),
        shapeMorph: gl.getUniformLocation(program, 'u_shapeMorph'),
        animationDirection: gl.getUniformLocation(program, 'u_animationDirection'),
        scaleBorderWidth: gl.getUniformLocation(program, 'u_scaleBorderWidth'),
        scaleBorderColor: gl.getUniformLocation(program, 'u_scaleBorderColor'),
        gradientColorCount: gl.getUniformLocation(program, 'u_gradientColorCount'),
        prevGradientColorCount: gl.getUniformLocation(program, 'u_prevGradientColorCount'),
        backgroundGradientColorCount: gl.getUniformLocation(program, 'u_backgroundGradientColorCount'),
        prevBackgroundGradientColorCount: gl.getUniformLocation(program, 'u_prevBackgroundGradientColorCount'),
        transitionProgress: gl.getUniformLocation(program, 'u_transitionProgress'),
      };

      for (let index = 0; index < 10; index++) {
        uniforms[`gradientColors[${index}]`] = gl.getUniformLocation(program, `u_gradientColors[${index}]`);
        uniforms[`hardStops[${index}]`] = gl.getUniformLocation(program, `u_hardStops[${index}]`);
        uniforms[`prevGradientColors[${index}]`] = gl.getUniformLocation(program, `u_prevGradientColors[${index}]`);
        uniforms[`prevHardStops[${index}]`] = gl.getUniformLocation(program, `u_prevHardStops[${index}]`);
        uniforms[`backgroundGradientColors[${index}]`] = gl.getUniformLocation(program, `u_backgroundGradientColors[${index}]`);
        uniforms[`backgroundHardStops[${index}]`] = gl.getUniformLocation(program, `u_backgroundHardStops[${index}]`);
        uniforms[`prevBackgroundGradientColors[${index}]`] = gl.getUniformLocation(program, `u_prevBackgroundGradientColors[${index}]`);
        uniforms[`prevBackgroundHardStops[${index}]`] = gl.getUniformLocation(program, `u_prevBackgroundHardStops[${index}]`);
      }

      workerScope.postMessage({
        type: 'ready',
        rendererId: 'webgl',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        capabilities: ['offscreen-canvas', 'webgl2', 'uniform-updates'],
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
      if (name === 'animationSpeed') runtimeUniforms.animationSpeed = Number(value ?? 1);
      if (name === 'animationDirection') runtimeUniforms.animationDirection = Number(value ?? 90);
      if (name === 'scaleSize') runtimeUniforms.scaleSize = Number(value ?? 150);
      if (name === 'scaleSpacing') runtimeUniforms.scaleSpacing = Number(value ?? 0);
      if (name === 'verticalOverlap') runtimeUniforms.verticalOverlap = Number(value ?? 0);
      if (name === 'horizontalOffset') runtimeUniforms.horizontalOffset = Number(value ?? 0.5);
      if (name === 'shapeMorph') runtimeUniforms.shapeMorph = Number(value ?? 0);
      if (name === 'textureRotation') runtimeUniforms.textureRotation = Number(value ?? 0);
      if (name === 'scaleBorderWidth') runtimeUniforms.scaleBorderWidth = Number(value ?? 0);
      if (name === 'scaleBorderColor' && typeof value === 'string') runtimeUniforms.scaleBorderColor = hexToRgb(value);
      if (name === 'gradientColors') {
        const normalized = normalizeGradient(value);
        if (normalized.length > 0) runtimeUniforms.gradientColors = normalized;
      }
      if (name === 'previousGradientColors') {
        runtimeUniforms.previousGradientColors = normalizeGradient(value);
      }
      if (name === 'backgroundGradientColors') {
        const normalized = normalizeGradient(value);
        if (normalized.length > 0) runtimeUniforms.backgroundGradientColors = normalized;
      }
      if (name === 'previousBackgroundGradientColors') {
        runtimeUniforms.previousBackgroundGradientColors = normalizeGradient(value);
      }
      if (name === 'transitionProgress') {
        runtimeUniforms.transitionProgress = clamp(Number(value ?? 1), 0, 1);
      }
      break;
    }

    case 'dispose': {
      stopLoop();
      if (gl && program) {
        gl.deleteProgram(program);
      }
      canvas = null;
      gl = null;
      program = null;
      uniforms = {};
      break;
    }
  }
};
