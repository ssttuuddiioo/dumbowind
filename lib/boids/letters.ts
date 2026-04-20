import * as THREE from "three";
import {
  BOID_GLYPH_OFFSET,
  LETTER_GLYPH_COUNT,
} from "./letterAtlas";
import { getGlyphSamples } from "./glyphSamples";
import { layoutTyping } from "./textLayout";

const MAX_PARTICLES = 8000;
const LETTER_SCALE_X = 44;
const LETTER_SCALE_Y = 62;
const PARTICLE_SIZE = 5;
const DOT_GLYPH = BOID_GLYPH_OFFSET + 7;

const TYPE_FADE_IN_MS = 180;
const SWEEP_MS = 2000;
const FADE_OUT_MS = 1100;
const RELEASE_JITTER_MS = 220;
const RELEASE_TOTAL_MS = SWEEP_MS + FADE_OUT_MS + RELEASE_JITTER_MS;

const IMPULSE_MIN = 1.4;
const IMPULSE_RANGE = 1.8;

const RELEASE_PENDING = Number.POSITIVE_INFINITY;

type TypingEntry = {
  charIdx: number;
  ch: string;
  x: number;
  y: number;
  slotStart: number;
  slotCount: number;
};

export type LettersHandle = {
  points: THREE.Points;
  setTypingText(text: string, nowMs: number): { x: number; y: number };
  release(nowMs: number): void;
  update(
    deltaSec: number,
    timeSec: number,
    baseWind: [number, number],
    nowMs: number,
  ): void;
  isBusy(nowMs: number): boolean;
  setBounds(w: number, h: number): void;
  setDpr(dpr: number): void;
  getCursor(): { x: number; y: number };
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
  for (let i = 0; i < MAX_PARTICLES; i++) releaseMs[i] = RELEASE_PENDING;

  let drawCount = 0;
  let boundsX = bounds[0];
  let boundsY = bounds[1];

  let typingEntries: TypingEntry[] = [];
  let releasing = false;
  let cursor = { x: boundsX / 2, y: boundsY / 2 };

  function spawnEntry(
    ch: string,
    x: number,
    y: number,
    charIdx: number,
    nowMs: number,
  ): TypingEntry | null {
    const samples = getGlyphSamples();
    const offsets = samples.get(ch.charCodeAt(0));
    if (!offsets || offsets.length === 0) return null;
    const nPts = offsets.length / 2;

    let start = -1;
    let need = nPts;
    let run = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!active[i]) {
        if (run === 0) start = i;
        run++;
        if (run === need) break;
      } else {
        run = 0;
        start = -1;
      }
    }
    if (run !== need || start < 0) return null;

    for (let si = 0; si < nPts; si++) {
      const slot = start + si;
      const dx = offsets[si * 2] * LETTER_SCALE_X;
      const dy = offsets[si * 2 + 1] * LETTER_SCALE_Y;
      anchorX[slot] = x + dx;
      anchorY[slot] = y + dy;
      posX[slot] = anchorX[slot];
      posY[slot] = anchorY[slot];
      velX[slot] = 0;
      velY[slot] = 0;
      spawnMs[slot] = nowMs;
      releaseMs[slot] = RELEASE_PENDING;
      fadeDur[slot] = FADE_OUT_MS;
      active[slot] = 1;
      released[slot] = 0;
      alpha[slot] = 0;
      size[slot] = PARTICLE_SIZE;
      glyph[slot] = DOT_GLYPH;
      positions[slot * 3] = anchorX[slot];
      positions[slot * 3 + 1] = anchorY[slot];
      positions[slot * 3 + 2] = 0;
    }
    if (start + nPts > drawCount) drawCount = start + nPts;
    return { charIdx, ch, x, y, slotStart: start, slotCount: nPts };
  }

  function deactivateEntry(entry: TypingEntry) {
    for (let s = entry.slotStart; s < entry.slotStart + entry.slotCount; s++) {
      active[s] = 0;
      alpha[s] = 0;
    }
  }

  function shiftEntry(entry: TypingEntry, nx: number, ny: number) {
    const dx = nx - entry.x;
    const dy = ny - entry.y;
    if (dx === 0 && dy === 0) return;
    for (let s = entry.slotStart; s < entry.slotStart + entry.slotCount; s++) {
      anchorX[s] += dx;
      anchorY[s] += dy;
      posX[s] += dx;
      posY[s] += dy;
      positions[s * 3] = posX[s];
      positions[s * 3 + 1] = posY[s];
    }
    entry.x = nx;
    entry.y = ny;
  }

  function markAttrsDirty() {
    geom.setDrawRange(0, drawCount);
    posAttr.needsUpdate = true;
    glyphAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
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
    getCursor() {
      return { x: cursor.x, y: cursor.y };
    },
    setTypingText(text, nowMs) {
      if (releasing) {
        const result = layoutTyping(text, boundsX, boundsY);
        cursor = result.cursor;
        return cursor;
      }

      const result = layoutTyping(text, boundsX, boundsY);
      cursor = result.cursor;
      const placed = result.placed;

      const newEntries: TypingEntry[] = [];
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        const existing = typingEntries[i];
        if (existing && existing.charIdx === p.charIdx && existing.ch === p.ch) {
          shiftEntry(existing, p.x, p.y);
          newEntries.push(existing);
        } else {
          if (existing) deactivateEntry(existing);
          const fresh = spawnEntry(p.ch, p.x, p.y, p.charIdx, nowMs);
          if (fresh) newEntries.push(fresh);
        }
      }
      for (let i = placed.length; i < typingEntries.length; i++) {
        deactivateEntry(typingEntries[i]);
      }
      typingEntries = newEntries;

      markAttrsDirty();
      return cursor;
    },
    release(nowMs) {
      if (releasing) return;
      releasing = true;

      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < drawCount; i++) {
        if (!active[i]) continue;
        if (anchorX[i] < minX) minX = anchorX[i];
        if (anchorX[i] > maxX) maxX = anchorX[i];
      }
      const xSpan = Math.max(1, maxX - minX);

      for (let i = 0; i < drawCount; i++) {
        if (!active[i]) continue;
        const normX = (anchorX[i] - minX) / xSpan;
        const sweepDelay = (1 - normX) * SWEEP_MS;
        const jitter = (Math.random() - 0.5) * 2 * RELEASE_JITTER_MS;
        releaseMs[i] = nowMs + sweepDelay + jitter;
        fadeDur[i] = FADE_OUT_MS * (0.85 + Math.random() * 0.3);
      }
    },
    update(deltaSec, timeSec, baseWind, nowMs) {
      if (drawCount === 0) return;
      const scaledDelta = deltaSec * 0.75;
      const baseScale = 0.5 * 40;
      const swirlScale = 14.0;
      const speedLimit = 6.0;
      const posScale = scaledDelta * 60;
      const bwx = baseWind[0];
      const bwy = baseWind[1];

      let dirty = false;
      let anyActive = false;

      for (let i = 0; i < drawCount; i++) {
        if (!active[i]) continue;
        anyActive = true;
        const age = nowMs - spawnMs[i];

        if (age < TYPE_FADE_IN_MS) {
          alpha[i] = age / TYPE_FADE_IN_MS;
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

      if (releasing && !anyActive) {
        releasing = false;
        typingEntries = [];
        drawCount = 0;
      }

      if (dirty) {
        posAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
      }
    },
    isBusy(_nowMs) {
      return releasing;
    },
    dispose() {
      geom.dispose();
      material.dispose();
    },
  };
}

export const LETTERS_RELEASE_TOTAL_MS = RELEASE_TOTAL_MS;
