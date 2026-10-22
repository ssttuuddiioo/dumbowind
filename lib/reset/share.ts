// 1080x1920 story graphic, drawn on a canvas in the phone browser.

import { CAMPAIGN, LED } from "./config";
import { ROWS, formatCount, layoutLine, litDots } from "./font";

const W = 1080;
const H = 1920;
const INK = "#0a0a0a";
const BONE = "#f5f3ee";
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace';

function drawDots(ctx: CanvasRenderingContext2D, text: string, cy: number, maxW: number, maxPitch: number) {
  const { glyphs, width } = layoutLine(text);
  const p = Math.floor(Math.min(maxW / width, maxPitch));
  const x0 = Math.round((W - width * p) / 2);
  const y0 = Math.round(cy - (ROWS * p) / 2);
  const r = p * 0.38;

  ctx.fillStyle = LED;
  ctx.globalAlpha = 0.11;
  ctx.beginPath();
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < width; x++) {
      ctx.moveTo(x0 + (x + 0.5) * p + r, y0 + (y + 0.5) * p);
      ctx.arc(x0 + (x + 0.5) * p, y0 + (y + 0.5) * p, r, 0, Math.PI * 2);
    }
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (const g of glyphs)
    for (const [dx, dy] of litDots(g.ch)) {
      const cx = x0 + (g.x + dx + 0.5) * p;
      const cyy = y0 + (dy + 0.5) * p;
      ctx.moveTo(cx + r, cyy);
      ctx.arc(cx, cyy, r, 0, Math.PI * 2);
    }
  ctx.save();
  ctx.shadowColor = LED;
  ctx.shadowBlur = p * 1.6;
  ctx.fill();
  ctx.shadowBlur = p * 0.5;
  ctx.fill();
  ctx.restore();
  return y0 + ROWS * p;
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, alpha: number) {
  ctx.font = `400 ${size}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = BONE;
  ctx.globalAlpha = alpha;
  ctx.fillText(text, W / 2, y);
  ctx.globalAlpha = 1;
}

export async function buildStory(total: number, topicLabel: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  drawDots(ctx, CAMPAIGN.name, 260, 620, 14);
  drawDots(ctx, formatCount(total), 760, 960, 40);
  drawDots(ctx, "PEOPLE RESET", 1010, 900, 14);
  drawDots(ctx, "AMERICA", 1130, 900, 14);

  drawLabel(ctx, "i reset", 1390, 40, 0.55);
  drawLabel(ctx, topicLabel.toLowerCase(), 1460, 52, 1);
  drawLabel(ctx, CAMPAIGN.urlLabel, 1720, 36, 0.55);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
