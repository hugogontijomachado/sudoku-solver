import { describe, it, expect } from 'vitest';
import { parseGrid } from './grid';
import { Board } from './candidates';

describe('Board', () => {
  it('computes candidates from peers', () => {
    // r0c0 empty; row0 has 2,3; col0 has 4; box0 has 5 -> excludes {2,3,4,5}
    const g = parseGrid('.23......4........5.......................................................' + '.......');
    const b = new Board(g);
    const s = b.candAt(0, 0)!;
    for (const d of [2, 3, 4, 5]) expect(s.has(d)).toBe(false);
    expect(s.has(1)).toBe(true);
  });

  it('place() fills a cell and prunes peers', () => {
    const b = new Board(parseGrid('.'.repeat(81)));
    b.place(0, 0, 7);
    expect(b.grid[0][0]).toBe(7);
    expect(b.candAt(0, 0)).toBeNull();
    expect(b.candAt(0, 1)!.has(7)).toBe(false); // same row
    expect(b.candAt(1, 1)!.has(7)).toBe(false); // same box
  });

  it('isSolved() is false for a non-full grid', () => {
    expect(new Board(parseGrid('.'.repeat(81))).isSolved()).toBe(false);
  });
});
