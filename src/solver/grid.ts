export type Grid = number[][]; // 9x9, 0 = empty
export type Coord = { r: number; c: number };

export const ROWS: Coord[][] = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => ({ r, c })),
);
export const COLS: Coord[][] = Array.from({ length: 9 }, (_, c) =>
  Array.from({ length: 9 }, (_, r) => ({ r, c })),
);
export const BOXES: Coord[][] = (() => {
  const boxes: Coord[][] = [];
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const u: Coord[] = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) u.push({ r: br * 3 + dr, c: bc * 3 + dc });
      boxes.push(u);
    }
  return boxes;
})();

export const UNITS: Coord[][] = [...ROWS, ...COLS, ...BOXES];

export function boxIndex(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

// Per-cell units (3 each) and peers (20 each), indexed by r*9+c.
export const UNITS_OF: Coord[][][] = [];
export const PEERS: Coord[][] = [];
for (let r = 0; r < 9; r++)
  for (let c = 0; c < 9; c++) {
    const mine = [ROWS[r], COLS[c], BOXES[boxIndex(r, c)]];
    UNITS_OF[r * 9 + c] = mine;
    const seen = new Map<number, Coord>();
    for (const u of mine)
      for (const cell of u)
        if (cell.r !== r || cell.c !== c) seen.set(cell.r * 9 + cell.c, cell);
    PEERS[r * 9 + c] = [...seen.values()];
  }

export function parseGrid(text: string): Grid {
  const digits: number[] = [];
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') digits.push(Number(ch));
    else if (ch === '.') digits.push(0);
  }
  if (digits.length !== 81)
    throw new Error(`Esperava 81 células, encontrei ${digits.length}. Use 0 ou . para vazias.`);
  const g: Grid = [];
  for (let r = 0; r < 9; r++) g.push(digits.slice(r * 9, r * 9 + 9));
  return g;
}

export function gridToString(g: Grid): string {
  return g.flat().join('');
}

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => row.slice());
}

export function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function cellName(r: number, c: number): string {
  return `r${r + 1}c${c + 1}`;
}

export function unitName(unit: Coord[]): string {
  const rs = new Set(unit.map((x) => x.r));
  const cs = new Set(unit.map((x) => x.c));
  if (rs.size === 1) return `linha ${unit[0].r + 1}`;
  if (cs.size === 1) return `coluna ${unit[0].c + 1}`;
  return `bloco ${boxIndex(unit[0].r, unit[0].c) + 1}`;
}

export function findConflicts(g: Grid): Coord[] {
  const bad = new Set<number>();
  for (const u of UNITS) {
    const seen = new Map<number, Coord>();
    for (const { r, c } of u) {
      const v = g[r][c];
      if (!v) continue;
      if (seen.has(v)) {
        bad.add(r * 9 + c);
        const p = seen.get(v)!;
        bad.add(p.r * 9 + p.c);
      } else seen.set(v, { r, c });
    }
  }
  return [...bad].map((k) => ({ r: Math.floor(k / 9), c: k % 9 }));
}

export function renderGridText(g: Grid): string {
  const lines: string[] = [];
  for (let r = 0; r < 9; r++) {
    if (r === 3 || r === 6) lines.push('------+-------+------');
    const parts: string[] = [];
    for (let c = 0; c < 9; c++) {
      if (c === 3 || c === 6) parts.push('|');
      parts.push(g[r][c] ? String(g[r][c]) : '.');
    }
    lines.push(parts.join(' '));
  }
  return lines.join('\n');
}

export function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const combo: T[] = [];
  (function rec(start: number) {
    if (combo.length === k) {
      res.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  })(0);
  return res;
}
