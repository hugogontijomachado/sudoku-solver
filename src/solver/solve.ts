import { PEERS, cloneGrid, findConflicts } from './grid';
import type { Grid } from './grid';
import { Board } from './candidates';
import { TECHNIQUES } from './techniques';
import type { Step } from './techniques';

export type SolveResult = {
  solution: Grid;
  steps: Step[];
  unique: boolean;
  usedBacktracking: boolean;
  solved: boolean;
};

export function countSolutions(grid: Grid, limit = 2): { count: number; solution: Grid | null } {
  const work = cloneGrid(grid);
  let count = 0;
  let found: Grid | null = null;

  const optionsFor = (r: number, c: number): number[] => {
    const used = new Set<number>();
    for (const p of PEERS[r * 9 + c]) used.add(work[p.r][p.c]);
    const opts: number[] = [];
    for (let d = 1; d <= 9; d++) if (!used.has(d)) opts.push(d);
    return opts;
  };

  const findEmpty = (): { cell: [number, number] | null; opts: number[] } => {
    let best: [number, number] | null = null;
    let bestOpts: number[] = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (work[r][c] === 0) {
          const opts = optionsFor(r, c);
          if (best === null || opts.length < bestOpts.length) {
            best = [r, c];
            bestOpts = opts;
            if (opts.length <= 1) return { cell: best, opts: bestOpts };
          }
        }
    return { cell: best, opts: bestOpts };
  };

  const rec = () => {
    if (count >= limit) return;
    const { cell, opts } = findEmpty();
    if (!cell) {
      count++;
      if (!found) found = cloneGrid(work);
      return;
    }
    const [r, c] = cell;
    for (const d of opts) {
      work[r][c] = d;
      rec();
      work[r][c] = 0;
      if (count >= limit) return;
    }
  };

  rec();
  return { count, solution: found };
}

export function hasSolution(grid: Grid): boolean {
  return countSolutions(grid, 1).count > 0;
}

// Fills one random empty cell with a value taken from a real solution, so the result is
// always consistent (and nudges a non-unique grid toward uniqueness). Returns a clone;
// returns null when the grid is already full or has no solution. `rng` is injectable for
// deterministic tests.
export function fillRandomValidCell(grid: Grid, rng: () => number = Math.random): Grid | null {
  const empties: number[] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) if (grid[r][c] === 0) empties.push(r * 9 + c);
  if (empties.length === 0) return null;
  const { solution } = countSolutions(grid, 1);
  if (!solution) return null;
  const pick = empties[Math.min(empties.length - 1, Math.floor(rng() * empties.length))];
  const r = Math.floor(pick / 9);
  const c = pick % 9;
  const out = cloneGrid(grid);
  out[r][c] = solution[r][c];
  return out;
}

export function solve(grid: Grid): SolveResult {
  if (findConflicts(grid).length)
    throw new Error('Pistas contraditórias: há dígitos repetidos numa mesma linha, coluna ou bloco.');

  const { count } = countSolutions(grid, 2);
  if (count === 0) throw new Error('Este Sudoku não tem solução.');
  const unique = count === 1;

  const b = new Board(grid);
  const steps: Step[] = [];
  let usedBacktracking = false;

  while (!b.isSolved()) {
    let progressed = false;
    for (const tech of TECHNIQUES) {
      const res = tech(b);
      if (res.length) {
        steps.push(...res);
        progressed = true;
        break;
      }
    }
    if (!progressed) {
      usedBacktracking = true;
      const { solution } = countSolutions(b.grid, 1);
      if (!solution) throw new Error('Sem solução a partir deste ponto.');
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) b.grid[r][c] = solution[r][c];
      break;
    }
  }

  return { solution: b.grid, steps, unique, usedBacktracking, solved: b.isSolved() };
}
