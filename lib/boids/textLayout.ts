export const CELL_W = 44;
export const LINE_H = 92;
export const VERTICAL_OFFSET = 0;

export type PlacedChar = {
  charIdx: number;
  ch: string;
  x: number;
  y: number;
};

export type LayoutResult = {
  placed: PlacedChar[];
  cursor: { x: number; y: number };
};

export function layoutTyping(
  text: string,
  w: number,
  h: number,
): LayoutResult {
  const maxLineWidth = Math.min(w * 0.9, 1600);
  const maxCols = Math.max(8, Math.floor(maxLineWidth / CELL_W));

  const rows: Array<Array<{ charIdx: number; ch: string }>> = [[]];
  let curRow = rows[0];
  let pendingWord: Array<{ charIdx: number; ch: string }> = [];

  const flushWordTo = (row: Array<{ charIdx: number; ch: string }>) => {
    for (const c of pendingWord) row.push(c);
    pendingWord = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      flushWordTo(curRow);
      if (curRow.length >= maxCols) {
        rows.push([]);
        curRow = rows[rows.length - 1];
      } else {
        curRow.push({ charIdx: i, ch: " " });
      }
    } else if (ch === "\n") {
      flushWordTo(curRow);
      rows.push([]);
      curRow = rows[rows.length - 1];
    } else {
      pendingWord.push({ charIdx: i, ch });
      if (curRow.length + pendingWord.length > maxCols) {
        if (curRow.length === 0 || pendingWord.length > maxCols) {
          for (const c of pendingWord) {
            if (curRow.length >= maxCols) {
              rows.push([]);
              curRow = rows[rows.length - 1];
            }
            curRow.push(c);
          }
          pendingWord = [];
        } else {
          rows.push([]);
          curRow = rows[rows.length - 1];
        }
      }
    }
  }
  flushWordTo(curRow);

  const topY = h / 2 + VERTICAL_OFFSET;

  const placed: PlacedChar[] = [];
  let cursorRow = rows.length - 1;
  let cursorCol = rows[cursorRow].length;

  for (let li = 0; li < rows.length; li++) {
    const row = rows[li];
    const lineLen = row.length;
    const lineW = lineLen * CELL_W;
    const leftX = w / 2 - lineW / 2 + CELL_W / 2;
    const y = topY - li * LINE_H;
    for (let ci = 0; ci < row.length; ci++) {
      const entry = row[ci];
      if (entry.ch === " ") continue;
      placed.push({
        charIdx: entry.charIdx,
        ch: entry.ch,
        x: leftX + ci * CELL_W,
        y,
      });
    }
  }

  const cursorRowArr = rows[cursorRow];
  const cursorLineW = cursorRowArr.length * CELL_W;
  const cursorLeftX = w / 2 - cursorLineW / 2 + CELL_W / 2;
  const cursorX = cursorLeftX + cursorCol * CELL_W - CELL_W / 2;
  const cursorY = topY - cursorRow * LINE_H;

  return {
    placed,
    cursor: { x: cursorX, y: cursorY },
  };
}
