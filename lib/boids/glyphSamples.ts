const FIRST_ASCII = 32;
const LAST_ASCII = 126;
const CANVAS_W = 48;
const CANVAS_H = 64;
const FONT_SIZE = 54;
const FONT_WEIGHT = 800;
const STRIDE = 3;
const ALPHA_THRESHOLD = 128;
const MAX_PARTICLES_PER_GLYPH = 58;

export type GlyphSamples = Map<number, Float32Array>;

let cached: GlyphSamples | null = null;

export function getGlyphSamples(): GlyphSamples {
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `${FONT_WEIGHT} ${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = "#ffffff";

  const map: GlyphSamples = new Map();

  for (let code = FIRST_ASCII; code <= LAST_ASCII; code++) {
    const ch = String.fromCharCode(code);
    if (ch === " ") {
      map.set(code, new Float32Array(0));
      continue;
    }
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillText(ch, CANVAS_W / 2, CANVAS_H / 2 + 2);
    const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const pts: number[] = [];
    for (let y = 0; y < CANVAS_H; y += STRIDE) {
      for (let x = 0; x < CANVAS_W; x += STRIDE) {
        const a = img.data[(y * CANVAS_W + x) * 4 + 3];
        if (a > ALPHA_THRESHOLD) {
          const nx = (x + STRIDE / 2) / CANVAS_W - 0.5;
          const ny = 0.5 - (y + STRIDE / 2) / CANVAS_H;
          pts.push(nx, ny);
        }
      }
    }
    if (pts.length / 2 > MAX_PARTICLES_PER_GLYPH) {
      const total = pts.length / 2;
      const step = total / MAX_PARTICLES_PER_GLYPH;
      const trimmed: number[] = [];
      for (let k = 0; k < MAX_PARTICLES_PER_GLYPH; k++) {
        const idx = Math.floor(k * step);
        trimmed.push(pts[idx * 2], pts[idx * 2 + 1]);
      }
      map.set(code, new Float32Array(trimmed));
    } else {
      map.set(code, new Float32Array(pts));
    }
  }
  cached = map;
  return map;
}
