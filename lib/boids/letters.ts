import * as THREE from "three";
import {
  BOID_GLYPH_OFFSET,
  LETTER_GLYPH_COUNT,
} from "./letterAtlas";
import { getGlyphSamples } from "./glyphSamples";

const MAX_PARTICLES = 8000;
const CELL_W = 44;
const LINE_H = 92;
const VERTICAL_OFFSET = 200;
const LETTER_SCALE_X = 44;
const LETTER_SCALE_Y = 62;
const PARTICLE_SIZE = 5;
const DOT_GLYPH = BOID_GLYPH_OFFSET + 7;

const FADE_IN_MS = 600;
const SHOW_MS = 800;
const SWEEP_MS = 2000;
const FADE_OUT_MS = 1100;
const RELEASE_JITTER_MS = 220;
const TOTAL_MS =
  FADE_IN_MS + SHOW_MS + SWEEP_MS + FADE_OUT_MS + RELEASE_JITTER_MS;

const IMPULSE_MIN = 1.4;
const IMPULSE_RANGE = 1.8;

export type LettersHandle = {
  points: THREE.Points;
  showText(text: string, nowMs: number): void;
  update(
    deltaSec: number,
    timeSec: number,
    baseWind: [number, number],
    nowMs: number,
  ): void;
  isBusy(nowMs: number): boolean;
  setBounds(w: number, h: number): void;
  setDpr(dpr: number): void;
  dispose(): void;
};

const vert = /* glsl */ `
  attribute float aGlyph;
  attribute float aAlpha;
  attribute float aSize;
  uniform vec2 uBounds;
  uniform float uDpr;
  varying float vGlyph;
  varying float vAlpha;

  void main() {
    vGlyph = aGlyph;
    vAlpha = aAlpha;
    vec2 clip = position.xy / uBounds * 2.0 - 1.0;
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = max(2.0, aSize * uDpr);
  }
`;

const frag = /* glsl */ `
  precision mediump float;
  uniform sampler2D uAtlas;
  uniform float uGlyphCount;
  uniform vec3 uBone;
  varying float vGlyph;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.01) discard;
    vec2 pc = gl_PointCoord;
    vec2 uv = vec2((vGlyph + pc.x) / uGlyphCount, pc.y);
    vec4 glyph = texture2D(uAtlas, uv);
    float alpha = glyph.a * vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(uBone, alpha);
  }
`;

export function createLetters(
  atlas: THREE.Texture,
  bounds: [number, number],
  dpr: number,
): LettersHandle {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const glyph = new Float32Array(MAX_PARTICLES);
  const alpha = new Float32Array(MAX_PARTICLES);
  const size = new Float32Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    size[i] = PARTICLE_SIZE;
    glyph[i] = DOT_GLYPH;
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  const glyphAttr = new THREE.BufferAttribute(glyph, 1);
  const alphaAttr = new THREE.BufferAttribute(alpha, 1);
  const sizeAttr = new THREE.BufferAttribute(size, 1);
  geom.setAttribute("position", posAttr);
  geom.setAttribute("aGlyph", glyphAttr);
  geom.setAttribute("aAlpha", alphaAttr);
  geom.setAttribute("aSize", sizeAttr);
  geom.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uAtlas: { value: atlas },
      uGlyphCount: { value: LETTER_GLYPH_COUNT },
      uBounds: { value: new THREE.Vector2(bounds[0], bounds[1]) },
      uDpr: { value: dpr },
      uBone: { value: new THREE.Color("#ffffff") },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;

  const anchorX = new Float32Array(MAX_PARTICLES);
  const anchorY = new Float32Array(MAX_PARTICLES);
  const posX = new Float32Array(MAX_PARTICLES);
  const posY = new Float32Array(MAX_PARTICLES);
  const velX = new Float32Array(MAX_PARTICLES);
  const velY = new Float32Array(MAX_PARTICLES);
  const spawnMs = new Float32Array(MAX_PARTICLES);
  const releaseMs = new Float32Array(MAX_PARTICLES);
  const fadeDur = new Float32Array(MAX_PARTICLES);
  const active = new Uint8Array(MAX_PARTICLES);
  const released = new Uint8Array(MAX_PARTICLES);
  let count = 0;
  let boundsX = bounds[0];
  let boundsY = bounds[1];

  function layout(text: string, w: number, h: number) {
    const maxLineWidth = Math.min(w * 0.9, 1600);
    const maxCols = Math.max(8, Math.floor(maxLineWidth / CELL_W));
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
      let w2 = word;
      while (w2.length > maxCols) {
        if (cur) {
          lines.push(cur);
          cur = "";
        }
        lines.push(w2.slice(0, maxCols));
        w2 = w2.slice(maxCols);
      }
      if (!cur) cur = w2;
      else if (cur.length + 1 + w2.length <= maxCols) cur += " " + w2;
      else {
        lines.push(cur);
        cur = w2;
      }
    }
    if (cur) lines.push(cur);

    const blockH = lines.length * LINE_H;
    const topY = h / 2 + blockH / 2 - LINE_H / 2 + VERTICAL_OFFSET;

    const placed: Array<{ x: number; y: number; ch: string }> = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineW = line.length * CELL_W;
      const leftX = w / 2 - lineW / 2 + CELL_W / 2;
      const y = topY - li * LINE_H;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (ch === " ") continue;
        placed.push({ x: leftX + ci * CELL_W, y, ch });
      }
    }
    return placed;
  }

  return {
    points,
    setBounds(w, h) {
      boundsX = w;
      boundsY = h;
      material.uniforms.uBounds.value.set(w, h);
    },
    setDpr(d) {
      material.uniforms.uDpr.value = d;
    },
    showText(text, nowMs) {
      const samples = getGlyphSamples();
      const placed = layout(text, boundsX, boundsY);
      let idx = 0;
      const startIdx = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let pi = 0; pi < placed.length && idx < MAX_PARTICLES; pi++) {
        const p = placed[pi];
        const code = p.ch.charCodeAt(0);
        const offsets = samples.get(code);
        if (!offsets || offsets.length === 0) continue;
        const n = offsets.length / 2;
        for (let si = 0; si < n && idx < MAX_PARTICLES; si++) {
          const dx = offsets[si * 2] * LETTER_SCALE_X;
          const dy = offsets[si * 2 + 1] * LETTER_SCALE_Y;
          const ax = p.x + dx;
          const ay = p.y + dy;
          if (ax < minX) minX = ax;
          if (ax > maxX) maxX = ax;
          anchorX[idx] = ax;
          anchorY[idx] = ay;
          posX[idx] = ax;
          posY[idx] = ay;
          velX[idx] = 0;
          velY[idx] = 0;
          spawnMs[idx] = nowMs;
          active[idx] = 1;
          released[idx] = 0;
          alpha[idx] = 0;
          size[idx] = PARTICLE_SIZE;
          glyph[idx] = DOT_GLYPH;
          positions[idx * 3] = ax;
          positions[idx * 3 + 1] = ay;
          positions[idx * 3 + 2] = 0;
          idx++;
        }
      }
      const xSpan = Math.max(1, maxX - minX);
      const disintegrateStart = nowMs + FADE_IN_MS + SHOW_MS;
      for (let i = startIdx; i < idx; i++) {
        const normX = (anchorX[i] - minX) / xSpan;
        const sweepDelay = (1 - normX) * SWEEP_MS;
        const jitter = (Math.random() - 0.5) * 2 * RELEASE_JITTER_MS;
        releaseMs[i] = disintegrateStart + sweepDelay + jitter;
        fadeDur[i] = FADE_OUT_MS * (0.85 + Math.random() * 0.3);
      }
      for (let i = idx; i < count; i++) {
        active[i] = 0;
        alpha[i] = 0;
      }
      count = Math.max(count, idx);
      geom.setDrawRange(0, count);
      posAttr.needsUpdate = true;
      glyphAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    },
    update(deltaSec, timeSec, baseWind, nowMs) {
      if (count === 0) return;
      const scaledDelta = deltaSec * 0.75;
      const baseScale = 0.5 * 40;
      const swirlScale = 14.0;
      const speedLimit = 6.0;
      const posScale = scaledDelta * 60;
      const bwx = baseWind[0];
      const bwy = baseWind[1];

      let dirty = false;

      for (let i = 0; i < count; i++) {
        if (!active[i]) continue;
        const age = nowMs - spawnMs[i];

        if (age < FADE_IN_MS) {
          alpha[i] = age / FADE_IN_MS;
          dirty = true;
          continue;
        }

        if (nowMs < releaseMs[i]) {
          if (alpha[i] !== 1) {
            alpha[i] = 1;
            dirty = true;
          }
          continue;
        }

        if (!released[i]) {
          const a = Math.random() * Math.PI * 2;
          const s = IMPULSE_MIN + Math.random() * IMPULSE_RANGE;
          velX[i] = Math.cos(a) * s;
          velY[i] = Math.sin(a) * s + 0.4;
          released[i] = 1;
        }

        const releasedAge = nowMs - releaseMs[i];
        const t = releasedAge / fadeDur[i];
        if (t >= 1) {
          if (alpha[i] !== 0) {
            alpha[i] = 0;
            active[i] = 0;
            dirty = true;
          }
          continue;
        }

        const x = posX[i];
        const y = posY[i];
        const sa = Math.sin(x * 0.009 + timeSec * 0.22) *
          Math.cos(y * 0.007 - timeSec * 0.16);
        const sb = Math.cos(x * 0.006 - timeSec * 0.2) *
          Math.sin(y * 0.01 + timeSec * 0.13);
        const sc = Math.sin((x + y) * 0.005 + timeSec * 0.09);
        const swirlX = sa + sc * 0.4;
        const swirlY = sb - sc * 0.4;

        const accX = bwx * baseScale + swirlX * swirlScale;
        const accY = bwy * baseScale + swirlY * swirlScale;

        let vx = velX[i] + accX * scaledDelta;
        let vy = velY[i] + accY * scaledDelta;
        const sp = Math.hypot(vx, vy);
        if (sp > speedLimit) {
          vx = (vx / sp) * speedLimit;
          vy = (vy / sp) * speedLimit;
        }
        velX[i] = vx;
        velY[i] = vy;
        posX[i] = x + vx * posScale;
        posY[i] = y + vy * posScale;
        positions[i * 3] = posX[i];
        positions[i * 3 + 1] = posY[i];
        alpha[i] = 1 - t;
        dirty = true;
      }

      if (dirty) {
        posAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
      }
    },
    isBusy(nowMs) {
      for (let i = 0; i < count; i++) {
        if (active[i] && nowMs - spawnMs[i] < TOTAL_MS) return true;
      }
      return false;
    },
    dispose() {
      geom.dispose();
      material.dispose();
    },
  };
}
