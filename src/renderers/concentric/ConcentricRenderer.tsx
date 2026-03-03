import React, { useEffect, useRef } from 'react';
import { useTextureStore } from '../../../store';
import { getNestedProperty } from '../../../utils/settingsMigration';
import { vertexShader, fragmentShader, createShaderProgram, generatePolygonVertices } from './shaders';

// Ring configuration snapshot (captured at creation time)
interface RingSnapshot {
  creationTime: number;
  initialSize: number;
  sides: number;
  strokeWidth: number;
  fillMode: string;
  growthSpeed: number;
  rotationSpeed: number;
  gradientColors: { r: number; g: number; b: number }[];
}

// Instance data for GPU rendering
interface RingInstance {
  size: number;
  rotation: number;
  strokeWidth: number;
  color: { r: number; g: number; b: number };
}

const MAX_INSTANCES = 1000;

interface GeometryCacheEntry {
  fillVao: WebGLVertexArrayObject;
  fillVertexCount: number;
  strokeVao: WebGLVertexArrayObject;
  strokeVertexCount: number;
}

const ConcentricWebGLRenderer: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const geometryCacheRef = useRef<Map<number, GeometryCacheEntry>>(new Map());
  const fillInstanceBuffersRef = useRef<Map<number, { buffers: { size: WebGLBuffer; rotation: WebGLBuffer; strokeWidth: WebGLBuffer; color: WebGLBuffer }; count: number }>>(new Map());
  const strokeInstanceBuffersRef = useRef<Map<number, { buffers: { size: WebGLBuffer; rotation: WebGLBuffer; strokeWidth: WebGLBuffer; color: WebGLBuffer }; count: number }>>(new Map());
  const attribLocationsRef = useRef<{ size: number; rotation: number; strokeWidth: number; color: number; ringBand: number } | null>(null);
  const hexagonsRef = useRef<RingSnapshot[]>([]);
  const lastCreationTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    // Create shader program
    const program = createShaderProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      console.error('Failed to create shader program');
      return;
    }
    programRef.current = program;
    attribLocationsRef.current = {
      size: gl.getAttribLocation(program, 'instanceSize'),
      rotation: gl.getAttribLocation(program, 'instanceRotation'),
      strokeWidth: gl.getAttribLocation(program, 'instanceStrokeWidth'),
      color: gl.getAttribLocation(program, 'instanceColor')
      ,
      ringBand: gl.getAttribLocation(program, 'ringBand')
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(canvas.clientWidth * dpr);
      const displayHeight = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result 
        ? { 
            r: parseInt(result[1], 16) / 255, 
            g: parseInt(result[2], 16) / 255, 
            b: parseInt(result[3], 16) / 255 
          } 
        : null;
    };

    // Create static polygon geometry (shared vertex positions)
    const createPolygonGeometry = (sides: number, baseRadius: number) => {
      const vertices = generatePolygonVertices(sides, baseRadius);
      
      // Store only positions (no color or size - those come from instancing)
      const positions: number[] = [];
      vertices.forEach(v => {
        positions.push(v.x, v.y);
      });

      const vao = gl.createVertexArray();
      if (!vao) return null;
      gl.bindVertexArray(vao);

      const posVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

      // Position attribute
      const posAttr = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 8, 0);

      const ringBandAttr = gl.getAttribLocation(program, 'ringBand');
      gl.disableVertexAttribArray(ringBandAttr);
      gl.vertexAttrib1f(ringBandAttr, 0);

      gl.bindVertexArray(null);

      return { vao, vertexCount: vertices.length };
    };

    // Create outline geometry for stroke rendering (no center vertex)
    const createPolygonOutlineGeometry = (sides: number, baseRadius: number) => {
      const positions: number[] = [];
      const bands: number[] = [];
      const angleStep = (Math.PI * 2) / sides;
      const angleOffset = Math.PI / sides;

      for (let i = 0; i <= sides; i++) {
        const angle = angleStep * i + angleOffset;
        const x = baseRadius * Math.cos(angle);
        const y = baseRadius * Math.sin(angle);
        positions.push(x, y);
        bands.push(0);
        positions.push(x, y);
        bands.push(1);
      }

      const vao = gl.createVertexArray();
      if (!vao) return null;
      gl.bindVertexArray(vao);

      const posVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

      const posAttr = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 8, 0);

      const bandVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bandVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bands), gl.STATIC_DRAW);

      const ringBandAttr = gl.getAttribLocation(program, 'ringBand');
      gl.enableVertexAttribArray(ringBandAttr);
      gl.vertexAttribPointer(ringBandAttr, 1, gl.FLOAT, false, 4, 0);

      gl.bindVertexArray(null);

      return { vao, vertexCount: positions.length / 2 };
    };

    const getGeometryForSides = (sides: number) => {
      const cached = geometryCacheRef.current.get(sides);
      if (cached) return cached;

      const fillGeom = createPolygonGeometry(sides, 1);
      const strokeGeom = createPolygonOutlineGeometry(sides, 1);
      if (!fillGeom || !strokeGeom) return null;

      const entry: GeometryCacheEntry = {
        fillVao: fillGeom.vao,
        fillVertexCount: fillGeom.vertexCount,
        strokeVao: strokeGeom.vao,
        strokeVertexCount: strokeGeom.vertexCount
      };

      geometryCacheRef.current.set(sides, entry);
      return entry;
    };

    const updateInstanceBuffers = (
      gl: WebGL2RenderingContext,
      buffers: { size: WebGLBuffer; rotation: WebGLBuffer; strokeWidth: WebGLBuffer; color: WebGLBuffer },
      instances: RingInstance[]
    ) => {
      const sizes = new Float32Array(MAX_INSTANCES);
      const rotations = new Float32Array(MAX_INSTANCES);
      const strokeWidths = new Float32Array(MAX_INSTANCES);
      const colors = new Float32Array(MAX_INSTANCES * 3);

      instances.forEach((inst, i) => {
        sizes[i] = inst.size;
        rotations[i] = inst.rotation;
        strokeWidths[i] = inst.strokeWidth;
        colors[i * 3] = inst.color.r;
        colors[i * 3 + 1] = inst.color.g;
        colors[i * 3 + 2] = inst.color.b;
      });

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.size);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sizes.subarray(0, instances.length));

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.rotation);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, rotations.subarray(0, instances.length));

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.strokeWidth);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, strokeWidths.subarray(0, instances.length));

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors.subarray(0, instances.length * 3));
    };

    // Create instance buffers
    const createInstanceBuffers = (gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject, instances: RingInstance[]) => {
      gl.bindVertexArray(vao);

      const sizes = new Float32Array(MAX_INSTANCES);
      const rotations = new Float32Array(MAX_INSTANCES);
      const strokeWidths = new Float32Array(MAX_INSTANCES);
      const colors = new Float32Array(MAX_INSTANCES * 3);

      instances.forEach((inst, i) => {
        sizes[i] = inst.size;
        rotations[i] = inst.rotation;
        strokeWidths[i] = inst.strokeWidth;
        colors[i * 3] = inst.color.r;
        colors[i * 3 + 1] = inst.color.g;
        colors[i * 3 + 2] = inst.color.b;
      });

      const sizeBuf = gl.createBuffer();
      if (!sizeBuf) return null;
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
      const sizeAttr = gl.getAttribLocation(program, 'instanceSize');
      gl.enableVertexAttribArray(sizeAttr);
      gl.vertexAttribPointer(sizeAttr, 1, gl.FLOAT, false, 4, 0);
      gl.vertexAttribDivisor(sizeAttr, 1);

      const rotBuf = gl.createBuffer();
      if (!rotBuf) return null;
      gl.bindBuffer(gl.ARRAY_BUFFER, rotBuf);
      gl.bufferData(gl.ARRAY_BUFFER, rotations, gl.DYNAMIC_DRAW);
      const rotAttr = gl.getAttribLocation(program, 'instanceRotation');
      gl.enableVertexAttribArray(rotAttr);
      gl.vertexAttribPointer(rotAttr, 1, gl.FLOAT, false, 4, 0);
      gl.vertexAttribDivisor(rotAttr, 1);

      const strokeBuf = gl.createBuffer();
      if (!strokeBuf) return null;
      gl.bindBuffer(gl.ARRAY_BUFFER, strokeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, strokeWidths, gl.DYNAMIC_DRAW);
      const strokeAttr = gl.getAttribLocation(program, 'instanceStrokeWidth');
      gl.enableVertexAttribArray(strokeAttr);
      gl.vertexAttribPointer(strokeAttr, 1, gl.FLOAT, false, 4, 0);
      gl.vertexAttribDivisor(strokeAttr, 1);

      const colorBuf = gl.createBuffer();
      if (!colorBuf) return null;
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
      const colorAttr = gl.getAttribLocation(program, 'instanceColor');
      gl.enableVertexAttribArray(colorAttr);
      gl.vertexAttribPointer(colorAttr, 3, gl.FLOAT, false, 12, 0);
      gl.vertexAttribDivisor(colorAttr, 1);

      gl.bindVertexArray(null);

      return { size: sizeBuf, rotation: rotBuf, strokeWidth: strokeBuf, color: colorBuf };
    };

    const generateRingInstances = (time: number, rings: RingSnapshot[], maxDimension: number): RingInstance[] => {
      return rings.map(ring => {
        const age = time - ring.creationTime;
        const size = ring.initialSize + age * ring.growthSpeed * 0.1;
        const rotation = (age / 1000) * (ring.rotationSpeed * Math.PI / 180);
        
        // Calculate color based on ring's gradient
        const colorValue = (size / maxDimension) % 1.0;
        const color = calculateColorFromGradient(ring.gradientColors, colorValue);
        
        return { size, rotation, strokeWidth: ring.strokeWidth, color };
      });
    };

    const calculateColorFromGradient = (
      gradient: { r: number; g: number; b: number }[],
      animationValue: number
    ): { r: number; g: number; b: number } => {
      if (gradient.length === 0) return { r: 1, g: 1, b: 1 };
      if (gradient.length === 1) return gradient[0];
      
      const effectiveGradient = [...gradient, gradient[0]];
      const numSegments = effectiveGradient.length - 1;
      
      const normalizedValue = (animationValue < 0 ? animationValue % 1 + 1 : animationValue % 1);
      const colorPosition = normalizedValue * numSegments;
      const startIndex = Math.floor(colorPosition);
      const endIndex = Math.min(startIndex + 1, effectiveGradient.length - 1);
      const amount = colorPosition - startIndex;
      
      return lerpColor(effectiveGradient[startIndex], effectiveGradient[endIndex], amount);
    };

    const lerpColor = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => {
      return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t
      };
    };

    const render = (time: number) => {
      resizeCanvas();

      // Get all settings from store
      const state = useTextureStore.getState();
      const backgroundGradientColors = 
        (getNestedProperty(state.currentSettings, 'common.backgroundGradientColors') as any[]) ?? [];
      const repetitionSpeed = (getNestedProperty(state.currentSettings, 'renderer.concentric.repetitionSpeed') as number) ?? 0.5;
      const growthSpeed = (getNestedProperty(state.currentSettings, 'renderer.concentric.growthSpeed') as number) ?? 0.5;
      const initialSize = (getNestedProperty(state.currentSettings, 'renderer.concentric.initialSize') as number) ?? 10;
      const gradientColors = (getNestedProperty(state.currentSettings, 'renderer.concentric.gradientColors') as any[]) ?? [];
      const sidesValue = (getNestedProperty(state.currentSettings, 'renderer.concentric.sides') as number) ?? 6;
      const sides = Math.max(3, Math.min(12, Math.round(sidesValue)));
      const rotationSpeed = (getNestedProperty(state.currentSettings, 'renderer.concentric.rotationSpeed') as number) ?? 0;
      const strokeWidthValue = (getNestedProperty(state.currentSettings, 'renderer.concentric.strokeWidth') as number) ?? 2;
      const strokeWidth = Math.max(0.5, Math.min(10, strokeWidthValue));
      const fillMode = (getNestedProperty(state.currentSettings, 'renderer.concentric.fillMode') as string) ?? 'stroke';

      // Calculate display dimensions
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const maxDimension = Math.max(displayWidth, displayHeight);
      const diagonal = Math.sqrt(displayWidth * displayWidth + displayHeight * displayHeight);

      // Set background color
      if (backgroundGradientColors.length > 0) {
        const bgColor = hexToRgb(backgroundGradientColors[0].color);
        if (bgColor) {
          gl.clearColor(bgColor.r, bgColor.g, bgColor.b, 1.0);
        } else {
          gl.clearColor(0.12, 0.16, 0.22, 1.0);
        }
      } else {
        gl.clearColor(0.12, 0.16, 0.22, 1.0);
      }

      gl.clear(gl.COLOR_BUFFER_BIT);

      // Use program
      gl.useProgram(program);

      // Set projection matrix (orthographic)
      const aspect = canvas.width / canvas.height;
      const left = -aspect * 200;
      const right = aspect * 200;
      const bottom = -200;
      const top = 200;

      const proj = orthographic(left, right, bottom, top, -1, 1);
      const projLoc = gl.getUniformLocation(program, 'projection');
      gl.uniformMatrix4fv(projLoc, false, proj);

      // Add new ring if needed (capture current configuration snapshot)
      if ((time - lastCreationTimeRef.current) > (repetitionSpeed * 1000)) {
        const rgbGradient = gradientColors.map((c: any) => ({
          r: hexToRgb(c.color)?.r ?? 1,
          g: hexToRgb(c.color)?.g ?? 1,
          b: hexToRgb(c.color)?.b ?? 1
        }));

        const ringSnapshot: RingSnapshot = {
          creationTime: time,
          initialSize: initialSize,
          sides: sides,
          strokeWidth: strokeWidth,
          fillMode: fillMode,
          growthSpeed: growthSpeed,
          rotationSpeed: rotationSpeed,
          gradientColors: rgbGradient
        };
        hexagonsRef.current.push(ringSnapshot);
        lastCreationTimeRef.current = time;
      }

      const fillRings = hexagonsRef.current.filter(ring => ring.fillMode === 'fill' || ring.fillMode === 'both');
      const strokeRings = hexagonsRef.current.filter(ring => ring.fillMode === 'stroke' || ring.fillMode === 'both');

      const fillGroups = new Map<number, RingSnapshot[]>();
      fillRings.forEach(ring => {
        const group = fillGroups.get(ring.sides) ?? [];
        group.push(ring);
        fillGroups.set(ring.sides, group);
      });

      // Remove rings that exceed bounds
      hexagonsRef.current = hexagonsRef.current.filter(ring => {
        const age = time - ring.creationTime;
        const currentSize = ring.initialSize + age * ring.growthSpeed * 0.1;
        return currentSize < diagonal / 2;
      });

      // Render fills grouped by sides
      fillGroups.forEach((rings, ringSides) => {
        const geometry = getGeometryForSides(ringSides);
        if (!geometry) return;

        const instances = generateRingInstances(time, rings, maxDimension);
        const limitedInstances = instances.slice(0, MAX_INSTANCES);
        if (limitedInstances.length === 0) return;

        const bufferEntry = fillInstanceBuffersRef.current.get(ringSides);
        if (!bufferEntry) {
          const buffers = createInstanceBuffers(gl, geometry.fillVao, limitedInstances);
          if (!buffers) return;
          fillInstanceBuffersRef.current.set(ringSides, { buffers, count: limitedInstances.length });
        } else {
          bufferEntry.count = limitedInstances.length;
          updateInstanceBuffers(gl, bufferEntry.buffers, limitedInstances);
        }

        const currentBuffers = fillInstanceBuffersRef.current.get(ringSides);
        if (!currentBuffers) return;

        gl.bindVertexArray(geometry.fillVao);
        gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, geometry.fillVertexCount, currentBuffers.count);
      });

      // Render strokes per ring (line width varies per ring)
      if (strokeRings.length > 0) {
        const strokeGroups = new Map<number, RingSnapshot[]>();
        strokeRings.forEach(ring => {
          const group = strokeGroups.get(ring.sides) ?? [];
          group.push(ring);
          strokeGroups.set(ring.sides, group);
        });

        strokeGroups.forEach((rings, ringSides) => {
          const geometry = getGeometryForSides(ringSides);
          if (!geometry) return;

          const instances = generateRingInstances(time, rings, maxDimension);
          const limitedInstances = instances.slice(0, MAX_INSTANCES);
          if (limitedInstances.length === 0) return;

          const bufferEntry = strokeInstanceBuffersRef.current.get(ringSides);
          if (!bufferEntry) {
            const buffers = createInstanceBuffers(gl, geometry.strokeVao, limitedInstances);
            if (!buffers) return;
            strokeInstanceBuffersRef.current.set(ringSides, { buffers, count: limitedInstances.length });
          } else {
            bufferEntry.count = limitedInstances.length;
            updateInstanceBuffers(gl, bufferEntry.buffers, limitedInstances);
          }

          const currentBuffers = strokeInstanceBuffersRef.current.get(ringSides);
          if (!currentBuffers) return;

          gl.bindVertexArray(geometry.strokeVao);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, geometry.strokeVertexCount, currentBuffers.count);
        });

        gl.bindVertexArray(null);
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
};

// Matrix utilities
function orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
  const result = new Float32Array(16);
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  result[0] = -2 * lr;
  result[5] = -2 * bt;
  result[10] = 2 * nf;
  result[12] = (left + right) * lr;
  result[13] = (top + bottom) * bt;
  result[14] = (far + near) * nf;
  result[15] = 1;

  return result;
}

export default ConcentricWebGLRenderer;
