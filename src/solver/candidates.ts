import { PEERS, cloneGrid } from './grid';
import type { Grid } from './grid';

export class Board {
  grid: Grid;
  /** candidate set per cell, indexed r*9+c; null when the cell is filled */
  cand: (Set<number> | null)[];

  constructor(grid: Grid) {
    this.grid = cloneGrid(grid);
    this.cand = new Array(81).fill(null);
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] !== 0) continue;
        const used = new Set<number>();
        for (const p of PEERS[r * 9 + c]) {
          const v = this.grid[p.r][p.c];
          if (v) used.add(v);
        }
        const s = new Set<number>();
        for (let d = 1; d <= 9; d++) if (!used.has(d)) s.add(d);
        this.cand[r * 9 + c] = s;
      }
  }

  candAt(r: number, c: number): Set<number> | null {
    return this.cand[r * 9 + c];
  }

  isSolved(): boolean {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (this.grid[r][c] === 0) return false;
    return true;
  }

  place(r: number, c: number, d: number): void {
    this.grid[r][c] = d;
    this.cand[r * 9 + c] = null;
    for (const p of PEERS[r * 9 + c]) {
      const s = this.cand[p.r * 9 + p.c];
      if (s) s.delete(d);
    }
  }
}
