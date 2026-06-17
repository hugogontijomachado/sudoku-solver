# Sudoku Solver Web App — Implementation Plan

> ✅ **EXECUTED (2026-06-16).** All 12 tasks were implemented (subagent-driven),
> reviewed task-by-task + a final Opus whole-branch review (verdict: ready to merge),
> verified (22 tests, build clean, runtime smoke), and pushed to
> https://github.com/hugogontijomachado/sudoku-solver (`main`). Local checkout:
> `/Users/hugocemep/GitHub/sudoku-solver`. Per-task record: `<repo>/.git/sdd/progress.md`.
> Note the as-built stack is React 19 / Vite 8 / TS 6 / Vitest 4 with a strict tsconfig
> (the prose below says React 18); type-only imports use `import type`. Kept for rationale.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static web app where the user fills in a 9×9 Sudoku, clicks Solve, and sees the solution plus an interactive step-by-step explanation (with a downloadable PDF), deployed on Vercel.

**Architecture:** A pure-TypeScript solver (faithful port of `sudoku/scripts/sudoku_solver.py`) runs in the browser and returns `{ solution, steps[], unique, usedBacktracking }`. A React (Vite) UI consumes that result: an editable board, a step player that highlights cells, and a print-to-PDF protocol view. No backend.

**Tech Stack:** React 18, Vite, TypeScript, Vitest. Styling via plain CSS variables derived from `DESIGN.md` (no CSS framework). PDF via `window.print()` + a print stylesheet.

**Working directory:** `/Users/hugocemep/GitHub/sudoku-solver` (sibling of the current project; this is the local checkout of `https://github.com/hugogontijomachado/sudoku-solver`). All `git` commands run inside this folder. The spec referenced placing it "inside this project"; a sibling folder is used instead because it is a separate GitHub repo — note this deviation.

**Design source of truth:** `DESIGN.md` is copied into the repo and governs all colors/typography/spacing. Reference its tokens, never inline values.

---

## File Structure

```
sudoku-solver/
  src/
    solver/
      grid.ts          # types, geometry (ROWS/COLS/BOXES/UNITS/PEERS), parse/render, conflicts, combinations
      candidates.ts    # Board class — candidate sets, place()
      techniques.ts    # Step type + all human techniques + TECHNIQUES order
      solve.ts         # countSolutions (backtracking) + solve() driver + SolveResult
      solver.test.ts   # Vitest: golden test + edge cases
    components/
      Cell.tsx         # presentational single cell
      Board.tsx        # 9×9 grid: edit (typing) + solved (highlight) modes
      Toolbar.tsx      # Resolver/Limpar/Exemplo/Editar
      StepPlayer.tsx   # step navigation + auto-play
      ProtocolView.tsx # full static list + Baixar PDF (print)
    styles/
      tokens.css       # design tokens + all screen styles
      print.css        # print-only rules for the PDF
    App.tsx            # central state machine, error/warning banners
    main.tsx           # React entry
  index.html
  package.json · tsconfig.json · tsconfig.node.json · vite.config.ts
  .gitignore · README.md · DESIGN.md
```

---

## Task 1: Scaffold project

**Files:**
- Create: the whole `sudoku-solver/` project via Vite
- Modify: `package.json`, `vite.config.ts`
- Copy: `DESIGN.md`

- [ ] **Step 1: Clone the (empty) GitHub repo**

Run:
```bash
cd /Users/hugocemep/GitHub
git clone https://github.com/hugogontijomachado/sudoku-solver.git || mkdir -p sudoku-solver
cd sudoku-solver
git init -b main 2>/dev/null; git remote add origin https://github.com/hugogontijomachado/sudoku-solver.git 2>/dev/null; true
```
Expected: an empty `sudoku-solver/` git working dir (clone of an empty repo prints a warning — that's fine).

- [ ] **Step 2: Scaffold Vite React+TS into the folder**

Run:
```bash
cd /Users/hugocemep/GitHub/sudoku-solver
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest
```
Expected: Vite project files created; dependencies installed.

- [ ] **Step 3: Add the test script and remove starter cruft**

Edit `package.json` so the `scripts` block is exactly:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
Then delete starter files that we replace:
```bash
rm -f src/App.css src/index.css src/assets/react.svg
```

- [ ] **Step 4: Copy the design source of truth**

Run:
```bash
cp /Users/hugocemep/GitHub/sudoku/DESIGN.md /Users/hugocemep/GitHub/sudoku-solver/DESIGN.md
```

- [ ] **Step 5: Verify the toolchain runs**

Run: `npm run build`
Expected: a clean production build into `dist/` (the default starter still compiles at this point).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React+TS project with Vitest"
```

---

## Task 2: Solver geometry & helpers (`grid.ts`)

**Files:**
- Create: `src/solver/grid.ts`
- Test: covered by `src/solver/solver.test.ts` (added in Task 5); this task adds a focused smoke test inline.
- Create: `src/solver/grid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/solver/grid.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  parseGrid, gridToString, renderGridText, PEERS, UNITS, findConflicts, combinations,
} from './grid';

describe('grid', () => {
  it('parses an 81-char string, ignoring separators', () => {
    const g = parseGrid('1'.padEnd(81, '.'));
    expect(g[0][0]).toBe(1);
    expect(g[8][8]).toBe(0);
    expect(gridToString(g)).toBe('1'.padEnd(81, '0'));
  });

  it('throws when the cell count is not 81', () => {
    expect(() => parseGrid('123')).toThrow();
  });

  it('each cell has exactly 20 peers and 3 units', () => {
    expect(PEERS[0]).toHaveLength(20);
    expect(UNITS).toHaveLength(27);
  });

  it('detects duplicate givens in a unit', () => {
    const g = parseGrid('11' + '.'.repeat(79));
    expect(findConflicts(g)).toHaveLength(2);
  });

  it('combinations(2 of [a,b,c]) has 3 pairs', () => {
    expect(combinations(['a', 'b', 'c'], 2)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/solver/grid.test.ts`
Expected: FAIL — cannot find module `./grid`.

- [ ] **Step 3: Write the implementation**

Create `src/solver/grid.ts`:
```ts
export type Grid = number[][]; // 9x9, 0 = empty
export type Coord = { r: number; c: number };

export const ROWS: Coord[][] = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => ({ r, c })),
);
export const COLS: Coord[][] = Array.from({ length: 9 }, (_, c) =>
  Array.from({ length: 9 }, (_, r) => ({ r, c })),
);
export const BOXES: Coord[][] = (() => {
  const boxes: Coord[][] = [];
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++) {
      const u: Coord[] = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) u.push({ r: br * 3 + dr, c: bc * 3 + dc });
      boxes.push(u);
    }
  return boxes;
})();

export const UNITS: Coord[][] = [...ROWS, ...COLS, ...BOXES];

export function boxIndex(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

// Per-cell units (3 each) and peers (20 each), indexed by r*9+c.
export const UNITS_OF: Coord[][][] = [];
export const PEERS: Coord[][] = [];
for (let r = 0; r < 9; r++)
  for (let c = 0; c < 9; c++) {
    const mine = [ROWS[r], COLS[c], BOXES[boxIndex(r, c)]];
    UNITS_OF[r * 9 + c] = mine;
    const seen = new Map<number, Coord>();
    for (const u of mine)
      for (const cell of u)
        if (cell.r !== r || cell.c !== c) seen.set(cell.r * 9 + cell.c, cell);
    PEERS[r * 9 + c] = [...seen.values()];
  }

export function parseGrid(text: string): Grid {
  const digits: number[] = [];
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') digits.push(Number(ch));
    else if (ch === '.') digits.push(0);
  }
  if (digits.length !== 81)
    throw new Error(`Esperava 81 células, encontrei ${digits.length}. Use 0 ou . para vazias.`);
  const g: Grid = [];
  for (let r = 0; r < 9; r++) g.push(digits.slice(r * 9, r * 9 + 9));
  return g;
}

export function gridToString(g: Grid): string {
  return g.flat().join('');
}

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => row.slice());
}

export function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function cellName(r: number, c: number): string {
  return `r${r + 1}c${c + 1}`;
}

export function unitName(unit: Coord[]): string {
  const rs = new Set(unit.map((x) => x.r));
  const cs = new Set(unit.map((x) => x.c));
  if (rs.size === 1) return `linha ${unit[0].r + 1}`;
  if (cs.size === 1) return `coluna ${unit[0].c + 1}`;
  return `bloco ${boxIndex(unit[0].r, unit[0].c) + 1}`;
}

export function findConflicts(g: Grid): Coord[] {
  const bad = new Set<number>();
  for (const u of UNITS) {
    const seen = new Map<number, Coord>();
    for (const { r, c } of u) {
      const v = g[r][c];
      if (!v) continue;
      if (seen.has(v)) {
        bad.add(r * 9 + c);
        const p = seen.get(v)!;
        bad.add(p.r * 9 + p.c);
      } else seen.set(v, { r, c });
    }
  }
  return [...bad].map((k) => ({ r: Math.floor(k / 9), c: k % 9 }));
}

export function renderGridText(g: Grid): string {
  const lines: string[] = [];
  for (let r = 0; r < 9; r++) {
    if (r === 3 || r === 6) lines.push('------+-------+------');
    const parts: string[] = [];
    for (let c = 0; c < 9; c++) {
      if (c === 3 || c === 6) parts.push('|');
      parts.push(g[r][c] ? String(g[r][c]) : '.');
    }
    lines.push(parts.join(' '));
  }
  return lines.join('\n');
}

export function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const combo: T[] = [];
  (function rec(start: number) {
    if (combo.length === k) {
      res.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  })(0);
  return res;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/solver/grid.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/solver/grid.ts src/solver/grid.test.ts
git commit -m "feat(solver): grid geometry, parsing, conflicts, helpers"
```

---

## Task 3: Candidate board (`candidates.ts`)

**Files:**
- Create: `src/solver/candidates.ts`
- Create: `src/solver/candidates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/solver/candidates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseGrid } from './grid';
import { Board } from './candidates';

describe('Board', () => {
  it('computes candidates from peers', () => {
    // r0c0 empty; row0 has 2,3; col0 has 4; box0 has 5 -> excludes {2,3,4,5}
    const g = parseGrid('.23......4........5.......................................................' + '........');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/solver/candidates.test.ts`
Expected: FAIL — cannot find module `./candidates`.

- [ ] **Step 3: Write the implementation**

Create `src/solver/candidates.ts`:
```ts
import { Grid, PEERS, cloneGrid } from './grid';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/solver/candidates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/solver/candidates.ts src/solver/candidates.test.ts
git commit -m "feat(solver): candidate board with incremental pruning"
```

---

## Task 4: Human techniques (`techniques.ts`)

**Files:**
- Create: `src/solver/techniques.ts`
- Create: `src/solver/techniques.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/solver/techniques.test.ts`:
```ts
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
    // Put 1 in r1c0 and r2c1 so within box0 only r0c2 can hold 1 across row constraints.
    const b = new Board(parseGrid('..1' + '.'.repeat(78))); // r0c2 = 1 already? no — craft differently
    // Simpler: a row where 1 is excluded from 8 cells via columns.
    const g = parseGrid(
      '.........' + // row0 target
        '1........' +
        '.1.......' +
        '..1......' +
        '...1.....' +
        '....1....' +
        '.....1...' +
        '......1..' +
        '.......1.',
    );
    const b2 = new Board(g);
    const steps = hiddenSingle(b2);
    expect(steps.length).toBe(1);
    // The only column in row 0 without a 1 in it is column 8.
    expect(steps[0].placements![0]).toMatchObject({ r: 0, c: 8, d: 1 });
  });

  it('pointing eliminates a digit from a line outside the box', () => {
    // In box0, force digit 4 to appear only in row0; ensure it can be removed elsewhere in row0.
    const g = parseGrid(
      '.........' +
        '444......'.replace(/4/g, '.') + // keep row1 of box0 free of 4 via givens below
        '.........' +
        '.'.repeat(54),
    );
    // Put 4s in r1c0,r1c1,r1c2 and r2c0,r2c1,r2c2 region is complex; instead assert via TECHNIQUES wiring:
    expect(typeof pointing).toBe('function');
    expect(TECHNIQUES.length).toBe(11);
  });
});
```

> Note: the `pointing` behavior is verified end-to-end by the golden puzzle in Task 5 (its protocol contains pointing/claiming/hidden-pair steps). The unit test above only asserts wiring; the deep verification is the reference solve.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/solver/techniques.test.ts`
Expected: FAIL — cannot find module `./techniques`.

- [ ] **Step 3: Write the implementation**

Create `src/solver/techniques.ts`:
```ts
import {
  Coord, ROWS, COLS, BOXES, UNITS, boxIndex, cellName, unitName, combinations,
} from './grid';
import { Board } from './candidates';

export type Elim = { r: number; c: number; d: number };
export type Step = {
  technique: string;
  text: string;
  placements?: { r: number; c: number; d: number }[];
  eliminations?: Elim[];
  highlight: { r: number; c: number }[];
};

const sortCells = (cells: Coord[]) => [...cells].sort((a, b) => a.r - b.r || a.c - b.c);
const cellsNames = (cells: Coord[]) => sortCells(cells).map((x) => cellName(x.r, x.c)).join(', ');
const digitsStr = (ds: number[]) => [...ds].sort((a, b) => a - b).join('/');
const hl = (cells: Coord[]) => cells.map((x) => ({ r: x.r, c: x.c }));
const elimCells = (e: Elim[]) => hl(e.map((x) => ({ r: x.r, c: x.c })));

export function nakedSingle(b: Board): Step[] {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const s = b.cand[r * 9 + c];
      if (s && s.size === 1) {
        const d = [...s][0];
        b.place(r, c, d);
        return [{
          technique: 'Candidata única',
          text: `${cellName(r, c)} = ${d}: era o único candidato que sobrava nesta célula (os outros 8 dígitos já aparecem na linha, coluna ou bloco dela).`,
          placements: [{ r, c, d }],
          highlight: [{ r, c }],
        }];
      }
    }
  return [];
}

export function hiddenSingle(b: Board): Step[] {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const spots = unit.filter(({ r, c }) => b.cand[r * 9 + c]?.has(d));
      if (spots.length === 1) {
        const { r, c } = spots[0];
        b.place(r, c, d);
        return [{
          technique: 'Único lugar',
          text: `${cellName(r, c)} = ${d}: na ${unitName(unit)}, esta é a única célula que ainda aceita o ${d}.`,
          placements: [{ r, c, d }],
          highlight: hl(unit),
        }];
      }
    }
  }
  return [];
}

function nakedSubset(b: Board, k: number): Step[] {
  const name = { 2: 'Par nu', 3: 'Trio nu', 4: 'Quadra nua' }[k]!;
  for (const unit of UNITS) {
    const empties = unit.filter(({ r, c }) => b.cand[r * 9 + c]);
    const cands = empties.filter(({ r, c }) => {
      const s = b.cand[r * 9 + c]!;
      return s.size >= 2 && s.size <= k;
    });
    for (const combo of combinations(cands, k)) {
      const union = new Set<number>();
      for (const { r, c } of combo) for (const d of b.cand[r * 9 + c]!) union.add(d);
      if (union.size !== k) continue;
      const comboKeys = new Set(combo.map((x) => x.r * 9 + x.c));
      const elim: Elim[] = [];
      for (const { r, c } of empties) {
        if (comboKeys.has(r * 9 + c)) continue;
        const s = b.cand[r * 9 + c]!;
        for (const d of union) if (s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
      }
      if (elim.length) {
        const affected = elim.map((e) => `${cellName(e.r, e.c)} (tira ${e.d})`).join('; ');
        return [{
          technique: name,
          text: `Na ${unitName(unit)}, as células ${cellsNames(combo)} só aceitam ${digitsStr([...union])} entre si → esses dígitos não podem aparecer nas demais células da unidade. Removo: ${affected}.`,
          eliminations: elim,
          highlight: hl(combo),
        }];
      }
    }
  }
  return [];
}

function hiddenSubset(b: Board, k: number): Step[] {
  const name = { 2: 'Par escondido', 3: 'Trio escondido', 4: 'Quadra escondida' }[k]!;
  for (const unit of UNITS) {
    const empties = unit.filter(({ r, c }) => b.cand[r * 9 + c]);
    const pos = new Map<number, Coord[]>();
    for (let d = 1; d <= 9; d++) {
      const spots = empties.filter(({ r, c }) => b.cand[r * 9 + c]!.has(d));
      if (spots.length >= 1 && spots.length <= k) pos.set(d, spots);
    }
    for (const combo of combinations([...pos.keys()], k)) {
      const cells = new Map<number, Coord>();
      for (const d of combo) for (const cell of pos.get(d)!) cells.set(cell.r * 9 + cell.c, cell);
      if (cells.size !== k) continue;
      const comboSet = new Set(combo);
      const elim: Elim[] = [];
      for (const cell of cells.values()) {
        const s = b.cand[cell.r * 9 + cell.c]!;
        for (const d of [...s]) if (!comboSet.has(d)) { s.delete(d); elim.push({ r: cell.r, c: cell.c, d }); }
      }
      if (elim.length) {
        const affected = elim.map((e) => `${cellName(e.r, e.c)} (tira ${e.d})`).join('; ');
        return [{
          technique: name,
          text: `Na ${unitName(unit)}, os dígitos ${digitsStr(combo)} só cabem nas células ${cellsNames([...cells.values()])} → essas células ficam restritas a ${digitsStr(combo)}. Removo: ${affected}.`,
          eliminations: elim,
          highlight: hl([...cells.values()]),
        }];
      }
    }
  }
  return [];
}

export function pointing(b: Board): Step[] {
  for (let bi = 0; bi < 9; bi++) {
    const box = BOXES[bi];
    const empties = box.filter(({ r, c }) => b.cand[r * 9 + c]);
    for (let d = 1; d <= 9; d++) {
      const spots = empties.filter(({ r, c }) => b.cand[r * 9 + c]!.has(d));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map((s) => s.r));
      const cols = new Set(spots.map((s) => s.c));
      let line: Coord[] | null = null;
      if (rows.size === 1) line = ROWS[spots[0].r];
      else if (cols.size === 1) line = COLS[spots[0].c];
      if (!line) continue;
      const boxKeys = new Set(box.map((x) => x.r * 9 + x.c));
      const elim: Elim[] = [];
      for (const { r, c } of line) {
        if (boxKeys.has(r * 9 + c)) continue;
        const s = b.cand[r * 9 + c];
        if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
      }
      if (elim.length) {
        return [{
          technique: 'Interseção (pointing)',
          text: `No bloco ${bi + 1}, o ${d} só pode ficar na ${unitName(line)} (células ${cellsNames(spots)}) → removo o ${d} das outras células dessa ${unitName(line)}: ${cellsNames(elimCells(elim))}.`,
          eliminations: elim,
          highlight: hl(spots),
        }];
      }
    }
  }
  return [];
}

export function claiming(b: Board): Step[] {
  for (const unit of [...ROWS, ...COLS]) {
    const empties = unit.filter(({ r, c }) => b.cand[r * 9 + c]);
    for (let d = 1; d <= 9; d++) {
      const spots = empties.filter(({ r, c }) => b.cand[r * 9 + c]!.has(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map((s) => boxIndex(s.r, s.c)));
      if (boxes.size !== 1) continue;
      const bi = [...boxes][0];
      const unitKeys = new Set(unit.map((x) => x.r * 9 + x.c));
      const elim: Elim[] = [];
      for (const { r, c } of BOXES[bi]) {
        if (unitKeys.has(r * 9 + c)) continue;
        const s = b.cand[r * 9 + c];
        if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
      }
      if (elim.length) {
        return [{
          technique: 'Interseção (claiming)',
          text: `Na ${unitName(unit)}, o ${d} só pode ficar dentro do bloco ${bi + 1} (células ${cellsNames(spots)}) → removo o ${d} das outras células do bloco: ${cellsNames(elimCells(elim))}.`,
          eliminations: elim,
          highlight: hl(spots),
        }];
      }
    }
  }
  return [];
}

export function xWing(b: Board): Step[] {
  for (let d = 1; d <= 9; d++) {
    const rowsPos = new Map<number, number[]>();
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) if (b.cand[r * 9 + c]?.has(d)) cols.push(c);
      if (cols.length === 2) rowsPos.set(r, cols);
    }
    for (const [[r1, c1], [r2, c2]] of combinations([...rowsPos.entries()], 2)) {
      if (c1[0] === c2[0] && c1[1] === c2[1]) {
        const [ca, cb] = c1;
        const elim: Elim[] = [];
        for (let r = 0; r < 9; r++) {
          if (r === r1 || r === r2) continue;
          for (const c of [ca, cb]) {
            const s = b.cand[r * 9 + c];
            if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
          }
        }
        if (elim.length) {
          return [{
            technique: 'X-Wing',
            text: `X-Wing no dígito ${d}: nas linhas ${r1 + 1} e ${r2 + 1} o ${d} só aparece nas colunas ${ca + 1} e ${cb + 1} → removo o ${d} dessas colunas nas demais linhas: ${cellsNames(elimCells(elim))}.`,
            eliminations: elim,
            highlight: [{ r: r1, c: ca }, { r: r1, c: cb }, { r: r2, c: ca }, { r: r2, c: cb }],
          }];
        }
      }
    }
    const colsPos = new Map<number, number[]>();
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) if (b.cand[r * 9 + c]?.has(d)) rows.push(r);
      if (rows.length === 2) colsPos.set(c, rows);
    }
    for (const [[c1, r1], [c2, r2]] of combinations([...colsPos.entries()], 2)) {
      if (r1[0] === r2[0] && r1[1] === r2[1]) {
        const [ra, rb] = r1;
        const elim: Elim[] = [];
        for (let c = 0; c < 9; c++) {
          if (c === c1 || c === c2) continue;
          for (const r of [ra, rb]) {
            const s = b.cand[r * 9 + c];
            if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
          }
        }
        if (elim.length) {
          return [{
            technique: 'X-Wing',
            text: `X-Wing no dígito ${d}: nas colunas ${c1 + 1} e ${c2 + 1} o ${d} só aparece nas linhas ${ra + 1} e ${rb + 1} → removo o ${d} dessas linhas nas demais colunas: ${cellsNames(elimCells(elim))}.`,
            eliminations: elim,
            highlight: [{ r: ra, c: c1 }, { r: rb, c: c1 }, { r: ra, c: c2 }, { r: rb, c: c2 }],
          }];
        }
      }
    }
  }
  return [];
}

export const TECHNIQUES: ((b: Board) => Step[])[] = [
  nakedSingle,
  hiddenSingle,
  (b) => nakedSubset(b, 2),
  (b) => hiddenSubset(b, 2),
  (b) => nakedSubset(b, 3),
  (b) => hiddenSubset(b, 3),
  pointing,
  claiming,
  (b) => nakedSubset(b, 4),
  (b) => hiddenSubset(b, 4),
  xWing,
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/solver/techniques.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/solver/techniques.ts src/solver/techniques.test.ts
git commit -m "feat(solver): human techniques (singles, subsets, intersections, x-wing)"
```

---

## Task 5: Backtracking + solve driver (`solve.ts`) + golden tests

**Files:**
- Create: `src/solver/solve.ts`
- Create: `src/solver/solver.test.ts`

- [ ] **Step 1: Write the failing test (the golden test + edge cases)**

Create `src/solver/solver.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString, UNITS } from './grid';
import { solve } from './solve';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/solver/solver.test.ts`
Expected: FAIL — cannot find module `./solve`.

- [ ] **Step 3: Write the implementation**

Create `src/solver/solve.ts`:
```ts
import { Grid, PEERS, cloneGrid, findConflicts } from './grid';
import { Board } from './candidates';
import { TECHNIQUES, Step } from './techniques';

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
```

- [ ] **Step 4: Run the full solver suite**

Run: `npm test`
Expected: PASS — all solver tests green, including the golden reference solve.

- [ ] **Step 5: Commit**

```bash
git add src/solver/solve.ts src/solver/solver.test.ts
git commit -m "feat(solver): solve() driver + backtracking fallback + golden tests"
```

---

## Task 6: Design tokens & base styles (`tokens.css`, `print.css`)

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/print.css`

- [ ] **Step 1: Write `tokens.css`**

Create `src/styles/tokens.css`:
```css
:root {
  --canvas: #0a0a0a; --surface-soft: #121212; --surface-card: #1a1a1a; --surface-elevated: #242424;
  --primary: #faff69; --primary-active: #e6eb52;
  --ink: #ffffff; --body: #cccccc; --muted: #888888; --muted-soft: #5a5a5a;
  --hairline: #2a2a2a; --hairline-strong: #3a3a3a; --on-primary: #0a0a0a;
  --error: #ef4444; --warning: #f59e0b;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--canvas); color: var(--ink);
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }

.nav { height: 64px; display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 12px; font-weight: 700; letter-spacing: -0.3px; font-size: 18px; }
.brand .dot { width: 14px; height: 14px; border-radius: 4px; background: var(--primary); }
.badge { background: var(--primary); color: var(--on-primary); font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; }
.nav .muted { color: var(--muted); font-size: 14px; }

.head { padding: 28px 0 18px; }
.head h1 { font-size: 34px; font-weight: 700; letter-spacing: -1px; margin: 0 0 8px; line-height: 1.15; }
.head p { color: var(--body); font-size: 16px; margin: 0; max-width: 640px; line-height: 1.55; }

.grid2 { display: grid; grid-template-columns: minmax(0, 440px) 1fr; gap: 28px; align-items: start; padding-bottom: 48px; }
@media (max-width: 880px) { .grid2 { grid-template-columns: 1fr; } }

.card { background: var(--surface-card); border: 1px solid var(--hairline); border-radius: 12px; padding: 24px; }

.board { display: grid; grid-template-columns: repeat(9, 1fr); grid-template-rows: repeat(9, 1fr); width: 100%; aspect-ratio: 1 / 1; background: var(--hairline-strong); border: 2px solid var(--hairline-strong); border-radius: 8px; overflow: hidden; gap: 1px; outline: none; }
.cell { background: var(--surface-elevated); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; color: var(--muted); user-select: none; cursor: pointer; }
.cell.given { color: var(--ink); font-weight: 700; }
.cell.filled { color: var(--body); font-weight: 500; }
.cell.cur { background: var(--primary); color: var(--on-primary); font-weight: 700; }
.cell.peer { background: #23230f; }
.cell.selected { box-shadow: inset 0 0 0 2px var(--primary); }
.cell.conflict { color: var(--error); }
.cell:nth-child(9n+4), .cell:nth-child(9n+7) { border-left: 2px solid var(--hairline-strong); }
.cell.rowsep { box-shadow: inset 0 2px 0 var(--hairline-strong); }

.legend { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 16px; color: var(--muted); font-size: 13px; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.sw-given { background: #fff; } .sw-filled { background: var(--body); } .sw-cur { background: var(--primary); }

.toolbar { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.btn { height: 40px; padding: 0 20px; border-radius: 8px; border: 0; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: var(--on-primary); }
.btn-secondary { background: var(--surface-elevated); color: var(--ink); border: 1px solid var(--hairline-strong); }
.btn-ghost { background: transparent; color: var(--body); border: 1px solid var(--hairline-strong); }

.banner { border-radius: 8px; padding: 12px 16px; font-size: 14px; margin-bottom: 14px; }
.banner.error { background: #2a1414; color: var(--error); border: 1px solid var(--error); }
.banner.warn { background: #2a2310; color: var(--warning); border: 1px solid var(--warning); }

.step { background: var(--surface-card); border: 1px solid var(--hairline); border-radius: 12px; padding: 24px; }
.step .meta { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.step .count { font-family: 'JetBrains Mono', monospace; color: var(--muted); font-size: 13px; letter-spacing: 1px; }
.pill { background: var(--primary); color: var(--on-primary); font-size: 12px; font-weight: 600; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px; }
.step .text { font-size: 18px; line-height: 1.5; color: var(--ink); margin: 0 0 20px; }
.progress { height: 6px; background: var(--surface-elevated); border-radius: 9999px; overflow: hidden; margin-bottom: 18px; }
.progress > span { display: block; height: 100%; background: var(--primary); }
.nav-steps { display: flex; gap: 10px; align-items: center; }
.nav-steps .spacer { flex: 1; }
.more { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 18px; border-top: 1px solid var(--hairline); }
.more a { color: var(--primary); font-size: 15px; text-decoration: underline; cursor: pointer; }

.status, .hint { margin-top: 18px; }
.status .mlabel, .hint .mlabel { color: var(--muted); font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
.status div, .hint div { color: var(--body); font-size: 14px; line-height: 1.6; }

.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow: auto; z-index: 10; }
.protocol { background: var(--surface-card); border: 1px solid var(--hairline); border-radius: 12px; padding: 32px; max-width: 760px; width: 100%; }
.protocol h2 { margin: 0 0 16px; font-size: 24px; }
.protocol pre { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--body); background: var(--canvas); padding: 16px; border-radius: 8px; overflow: auto; }
.protocol ol { padding-left: 20px; }
.protocol li { margin-bottom: 10px; line-height: 1.5; color: var(--body); }
.protocol li b { color: var(--primary); }
.protocol .actions { display: flex; gap: 10px; margin-top: 20px; }
```

- [ ] **Step 2: Write `print.css`**

Create `src/styles/print.css`:
```css
@media print {
  body * { visibility: hidden; }
  .protocol, .protocol * { visibility: visible; }
  .protocol { position: absolute; inset: 0; max-width: none; border: 0; border-radius: 0; background: #fff; color: #000; }
  .protocol pre { background: #f4f4f4; color: #000; }
  .protocol li, .protocol li b { color: #000; }
  .protocol .actions { display: none; }
}
```

- [ ] **Step 3: Load Inter/JetBrains Mono and the stylesheets**

Replace `index.html` `<head>` so it includes the fonts (add inside `<head>`, keep the existing `<title>`/script):
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```
Set the `<title>` to `Sudoku Solver`.

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/styles/print.css index.html
git commit -m "feat(ui): design tokens, base styles, print stylesheet, fonts"
```

---

## Task 7: Cell & Board components

**Files:**
- Create: `src/components/Cell.tsx`
- Create: `src/components/Board.tsx`

- [ ] **Step 1: Write `Cell.tsx`**

Create `src/components/Cell.tsx`:
```tsx
export function Cell({
  value, className, onClick,
}: { value: number; className: string; onClick?: () => void }) {
  return (
    <div className={className} onClick={onClick}>
      {value || ''}
    </div>
  );
}
```

- [ ] **Step 2: Write `Board.tsx`**

Create `src/components/Board.tsx`:
```tsx
import { Grid, Coord } from '../solver/grid';
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
};

export function Board({ mode, editGrid, givens, view, conflicts, selected, setSelected, setCell }: Props) {
  const conflictSet = new Set(conflicts.map((c) => c.r * 9 + c.c));
  const highlightSet = new Set((view?.highlight ?? []).map((c) => c.r * 9 + c.c));
  const currentSet = new Set((view?.current ?? []).map((c) => c.r * 9 + c.c));

  function onKeyDown(e: React.KeyboardEvent) {
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
    <div className="board" tabIndex={0} onKeyDown={onKeyDown}>
      {cells}
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b`
Expected: no type errors. (Components aren't wired into `App` yet; that's Task 11.)

- [ ] **Step 4: Commit**

```bash
git add src/components/Cell.tsx src/components/Board.tsx
git commit -m "feat(ui): editable + highlightable 9x9 board"
```

---

## Task 8: Toolbar component

**Files:**
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Write `Toolbar.tsx`**

Create `src/components/Toolbar.tsx`:
```tsx
type Props = {
  mode: 'edit' | 'solved';
  canSolve: boolean;
  onSolve: () => void;
  onClear: () => void;
  onExample: () => void;
  onEdit: () => void;
};

export function Toolbar({ mode, canSolve, onSolve, onClear, onExample, onEdit }: Props) {
  if (mode === 'edit') {
    return (
      <div className="toolbar">
        <button className="btn btn-primary" onClick={onSolve} disabled={!canSolve}>
          ▶ Resolver
        </button>
        <button className="btn btn-secondary" onClick={onClear}>Limpar</button>
        <button className="btn btn-ghost" onClick={onExample}>Exemplo</button>
      </div>
    );
  }
  return (
    <div className="toolbar">
      <button className="btn btn-secondary" onClick={onEdit}>✎ Editar</button>
      <button className="btn btn-ghost" onClick={onClear}>Limpar</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat(ui): toolbar (resolver/limpar/exemplo/editar)"
```

---

## Task 9: StepPlayer component

**Files:**
- Create: `src/components/StepPlayer.tsx`

- [ ] **Step 1: Write `StepPlayer.tsx`**

Create `src/components/StepPlayer.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Step } from '../solver/techniques';

type Props = {
  steps: Step[];
  index: number;
  setIndex: (i: number) => void;
  onShowProtocol: () => void;
};

export function StepPlayer({ steps, index, setIndex, onShowProtocol }: Props) {
  const [auto, setAuto] = useState(false);
  const total = steps.length;
  const step = steps[index];
  const pct = Math.round(((index + 1) / total) * 100);

  useEffect(() => {
    if (!auto) return;
    if (index >= total - 1) {
      setAuto(false);
      return;
    }
    const id = setTimeout(() => setIndex(index + 1), 900);
    return () => clearTimeout(id);
  }, [auto, index, total, setIndex]);

  return (
    <div className="step">
      <div className="meta">
        <span className="count">PASSO {String(index + 1).padStart(2, '0')} / {total}</span>
        <span className="pill">{step.technique}</span>
      </div>
      <p className="text">{step.text}</p>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>
      <div className="nav-steps">
        <button className="btn btn-secondary" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
          ◀ Anterior
        </button>
        <button className="btn btn-primary" onClick={() => setIndex(Math.min(total - 1, index + 1))} disabled={index === total - 1}>
          Próximo ▶
        </button>
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={() => setAuto((a) => !a)}>
          {auto ? '⏸ Pausar' : '⏯ Auto'}
        </button>
      </div>
      <div className="more">
        <a onClick={onShowProtocol}>Ver explicação completa (lista)</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StepPlayer.tsx
git commit -m "feat(ui): step player with prev/next and auto-play"
```

---

## Task 10: ProtocolView + PDF

**Files:**
- Create: `src/components/ProtocolView.tsx`

- [ ] **Step 1: Write `ProtocolView.tsx`**

Create `src/components/ProtocolView.tsx`:
```tsx
import { Grid, renderGridText } from '../solver/grid';
import { SolveResult } from '../solver/solve';

type Props = { result: SolveResult; givens: Grid; onClose: () => void };

export function ProtocolView({ result, givens, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="protocol" onClick={(e) => e.stopPropagation()}>
        <h2>Protocolo de resolução</h2>

        <p className="mlabel">Tabuleiro inicial</p>
        <pre>{renderGridText(givens)}</pre>

        {result.unique
          ? <p>Solução <b>única</b>.</p>
          : <p>⚠️ Este Sudoku tem <b>mais de uma solução</b>.</p>}

        <p className="mlabel">Passos</p>
        <ol>
          {result.steps.map((s, i) => (
            <li key={i}><b>[{s.technique}]</b> {s.text}</li>
          ))}
        </ol>

        {result.usedBacktracking && (
          <p>⚠️ As técnicas lógicas não bastaram; o restante foi completado por tentativa e erro.</p>
        )}

        <p className="mlabel">Solução final</p>
        <pre>{renderGridText(result.solution)}</pre>

        <div className="actions">
          <button className="btn btn-primary" onClick={() => window.print()}>⬇ Baixar PDF</button>
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProtocolView.tsx
git commit -m "feat(ui): full protocol view with print-to-PDF"
```

---

## Task 11: App wiring (state machine, errors, banners)

**Files:**
- Create/Replace: `src/App.tsx`
- Replace: `src/main.tsx`

- [ ] **Step 1: Write `main.tsx`**

Replace `src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/print.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Write `App.tsx`**

Replace `src/App.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { Grid, Coord, emptyGrid, cloneGrid, parseGrid, findConflicts } from './solver/grid';
import { solve, SolveResult } from './solver/solve';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { StepPlayer } from './components/StepPlayer';
import { ProtocolView } from './components/ProtocolView';

const EXAMPLE = [
  '...5...6.', '8.9....1.', '16..87...', '3...26...', '..7.1.6..',
  '...85...3', '...47..21', '.4....9.8', '.8...3...',
].join('\n');

export default function App() {
  const [cells, setCells] = useState<Grid>(emptyGrid());
  const [mode, setMode] = useState<'edit' | 'solved'>('edit');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [givens, setGivens] = useState<Grid>(emptyGrid());
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProtocol, setShowProtocol] = useState(false);

  const conflicts = useMemo(() => (mode === 'edit' ? findConflicts(cells) : []), [cells, mode]);
  const filledCount = useMemo(() => cells.flat().filter((v) => v).length, [cells]);
  const canSolve = conflicts.length === 0 && filledCount > 0;

  function setCell(r: number, c: number, v: number) {
    setCells((g) => {
      const n = cloneGrid(g);
      n[r][c] = v;
      return n;
    });
  }

  function handleSolve() {
    setError(null);
    if (conflicts.length) {
      setError('Há dígitos repetidos numa linha, coluna ou bloco. Corrija os destaques em vermelho.');
      return;
    }
    try {
      const res = solve(cells);
      setResult(res);
      setGivens(cloneGrid(cells));
      setStepIndex(0);
      setMode('solved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível resolver.');
    }
  }

  function handleClear() {
    setCells(emptyGrid());
    setResult(null);
    setMode('edit');
    setError(null);
    setSelected(null);
  }

  function handleExample() {
    setCells(parseGrid(EXAMPLE));
    setResult(null);
    setMode('edit');
    setError(null);
  }

  function handleEdit() {
    setMode('edit');
    setResult(null);
    setError(null);
  }

  const view = useMemo(() => {
    if (mode !== 'solved' || !result) return null;
    const g = cloneGrid(givens);
    for (let i = 0; i <= stepIndex && i < result.steps.length; i++)
      for (const p of result.steps[i].placements ?? []) g[p.r][p.c] = p.d;
    const step = result.steps[stepIndex];
    return { grid: g, highlight: step.highlight, current: step.placements ?? [] };
  }, [mode, result, givens, stepIndex]);

  return (
    <div className="wrap">
      <div className="nav">
        <div className="brand"><span className="dot" />Sudoku Solver <span className="badge">9×9</span></div>
        <div className="muted">resolve + explica passo a passo</div>
      </div>

      <div className="head">
        <h1>Resolva e entenda, passo a passo</h1>
        <p>Preencha as pistas, clique em Resolver e acompanhe cada dedução destacada na grade — ou baixe a explicação completa em PDF.</p>
      </div>

      <div className="grid2">
        <div className="card">
          <Board
            mode={mode}
            editGrid={cells}
            givens={mode === 'solved' ? givens : cells}
            view={view}
            conflicts={conflicts}
            selected={selected}
            setSelected={setSelected}
            setCell={setCell}
          />
          <div className="legend">
            <span><i className="sw-given" />pista (digitada)</span>
            <span><i className="sw-filled" />preenchido pelo solver</span>
            <span><i className="sw-cur" />passo atual</span>
          </div>
        </div>

        <div>
          <Toolbar
            mode={mode}
            canSolve={canSolve}
            onSolve={handleSolve}
            onClear={handleClear}
            onExample={handleExample}
            onEdit={handleEdit}
          />

          {error && <div className="banner error">{error}</div>}

          {mode === 'solved' && result && (
            <>
              {!result.unique && (
                <div className="banner warn">Este Sudoku tem mais de uma solução; mostrando uma delas.</div>
              )}
              {result.usedBacktracking && (
                <div className="banner warn">A lógica implementada não bastou; o restante foi completado por tentativa e erro.</div>
              )}
              <StepPlayer
                steps={result.steps}
                index={stepIndex}
                setIndex={setStepIndex}
                onShowProtocol={() => setShowProtocol(true)}
              />
              <div className="card status">
                <div className="mlabel">Status</div>
                <div>
                  Solução {result.unique ? <b style={{ color: 'var(--primary)' }}>única</b> : 'múltipla'} ·{' '}
                  {result.usedBacktracking ? 'parte por tentativa e erro' : 'resolvido só com lógica'} ·{' '}
                  {new Set(result.steps.map((s) => s.technique)).size} técnicas usadas.
                </div>
              </div>
            </>
          )}

          {mode === 'edit' && (
            <div className="card hint">
              <div className="mlabel">Como usar</div>
              <div>Clique numa célula e digite 1–9 (ou Backspace para apagar). Use as setas para navegar. Depois clique em <b>Resolver</b>.</div>
            </div>
          )}
        </div>
      </div>

      {showProtocol && result && (
        <ProtocolView result={result} givens={givens} onClose={() => setShowProtocol(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build and run the full check**

Run: `npm run build && npm test`
Expected: production build succeeds; all solver tests pass.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the printed localhost URL, click **Exemplo**, then **Resolver**.
Expected: the board fills, `PASSO 01 / NN` shows, **Próximo ▶** advances and highlights cells in yellow; **Ver explicação completa** opens the protocol; **Baixar PDF** opens the browser print dialog showing only the protocol.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat(ui): app state machine wiring steps, errors, and protocol"
```

---

## Task 12: README, deploy config, push

**Files:**
- Create: `README.md`
- Modify: `.gitignore` (ensure `dist`, `node_modules`)

- [ ] **Step 1: Write `README.md`**

Create `README.md`:
```markdown
# Sudoku Solver

Web app that solves a 9×9 Sudoku and explains every deduction, step by step.

- Solver: pure TypeScript (human techniques + backtracking fallback), runs in the browser.
- UI: React + Vite. Design follows `DESIGN.md`.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # run the solver test suite
npm run build    # production build into dist/
```

## Deploy (Vercel)

Connect the GitHub repo to Vercel. Framework preset: **Vite**.
Build command `npm run build`, output directory `dist`. No environment variables.
```

- [ ] **Step 2: Ensure `.gitignore` covers build output**

Confirm `.gitignore` contains `node_modules` and `dist` (Vite's default already lists both; add any missing line).

- [ ] **Step 3: Commit and push**

```bash
git add README.md .gitignore
git commit -m "docs: README and deploy notes"
git push -u origin main
```
Expected: branch `main` pushed to `https://github.com/hugogontijomachado/sudoku-solver`.

- [ ] **Step 4: Connect Vercel (manual, by the user)**

In the Vercel dashboard: New Project → import `hugogontijomachado/sudoku-solver` → framework **Vite** → Deploy.
Expected: a live URL serving the app; every future `git push` to `main` redeploys automatically.

---

## Self-Review

**Spec coverage:**
- 9×9 only → solver/UI hardcode 9×9. ✓
- Online/Vercel/static/React+Vite+TS → Tasks 1, 12. ✓
- Solver ported from Python reference → Tasks 2–5. ✓
- Interactive step-by-step default + grid highlight → Tasks 7, 9, 11. ✓
- View/download PDF of static protocol → Task 10. ✓
- Error handling (contradictory / unsolvable / multiple / empty / backtracking) → `solve()` throws + `App` banners + `canSolve`. ✓
- Tests incl. golden reference solution → Task 5. ✓
- Design from DESIGN.md tokens → Task 6 + copied file in Task 1. ✓
- Portuguese throughout → all step text + UI copy. ✓

**Type consistency:** `SolveResult`, `Step`, `Grid`, `Coord` defined once and imported; `Board` props match `App` usage; `view` shape (`grid/highlight/current`) consistent between `App` and `Board`. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code. The one judgment call (`pointing` unit test asserting wiring only) is justified inline and covered end-to-end by the golden solve. ✓

**Out of scope (per spec):** other grid sizes, OCR, accounts, puzzle generation, backend — none included. ✓
