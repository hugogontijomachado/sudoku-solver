import { describe, it, expect } from 'vitest';
import { emptyGrid } from './grid';
import { playStatus } from './play';

function gridFrom(rows: number[][]) {
  return rows.map((r) => r.slice());
}

describe('playStatus', () => {
  it('classifies user entries as correct/wrong and ignores givens', () => {
    const givens = emptyGrid();
    givens[0][0] = 5; // a given
    const solution = emptyGrid();
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) solution[r][c] = ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
    solution[0][0] = 5;
    const play = gridFrom(givens);
    play[0][1] = solution[0][1]; // correct user entry
    play[0][2] = (solution[0][2] % 9) + 1; // wrong user entry
    const st = playStatus(play, givens, solution);
    expect(st.correct.has(0 * 9 + 1)).toBe(true);
    expect(st.wrong.has(0 * 9 + 2)).toBe(true);
    expect(st.correct.has(0 * 9 + 0)).toBe(false); // givens are not "user entries"
    expect(st.complete).toBe(false);
  });

  it('reports complete when every cell is filled and correct', () => {
    const solution = emptyGrid();
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) solution[r][c] = ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
    const givens = emptyGrid();
    const play = solution.map((r) => r.slice());
    const st = playStatus(play, givens, solution);
    expect(st.wrong.size).toBe(0);
    expect(st.complete).toBe(true);
  });
});
