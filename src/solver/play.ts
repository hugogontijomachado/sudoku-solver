import type { Grid } from './grid';

export type PlayStatus = { correct: Set<number>; wrong: Set<number>; complete: boolean };

export function playStatus(playGrid: Grid, givens: Grid, solution: Grid): PlayStatus {
  const correct = new Set<number>();
  const wrong = new Set<number>();
  let filled = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (givens[r][c]) { filled++; continue; }
      const v = playGrid[r][c];
      if (!v) continue;
      filled++;
      if (v === solution[r][c]) correct.add(r * 9 + c);
      else wrong.add(r * 9 + c);
    }
  return { correct, wrong, complete: filled === 81 && wrong.size === 0 };
}
