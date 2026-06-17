import { describe, it, expect } from 'vitest';
import { CASES } from './techniqueCases';
import { TECHNIQUES } from './techniques';
import { parseGrid } from '../solver/grid';
import { Board } from '../solver/candidates';
import {
  nakedSingle, hiddenSingle, nakedSubset, hiddenSubset, pointing, claiming, xWing,
} from '../solver/techniques';
import { findSwordfish, findYWing } from '../solver/advanced';
import type { Step } from '../solver/techniques';

// Each animated case must actually fire its technique on a board re-derived from the
// case grid (naive candidates) — this keeps the baked data honest and self-contained.
const RUNNERS: Record<string, (b: Board) => Step[]> = {
  'naked-single': (b) => nakedSingle(b),
  'hidden-single': (b) => hiddenSingle(b),
  'naked-pair': (b) => nakedSubset(b, 2),
  'naked-triple': (b) => nakedSubset(b, 3),
  'naked-quad': (b) => nakedSubset(b, 4),
  'hidden-pair': (b) => hiddenSubset(b, 2),
  'hidden-triple': (b) => hiddenSubset(b, 3),
  'hidden-quad': (b) => hiddenSubset(b, 4),
  'pointing': (b) => pointing(b),
  'claiming': (b) => claiming(b),
  'x-wing': (b) => xWing(b),
  'swordfish': (b) => findSwordfish(b),
  'y-wing': (b) => findYWing(b),
};

describe('technique cases', () => {
  it('every case grid is 81 chars and parses', () => {
    for (const [key, c] of Object.entries(CASES)) {
      expect(c.grid.length, key).toBe(81);
      expect(() => parseGrid(c.grid), key).not.toThrow();
      expect(c.frames.length, key).toBeGreaterThanOrEqual(2);
    }
  });

  it('every animated technique really fires on its case grid', () => {
    for (const [key, run] of Object.entries(RUNNERS)) {
      const c = CASES[key];
      expect(c, `missing case for ${key}`).toBeTruthy();
      const steps = run(new Board(parseGrid(c.grid)));
      expect(steps.length, `${key} did not fire`).toBeGreaterThan(0);
    }
  });

  it("each frame's final cell marks match the solver's eliminations/placement", () => {
    for (const [key, run] of Object.entries(RUNNERS)) {
      const c = CASES[key];
      const step = run(new Board(parseGrid(c.grid)))[0];
      const concl = c.frames[c.frames.length - 1].cells;
      const expected = (step.placements ?? []).map((p) => p.r * 9 + p.c)
        .concat((step.eliminations ?? []).map((e) => e.r * 9 + e.c));
      for (const idx of expected) {
        expect(concl.some((m) => m.idx === idx && (m.cls === 'elim' || m.cls === 'place')), `${key} idx ${idx}`).toBe(true);
      }
    }
  });

  it('every TECHNIQUES caseKey resolves to a real case (and vice-versa)', () => {
    const referenced = TECHNIQUES.filter((t) => t.caseKey).map((t) => t.caseKey!);
    for (const key of referenced) expect(CASES[key], key).toBeTruthy();
    for (const key of Object.keys(CASES)) expect(referenced, key).toContain(key);
  });

  it('catalogs exactly 25 techniques across 8 levels', () => {
    expect(TECHNIQUES.length).toBe(25);
    expect(new Set(TECHNIQUES.map((t) => t.n)).size).toBe(25);
    expect(Math.max(...TECHNIQUES.map((t) => t.level))).toBe(8);
  });
});
