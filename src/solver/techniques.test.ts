import { describe, it, expect } from 'vitest';
import { parseGrid } from './grid';
import { Board } from './candidates';
import { nakedSingle, hiddenSingle, pointing, TECHNIQUES } from './techniques';

describe('techniques', () => {
  it('nakedSingle places the only remaining candidate', () => {
    // Fill row 0 cols 1..8 with 2..9 so r0c0 can only be 1.
    const b = new Board(parseGrid('.23456789' + '.'.repeat(72)));
    const steps = nakedSingle(b);
    expect(steps).toHaveLength(1);
    expect(b.grid[0][0]).toBe(1);
    expect(steps[0].placements).toEqual([{ r: 0, c: 0, d: 1 }]);
  });

  it('hiddenSingle finds the only cell in a unit for a digit', () => {
    // Rows 1..8 each carry a single 1 on the diagonal, so columns 0..7
    // already contain a 1. In row 0, only column 8 can still hold 1.
    const g = parseGrid(
      '.........' +
        '1........' +
        '.1.......' +
        '..1......' +
        '...1.....' +
        '....1....' +
        '.....1...' +
        '......1..' +
        '.......1.',
    );
    const b = new Board(g);
    const steps = hiddenSingle(b);
    expect(steps).toHaveLength(1);
    expect(steps[0].placements![0]).toMatchObject({ r: 0, c: 8, d: 1 });
  });

  it('pointing confines a digit to a line and eliminates it outside the box', () => {
    // Fill box 0's lower two rows with non-1 givens so digit 1 can only sit
    // in box 0's top row (row 0). Pointing then removes 1 from the rest of row 0.
    const b = new Board(parseGrid(
      '.........' +
        '234......' +
        '567......' +
        '.'.repeat(54),
    ));
    const steps = pointing(b);
    expect(steps).toHaveLength(1);
    expect(steps[0].technique).toBe('Interseção (pointing)');
    const elim = steps[0].eliminations!;
    expect(elim).toContainEqual({ r: 0, c: 3, d: 1 });
    expect(elim).toContainEqual({ r: 0, c: 8, d: 1 });
  });

  it('wires all 11 techniques in difficulty order', () => {
    expect(TECHNIQUES).toHaveLength(11);
    expect(typeof pointing).toBe('function');
  });
});
