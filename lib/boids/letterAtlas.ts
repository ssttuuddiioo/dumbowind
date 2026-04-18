import * as THREE from "three";

const FIRST_ASCII = 32;
const LAST_ASCII = 126;
const ASCII_COUNT = LAST_ASCII - FIRST_ASCII + 1;

// mirrors GLYPHS in atlas.ts — letters flip into one of these when disintegrating
const BOID_GLYPHS = [" ", "·", "-", "—", "|", "/", "\\", "■"] as const;
const BOID_COUNT = BOID_GLYPHS.length;

export const BOID_GLYPH_OFFSET = ASCII_COUNT;
export const LETTER_GLYPH_COUNT = ASCII_COUNT + BOID_COUNT;

const CELL = 32;

export function charIndex(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code < FIRST_ASCII || code > LAST_ASCII) return 0;
  return code - FIRST_ASCII;
}

export function randomBoidGlyphIndex(): number {
  // skip the space slot so we always get a visible mark
  return BOID_GLYPH_OFFSET + 1 + Math.floor(Math.random() * (BOID_COUNT - 1));
}

export function createLetterAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * LETTER_GLYPH_COUNT;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f5f3ee";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `${CELL - 8}px ui-monospace, SFMono-Regular, Menlo, monospace`;

  for (let i = 0; i < ASCII_COUNT; i++) {
    const ch = String.fromCharCode(FIRST_ASCII + i);
    if (ch === " ") continue;
    ctx.fillText(ch, i * CELL + CELL / 2, CELL / 2 + 2);
  }
  for (let i = 0; i < BOID_COUNT; i++) {
    const ch = BOID_GLYPHS[i];
    if (ch === " ") continue;
    ctx.fillText(ch, (ASCII_COUNT + i) * CELL + CELL / 2, CELL / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
