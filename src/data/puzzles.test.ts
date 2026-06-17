import { describe, it, expect } from 'vitest';
import puzzles from './puzzles.json';
import { parseGrid, findConflicts } from '../solver/grid';
import { solve } from '../solver/solve';

const DIFFS = ['easy', 'medium', 'hard', 'evil'] as const;
const pool = puzzles as Record<string, string[]>;

describe('puzzle pool integrity', () => {
  it('has at least 80 puzzles per difficulty', () => {
    for (const d of DIFFS) expect(pool[d].length, d).toBeGreaterThan(80);
  });

  // Every stored puzzle must be a real puzzle (81 cells, no conflicts), have a UNIQUE
  // solution, and be fully solvable by the implemented LOGIC — i.e. never fall back to
  // backtracking. A puzzle that needs trial-and-error is "incompleto" for this app
  // (the step-by-step explanation can't be finished) and must not ship.
  for (const d of DIFFS) {
    it(`every ${d} puzzle is valid, unique, and logic-complete`, () => {
      pool[d].forEach((s, i) => {
        const cells = [...s].filter((ch) => (ch >= '0' && ch <= '9') || ch === '.').length;
        expect(cells, `${d}[${i}] length`).toBe(81);
        const g = parseGrid(s);
        expect(findConflicts(g).length, `${d}[${i}] conflicts`).toBe(0);
        const res = solve(g);
        expect(res.solved, `${d}[${i}] solved`).toBe(true);
        expect(res.unique, `${d}[${i}] unique`).toBe(true);
        expect(res.usedBacktracking, `${d}[${i}] needs backtracking`).toBe(false);
      });
    }, 60000);
  }
});
