import * as THREE from "three";

const GLYPHS = [" ", "·", "-", "—", "|", "/", "\\", "■"] as const;
export const GLYPH_COUNT = GLYPHS.length;

const CELL = 16;

export function createGlyphAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * GLYPH_COUNT;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f5f3ee";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `${CELL - 2}px ui-monospace, SFMono-Regular, Menlo, monospace`;

  for (let i = 0; i < GLYPHS.length; i++) {
    const g = GLYPHS[i];
    if (g === " ") continue;
    ctx.fillText(g, i * CELL + CELL / 2, CELL / 2 + 1);
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
