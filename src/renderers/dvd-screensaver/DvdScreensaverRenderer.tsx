import React, { useEffect, useRef } from 'react';
import { useTextureStore } from '../../../store';
import { usePerformanceTimer } from '../../../hooks/usePerformanceMonitoring';
import { getNestedProperty, createDefaultRendererSettings } from '../../../utils/settingsMigration';
import type { DvdScreensaverSettings } from '../../../types';

type Vec2 = { x: number; y: number };

type RuntimeAsset = { id: string; position: Vec2; velocity: Vec2; rotation: number; width: number; height: number; opacity: number; texture: WebGLTexture | null; isActive: boolean; scale: number; rotationSpeed: number; rotationDirection: number; startTime: number; delayMs: number };
type TextureRecord = { texture: WebGLTexture; width: number; height: number; isReady: boolean };

const DEFAULT_SETTINGS = createDefaultRendererSettings('dvd-screensaver') as DvdScreensaverSettings;

const vertexShaderSource = `attribute vec2 a_position; attribute vec2 a_texCoord; uniform vec2 u_resolution; varying vec2 v_texCoord; void main() { vec2 zeroToOne = a_position / u_resolution; vec2 zeroToTwo = zeroToOne * 2.0; vec2 clipSpace = zeroToTwo - 1.0; gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0, 1); v_texCoord = a_texCoord; }`;
const fragmentShaderSource = `precision mediump float; uniform sampler2D u_texture; uniform float u_opacity; varying vec2 v_texCoord; void main() { vec4 color = texture2D(u_texture, v_texCoord); gl_FragColor = vec4(color.rgb, color.a * u_opacity); }`;

const hexToRgb = (hex: string) => { const n = hex.replace('#', '').trim(); return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255] as [number, number, number]; };
const createShader = (gl: WebGLRenderingContext, type: number, src: string) => { const s = gl.createShader(type); if (!s) return null; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
const createProgram = (gl: WebGLRenderingContext) => { const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource); const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource); if (!vs || !fs) return null; const p = gl.createProgram(); if (!p) return null; gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };

const createTextTexture = (gl: WebGLRenderingContext, text: string, size: number) => { const cv = document.createElement('canvas'); const ctx = cv.getContext('2d'); if (!ctx) return { texture: new WebGLTexture(), width: 0, height: 0, isReady: false }; ctx.font = `bold ${size}px Arial`; const m = ctx.measureText(text); const w = Math.ceil(m.width) + 20, h = size + 20; cv.width = w; cv.height = h; ctx.fillStyle = '#fff'; ctx.font = `bold ${size}px Arial`; ctx.textBaseline = 'middle'; ctx.fillText(text, 10, h / 2); const t = gl.createTexture(); if (!t) return { texture: new WebGLTexture(), width: w, height: h, isReady: false }; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return { texture: t, width: w, height: h, isReady: true }; };

const createSvgTexture = (gl: WebGLRenderingContext, src: string, max: number) => { const t = gl.createTexture(); if (!t) return { texture: new WebGLTexture(), width: 0, height: 0, isReady: false }; gl.bindTexture(gl.TEXTURE_2D, t); const px = new Uint8Array([255, 255, 255, 255]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); const rec = { texture: t, width: 1, height: 1, isReady: false }; const img = new Image(); img.crossOrigin = 'anonymous'; img.onload =() => { const cv = document.createElement('canvas'); const w = Math.min(img.width, max), h = Math.min(img.height, max); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); if (ctx) { ctx.drawImage(img, 0, 0, w, h); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); rec.width = w; rec.height = h; rec.isReady = true; } }; const trimmed = src.trim(); img.src = trimmed.startsWith('<') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}` : trimmed; return rec; };

const DVDScreensaverRenderer: React.FC<{ className?: string }> = ({ className }) => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const assetsRef = useRef<RuntimeAsset[]>([]);
  const cacheRef = useRef<Map<string, TextureRecord>>(new Map());
  const timeRef = useRef<number>(0);
  const hashRef = useRef<string>('');
  const { startTimer, endTimer } = usePerformanceTimer('dvd-screensaver');

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const gl = cv.getContext('webgl'); if (!gl) return;
    glRef.current = gl;

    const prog = createProgram(gl); if (!prog) return;
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    const texLoc = gl.getAttribLocation(prog, 'a_texCoord');
    const resLoc = gl.getUniformLocation(prog, 'u_resolution');
    const opacLoc = gl.getUniformLocation(prog, 'u_opacity');

    const posBuf = gl.createBuffer();
    const texBuf = gl.createBuffer();
    if (!posBuf || !texBuf) return;

    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const drawQuad = (a: RuntimeAsset, w: number, h: number) => {
      const hw = a.width / 2, hh = a.height / 2;
      const c = Math.cos(a.rotation), s = Math.sin(a.rotation);
      const pts = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: -hw, y: hh }, { x: -hw, y: hh }, { x: hw, y: -hh }, { x: hw, y: hh }];
      const pos = new Float32Array(pts.flatMap((p) => { const rx = p.x * c - p.y * s + a.position.x; const ry = p.x * s + p.y * c + a.position.y; return [rx, ry]; }));
      const txc = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
      gl.bufferData(gl.ARRAY_BUFFER, txc, gl.STATIC_DRAW);
      gl.uniform2f(resLoc, w, h);
      gl.uniform1f(opacLoc, a.opacity);
      if (a.texture) {
        gl.bindTexture(gl.TEXTURE_2D, a.texture);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const animate = (time: number) => {
      startTimer();
      const state = useTextureStore.getState();
      const sett = (getNestedProperty(state.currentSettings, 'renderer.dvd-screensaver') as DvdScreensaverSettings) || DEFAULT_SETTINGS;

      const cw = cv.clientWidth, ch = cv.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const dw = Math.max(1, Math.floor(cw * dpr)), dh = Math.max(1, Math.floor(ch * dpr));

      if (cv.width !== dw || cv.height !== dh) {
        cv.width = dw;
        cv.height = dh;
        gl.viewport(0, 0, dw, dh);
      }

      const [r, g, b] = hexToRgb(sett.background.color);
      gl.clearColor(r, g, b, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const hash = JSON.stringify(sett.assets.map((a) => [a.id, a.type, a.text, a.svg, a.scale, a.speed, a.direction, a.rotationSpeed, a.opacity]));
      if (!assetsRef.current.length || hash !== hashRef.current) {
        assetsRef.current = sett.assets.map((a, i) => {
          const txt = a.text ?? 'DVD', svg = a.svg ?? '';
          const isSvg = svg.trim().length > 0;
          const etype = a.type === 'svg' && isSvg ? 'svg' : 'text';
          const dtxt = etype === 'svg' && !isSvg ? 'SVG' : txt;
          const key = `${etype}:${dtxt}:${svg}`;
          let rec = cacheRef.current.get(key);
          if (!rec) {
            rec = etype === 'svg' ? createSvgTexture(gl, svg, 256) : createTextTexture(gl, dtxt, 64);
            cacheRef.current.set(key, rec);
          }
          const drad = (a.direction * Math.PI) / 180;
          return { id: a.id || `a${i}`, position: { x: dw / 2, y: dh / 2 }, velocity: { x: Math.cos(drad) * a.speed, y: Math.sin(drad) * a.speed }, rotation: 0, width: rec.width * a.scale, height: rec.height * a.scale, opacity: a.opacity, texture: rec.texture, isActive: a.delayMs <= 0, scale: a.scale, rotationSpeed: a.rotationSpeed, rotationDirection: a.rotationDirection, startTime: time, delayMs: a.delayMs };
        });
        hashRef.current = hash;
        assetsRef.current.forEach((a, i) => { a.position = { x: (dw * (i + 1)) / (assetsRef.current.length + 1), y: dh / 2 }; });
      }

      const dt = timeRef.current ? (time - timeRef.current) / 1000 : 0;
      timeRef.current = time;
      const gs = sett.globalSpeed, gr = sett.globalRotationSpeed;

      assetsRef.current.forEach((a) => {
        if (!a.isActive && time - a.startTime >= a.delayMs) a.isActive = true;
        if (!a.isActive) return;
        a.position.x += a.velocity.x * dt * gs;
        a.position.y += a.velocity.y * dt * gs;
        a.rotation += (a.rotationSpeed * a.rotationDirection * Math.PI / 180) * dt * gr;
        const hw = a.width / 2, hh = a.height / 2;
        if (a.position.x - hw <= 0 || a.position.x + hw >= dw) a.velocity.x *= -1;
        if (a.position.y - hh <= 0 || a.position.y + hh >= dh) a.velocity.y *= -1;
      });

      for (let i = 0; i < assetsRef.current.length - 1; i++) {
        const a1 = assetsRef.current[i];
        if (!a1.isActive) continue;
        for (let j = i + 1; j < assetsRef.current.length; j++) {
          const a2 = assetsRef.current[j];
          if (!a2.isActive) continue;
          if (Math.abs(a1.position.x - a2.position.x) < (a1.width + a2.width) / 2 && Math.abs(a1.position.y - a2.position.y) < (a1.height + a2.height) / 2) {
            a1.velocity.x *= -1;
            a2.velocity.x *= -1;
          }
        }
      }

      assetsRef.current.forEach((a) => {
        if (a.isActive && a.texture) drawQuad(a, dw, dh);
      });

      endTimer();
      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    const cache = cacheRef.current;
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      cache.forEach((r) => gl.deleteTexture(r.texture));
      cache.clear();
    };
  }, [startTimer, endTimer]);

  return <canvas ref={cvRef} className={className} />;
};

export default DVDScreensaverRenderer;
