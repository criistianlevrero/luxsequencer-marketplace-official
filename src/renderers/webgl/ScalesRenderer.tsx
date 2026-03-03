
import React, { useEffect, useRef } from 'react';
import { useTextureStore } from '../../../store';
import { getScalesCompatibleSettings } from '../../../utils/settingsMigration';
import { usePerformanceTimer } from '../../../hooks/usePerformanceMonitoring';
import type { GradientColor } from '../../../types';

type RGBColor = { r: number, g: number, b: number };

interface TextureCanvasProps {
  className?: string;
}

const hexToRgb = (hex: string): RGBColor | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255.0,
        g: parseInt(result[2], 16) / 255.0,
        b: parseInt(result[3], 16) / 255.0
    } : null;
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

  // ControlSettings uniforms
  uniform float u_scaleSize;
  uniform float u_scaleSpacing;
  uniform float u_verticalOverlap;
  uniform float u_horizontalOffset;
  uniform float u_shapeMorph;
  uniform float u_animationDirection;
  uniform float u_scaleBorderWidth;
  uniform vec3 u_scaleBorderColor;
  
  // Scale Gradient uniforms
  uniform vec3 u_gradientColors[10];
  uniform bool u_hardStops[10];
  uniform int u_gradientColorCount;
  uniform vec3 u_prevGradientColors[10];
  uniform bool u_prevHardStops[10];
  uniform int u_prevGradientColorCount;

  // Background Gradient uniforms
  uniform vec3 u_backgroundGradientColors[10];
  uniform bool u_backgroundHardStops[10];
  uniform int u_backgroundGradientColorCount;
  uniform vec3 u_prevBackgroundGradientColors[10];
  uniform bool u_prevBackgroundHardStops[10];
  uniform int u_prevBackgroundGradientColorCount;

  // Transition uniform
  uniform float u_transitionProgress;
  
  const float PI = 3.14159265359;
  const int MAX_GRADIENT_COLORS = 10;

  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }
  
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

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

  vec3 lerpColor(vec3 a, vec3 b, float t) {
      return a + (b - a) * t;
  }
  
  vec3 calculateColorFromGradient(
    float animationValue, 
    vec3 colors[MAX_GRADIENT_COLORS], 
    bool hardStops[MAX_GRADIENT_COLORS], 
    int colorCount
  ) {
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

    // --- Background Color ---
    vec2 st_bg = (st * 0.5) + 0.5; 
    float bgAnimationValue = u_time * 0.2 + st_bg.y * 360.0;
    vec3 backgroundColor = calculateColorFromGradient(bgAnimationValue, u_backgroundGradientColors, u_backgroundHardStops, u_backgroundGradientColorCount);

    if (u_transitionProgress < 1.0 && u_prevBackgroundGradientColorCount > 0) {
        vec3 prevBgColor = calculateColorFromGradient(bgAnimationValue, u_prevBackgroundGradientColors, u_prevBackgroundHardStops, u_prevBackgroundGradientColorCount);
        backgroundColor = lerpColor(prevBgColor, backgroundColor, u_transitionProgress);
    }
    
    // --- Scale Grid ---
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

    // --- Scale Color ---
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

    // --- Composition ---
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

const WebGlRenderer: React.FC<TextureCanvasProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformLocationsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  
  // Performance monitoring
  const { startTimer, endTimer } = usePerformanceTimer('webgl');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    const createShader = (type: number, source: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const createProgram = (vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
        const program = gl.createProgram();
        if (!program) return null;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(vertexShader, fragmentShader);
    if (!program) return;
    programRef.current = program;
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1, 1, 1, 1, -1, -1, 1, -1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const ulocs: Record<string, WebGLUniformLocation | null> = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      rotation: gl.getUniformLocation(program, "u_rotation"),
      scaleSize: gl.getUniformLocation(program, "u_scaleSize"),
      scaleSpacing: gl.getUniformLocation(program, "u_scaleSpacing"),
      verticalOverlap: gl.getUniformLocation(program, "u_verticalOverlap"),
      horizontalOffset: gl.getUniformLocation(program, "u_horizontalOffset"),
      shapeMorph: gl.getUniformLocation(program, "u_shapeMorph"),
      animationDirection: gl.getUniformLocation(program, "u_animationDirection"),
      scaleBorderWidth: gl.getUniformLocation(program, "u_scaleBorderWidth"),
      scaleBorderColor: gl.getUniformLocation(program, "u_scaleBorderColor"),
      gradientColorCount: gl.getUniformLocation(program, "u_gradientColorCount"),
      prevGradientColorCount: gl.getUniformLocation(program, "u_prevGradientColorCount"),
      backgroundGradientColorCount: gl.getUniformLocation(program, "u_backgroundGradientColorCount"),
      prevBackgroundGradientColorCount: gl.getUniformLocation(program, "u_prevBackgroundGradientColorCount"),
      transitionProgress: gl.getUniformLocation(program, "u_transitionProgress"),
    };
    for (let i = 0; i < 10; i++) {
        ulocs[`gradientColors[${i}]`] = gl.getUniformLocation(program, `u_gradientColors[${i}]`);
        ulocs[`hardStops[${i}]`] = gl.getUniformLocation(program, `u_hardStops[${i}]`);
        ulocs[`prevGradientColors[${i}]`] = gl.getUniformLocation(program, `u_prevGradientColors[${i}]`);
        ulocs[`prevHardStops[${i}]`] = gl.getUniformLocation(program, `u_prevHardStops[${i}]`);
        ulocs[`backgroundGradientColors[${i}]`] = gl.getUniformLocation(program, `u_backgroundGradientColors[${i}]`);
        ulocs[`backgroundHardStops[${i}]`] = gl.getUniformLocation(program, `u_backgroundHardStops[${i}]`);
        ulocs[`prevBackgroundGradientColors[${i}]`] = gl.getUniformLocation(program, `u_prevBackgroundGradientColors[${i}]`);
        ulocs[`prevBackgroundHardStops[${i}]`] = gl.getUniformLocation(program, `u_prevBackgroundHardStops[${i}]`);
    }
    uniformLocationsRef.current = ulocs;

    const animate = () => {
      const gl = glRef.current;
      const program = programRef.current;
      const ulocs = uniformLocationsRef.current;

      if (!gl || !program || !ulocs) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }
      
      // Start performance timer
      startTimer();
      
      const state = useTextureStore.getState();
      // Use compatibility adapter to get settings in expected format
      const currentSettings = getScalesCompatibleSettings(state.currentSettings);
      const { 
        textureRotation, 
        previousGradient,
        previousBackgroundGradient, 
        transitionProgress 
      } = state;

      timeRef.current += currentSettings.animationSpeed;

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      gl.uniform2f(ulocs.resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(ulocs.time, timeRef.current);
      gl.uniform1f(ulocs.rotation, textureRotation);
      gl.uniform1f(ulocs.scaleSize, currentSettings.scaleSize);
      gl.uniform1f(ulocs.scaleSpacing, currentSettings.scaleSpacing);
      gl.uniform1f(ulocs.verticalOverlap, currentSettings.verticalOverlap);
      gl.uniform1f(ulocs.horizontalOffset, currentSettings.horizontalOffset);
      gl.uniform1f(ulocs.shapeMorph, currentSettings.shapeMorph);
      gl.uniform1f(ulocs.animationDirection, currentSettings.animationDirection);
      gl.uniform1f(ulocs.scaleBorderWidth, currentSettings.scaleBorderWidth);
      const borderColorRgb = hexToRgb(currentSettings.scaleBorderColor);
      if (borderColorRgb) {
          gl.uniform3f(ulocs.scaleBorderColor, borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      }
      
      const setGradientUniforms = (
          colors: GradientColor[], 
          countLocation: WebGLUniformLocation | null,
          colorsLocation: string,
          hardStopsLocation: string
      ) => {
          const limitedColors = colors.slice(0, 10);
          gl.uniform1i(countLocation, limitedColors.length);
          limitedColors.forEach((c, i) => {
              const rgb = hexToRgb(c.color);
              if (rgb) gl.uniform3f(ulocs[`${colorsLocation}[${i}]`], rgb.r, rgb.g, rgb.b);
              gl.uniform1i(ulocs[`${hardStopsLocation}[${i}]`], c.hardStop ? 1 : 0);
          });
      };

      setGradientUniforms(currentSettings.gradientColors, ulocs.gradientColorCount, 'gradientColors', 'hardStops');
      setGradientUniforms(currentSettings.backgroundGradientColors || [], ulocs.backgroundGradientColorCount, 'backgroundGradientColors', 'backgroundHardStops');
      
      gl.uniform1f(ulocs.transitionProgress, transitionProgress);
      
      if (previousGradient) {
          setGradientUniforms(previousGradient, ulocs.prevGradientColorCount, 'prevGradientColors', 'prevHardStops');
      } else {
          gl.uniform1i(ulocs.prevGradientColorCount, 0);
      }

      if (previousBackgroundGradient) {
          setGradientUniforms(previousBackgroundGradient, ulocs.prevBackgroundGradientColorCount, 'prevBackgroundGradientColors', 'prevBackgroundHardStops');
      } else {
          gl.uniform1i(ulocs.prevBackgroundGradientColorCount, 0);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      // End performance timer
      endTimer();
      
      animationFrameId.current = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        if (width > 0 && height > 0) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }
      }
    });
    resizeObserver.observe(canvas);
    
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []); 

  return <canvas ref={canvasRef} className={className} />;
};

export default WebGlRenderer;
