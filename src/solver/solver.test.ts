import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString, UNITS } from './grid';
import { solve, hasSolution, fillRandomValidCell, countSolutions } from './solve';

const nonEmpty = (g: ReturnType<typeof parseGrid>) =>
  [...gridToString(g)].filter((ch) => ch !== '0').length;

const PUZZLE = [
  '...5...6.',
  '8.9....1.',
  '16..87...',
  '3...26...',
  '..7.1.6..',
  '...85...3',
  '...47..21',
  '.4....9.8',
  '.8...3...',
].join('\n');

const SOLUTION =
  '472531869859642317163987254318726495597314682624859173936478521741265938285193746';

describe('solve — reference puzzle', () => {
  it('solves to the exact known solution', () => {
    const res = solve(parseGrid(PUZZLE));
    expect(res.solved).toBe(true);
    expect(gridToString(res.solution)).toBe(SOLUTION);
  });

  it('marks the solution unique', () => {
    expect(solve(parseGrid(PUZZLE)).unique).toBe(true);
  });

  it('solves with logic only (no backtracking)', () => {
    expect(solve(parseGrid(PUZZLE)).usedBacktracking).toBe(false);
  });

  it('uses the hidden pair technique', () => {
    const techs = new Set(solve(parseGrid(PUZZLE)).steps.map((s) => s.technique));
    expect(techs.has('Par escondido')).toBe(true);
  });

  it('exercises elimination-only techniques, not just placements', () => {
    const steps = solve(parseGrid(PUZZLE)).steps;
    expect(steps.some((s) => (s.eliminations?.length ?? 0) > 0)).toBe(true);
  });

  it('every unit in the solution is a permutation of 1..9', () => {
    const g = solve(parseGrid(PUZZLE)).solution;
    for (const u of UNITS) {
      const vals = u.map(({ r, c }) => g[r][c]).sort((a, b) => a - b);
      expect(vals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });
});

describe('solve — edge cases', () => {
  it('throws on contradictory givens', () => {
    expect(() => solve(parseGrid('11' + '.'.repeat(79)))).toThrow();
  });

  it('throws on an unsolvable grid', () => {
    // row0 = 1..8 then blank; a 9 in col8 makes r0c8 have no candidate, no duplicate in any unit.
    const unsolvable = '12345678.' + '........9' + '.'.repeat(63);
    expect(() => solve(parseGrid(unsolvable))).toThrow();
  });

  it('flags multiple solutions for an empty grid', () => {
    const res = solve(parseGrid('.'.repeat(81)));
    expect(res.unique).toBe(false);
  });
});

describe('fillRandomValidCell', () => {
  const blank = '.'.repeat(81);

  it('adds exactly one filled cell to an empty grid', () => {
    const out = fillRandomValidCell(parseGrid(blank), () => 0);
    expect(out).not.toBeNull();
    expect(nonEmpty(out!)).toBe(1);
  });

  it('keeps the grid solvable (the new digit comes from a real solution)', () => {
    const out = fillRandomValidCell(parseGrid(blank), () => 0.5)!;
    expect(countSolutions(out, 1).count).toBeGreaterThan(0);
  });

  it('reduces the number of solutions toward uniqueness as cells are added', () => {
    let g = parseGrid('472531869' + '.'.repeat(72)); // one full row of givens -> still non-unique
    expect(countSolutions(g, 2).count).toBe(2);
    for (let i = 0; i < 40; i++) {
      const next = fillRandomValidCell(g, Math.random);
      if (!next) break;
      g = next;
      if (countSolutions(g, 2).count === 1) break;
    }
    expect(countSolutions(g, 2).count).toBe(1);
  });

  it('does not mutate the input grid', () => {
    const g = parseGrid(blank);
    const snapshot = gridToString(g);
    fillRandomValidCell(g, () => 0);
    expect(gridToString(g)).toBe(snapshot);
  });

  it('is deterministic given a fixed rng', () => {
    const a = gridToString(fillRandomValidCell(parseGrid(blank), () => 0)!);
    const b = gridToString(fillRandomValidCell(parseGrid(blank), () => 0)!);
    expect(a).toBe(b);
  });

  it('returns null when the grid is already full', () => {
    const full = parseGrid(
      '472531869859642317163987254318726495597314682624859173936478521741265938285193746',
    );
    expect(fillRandomValidCell(full)).toBeNull();
  });
});

describe('hasSolution', () => {
  it('is true for a solvable puzzle', () => {
    expect(hasSolution(parseGrid(PUZZLE))).toBe(true);
  });

  it('is true for the empty grid', () => {
    expect(hasSolution(parseGrid('.'.repeat(81)))).toBe(true);
  });

  it('is false for an unsolvable grid (no candidate, no duplicate)', () => {
    const unsolvable = '12345678.' + '........9' + '.'.repeat(63);
    expect(hasSolution(parseGrid(unsolvable))).toBe(false);
  });
});
