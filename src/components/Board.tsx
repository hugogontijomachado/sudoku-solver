import type { Grid, Coord } from '../solver/grid';
import type { KeyboardEvent } from 'react';
import { Cell } from './Cell';

type View = { grid: Grid; highlight: Coord[]; current: { r: number; c: number; d: number }[] };

type Props = {
  mode: 'edit' | 'solved';
  editGrid: Grid;
  givens: Grid;
  view: View | null;
  conflicts: Coord[];
  selected: Coord | null;
  setSelected: (c: Coord | null) => void;
  setCell: (r: number, c: number, v: number) => void;
  celebrate?: boolean;
};

export function Board({ mode, editGrid, givens, view, conflicts, selected, setSelected, setCell, celebrate }: Props) {
  const conflictSet = new Set(conflicts.map((c) => c.r * 9 + c.c));
  const highlightSet = new Set((view?.highlight ?? []).map((c) => c.r * 9 + c.c));
  const currentSet = new Set((view?.current ?? []).map((c) => c.r * 9 + c.c));

  function onKeyDown(e: KeyboardEvent) {
    if (mode !== 'edit' || !selected) return;
    const { r, c } = selected;
    if (e.key >= '1' && e.key <= '9') setCell(r, c, Number(e.key));
    else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') setCell(r, c, 0);
    else if (e.key === 'ArrowUp') setSelected({ r: Math.max(0, r - 1), c });
    else if (e.key === 'ArrowDown') setSelected({ r: Math.min(8, r + 1), c });
    else if (e.key === 'ArrowLeft') setSelected({ r, c: Math.max(0, c - 1) });
    else if (e.key === 'ArrowRight') setSelected({ r, c: Math.min(8, c + 1) });
    else return;
    e.preventDefault();
  }

  const cells = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const k = r * 9 + c;
      const classes = ['cell'];
      if (r === 3 || r === 6) classes.push('rowsep');

      let value: number;
      if (mode === 'edit') {
        value = editGrid[r][c];
        if (value) classes.push('given');
        if (conflictSet.has(k)) classes.push('conflict');
        if (selected && selected.r === r && selected.c === c) classes.push('selected');
      } else {
        value = view!.grid[r][c];
        if (currentSet.has(k)) classes.push('cur');
        else if (givens[r][c]) classes.push('given');
        else if (value) classes.push('filled');
        if (highlightSet.has(k) && !currentSet.has(k)) classes.push('peer');
      }

      cells.push(
        <Cell
          key={k}
          value={value}
          className={classes.join(' ')}
          onClick={mode === 'edit' ? () => setSelected({ r, c }) : undefined}
        />,
      );
    }

  return (
    <div className={`board${celebrate ? ' celebrate' : ''}`} tabIndex={0} onKeyDown={onKeyDown}>
      {cells}
    </div>
  );
}
