# Sudoku Solver — Round 2 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 changes: a generated random-puzzle pool (100/difficulty) with an `Aleatório ▾` picker, a mobile step-card baseline height, protocol-modal close affordances, the auto-mode mobile layout-shift fix, and a "Conferir" solve-it-yourself mode with live green/red verification.

**Architecture:** A Python generator in the `sudoku/` skill repo (reusing `sudoku_solver.py`) bakes `src/data/puzzles.json`, loaded on demand via dynamic `import()`. The React app gains a `play` mode and small focused components/hooks; all visuals use `DESIGN.md` tokens in `tokens.css`.

**Tech Stack:** React 19, Vite 8, TS 6 (strict), Vitest 4; Python 3 (stdlib only) for the generator.

## Global Constraints

- Type-only imports MUST use `import type` (`verbatimModuleSyntax`).
- No unused locals/params (`noUnusedLocals`, `noUnusedParameters`); remove imports that stop being used.
- `*.test.ts` under `src/` ARE type-checked by `tsc -b`.
- React 19 JSX: no `import React`; React types via `import type { X } from 'react'`.
- All UI copy in Portuguese. Colors via `var(--token)`; never inline hex in components.
- No new npm dependencies. Generator uses Python stdlib only.
- App commands run in `/Users/hugocemep/GitHub/sudoku-solver`; generator in `/Users/hugocemep/GitHub/sudoku/sudoku/scripts`.
- Gate each task on `npx tsc -b` clean + `npm test` green; final task adds `npm run build`.

---

### Task 1: Puzzle generator + difficulty grading (Python, TDD)

**Files:**
- Create: `/Users/hugocemep/GitHub/sudoku/sudoku/scripts/generate_pool.py`
- Test: `/Users/hugocemep/GitHub/sudoku/sudoku/scripts/test_generate_pool.py`

**Interfaces:**
- Produces: `classify(techniques_used: list[str], used_backtracking: bool) -> str` (`'easy'|'medium'|'hard'|'evil'`); `grade(grid) -> str | None`; `full_solution() -> grid`; `make_puzzle(max_remove: int) -> grid`.

- [ ] **Step 1: Write the failing test** — `test_generate_pool.py`:

```python
import unittest
from generate_pool import classify, grade
from sudoku_solver import parse_grid

PUZZLE = "".join([
    "...5...6.", "8.9....1.", "16..87...", "3...26...", "..7.1.6..",
    "...85...3", "...47..21", ".4....9.8", ".8...3...",
])

class TestClassify(unittest.TestCase):
    def test_singles_only_is_easy(self):
        self.assertEqual(classify(["Candidata única", "Único lugar"], False), "easy")

    def test_subset_is_medium(self):
        self.assertEqual(classify(["Candidata única", "Par escondido"], False), "medium")

    def test_xwing_is_hard(self):
        self.assertEqual(classify(["Único lugar", "X-Wing"], False), "hard")

    def test_backtracking_is_evil(self):
        self.assertEqual(classify(["Candidata única"], True), "evil")

class TestGrade(unittest.TestCase):
    def test_reference_puzzle_is_medium(self):
        # reference puzzle uses the hidden pair ("Par escondido"), no X-Wing, no backtracking
        self.assertEqual(grade(parse_grid(PUZZLE)), "medium")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/hugocemep/GitHub/sudoku/sudoku/scripts && python3 -m unittest test_generate_pool -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'generate_pool'`.

- [ ] **Step 3: Implement `generate_pool.py`**

```python
#!/usr/bin/env python3
"""Generate unique 9x9 Sudoku puzzles graded by difficulty using sudoku_solver.py.
Writes JSON {easy,medium,hard,evil: [81-char clue strings, '.'=empty]}.
Usage: python3 generate_pool.py [--target N] [--out PATH] [--cap-seconds S]"""
import argparse, copy, json, random, sys, time
from sudoku_solver import solve, count_solutions, grid_to_string, parse_grid  # noqa: F401

EASY = {"Candidata única", "Único lugar"}
HARD = {"X-Wing"}

def classify(techniques_used, used_backtracking):
    if used_backtracking:
        return "evil"
    used = set(techniques_used)
    if used & HARD:
        return "hard"
    if used and used <= EASY:
        return "easy"
    return "medium"

def grade(grid):
    res = solve(copy.deepcopy(grid), check_unique=False)
    if not res.solved:
        return None
    return classify(res.techniques_used, res.used_backtracking)

def full_solution():
    grid = [[0] * 9 for _ in range(9)]
    def fits(r, c, d):
        if any(grid[r][k] == d for k in range(9)): return False
        if any(grid[k][c] == d for k in range(9)): return False
        br, bc = 3 * (r // 3), 3 * (c // 3)
        return all(grid[br + i][bc + j] != d for i in range(3) for j in range(3))
    def fill(pos=0):
        if pos == 81:
            return True
        r, c = divmod(pos, 9)
        ds = list(range(1, 10)); random.shuffle(ds)
        for d in ds:
            if fits(r, c, d):
                grid[r][c] = d
                if fill(pos + 1):
                    return True
                grid[r][c] = 0
        return False
    fill()
    return grid

def make_puzzle(max_remove):
    sol = full_solution()
    puzzle = [row[:] for row in sol]
    cells = list(range(81)); random.shuffle(cells)
    removed = 0
    for k in cells:
        if removed >= max_remove:
            break
        r, c = divmod(k, 9)
        if puzzle[r][c] == 0:
            continue
        saved = puzzle[r][c]
        puzzle[r][c] = 0
        cnt, _ = count_solutions(puzzle, 2)
        if cnt != 1:
            puzzle[r][c] = saved  # removal broke uniqueness — restore
        else:
            removed += 1
    return puzzle

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=100)
    ap.add_argument("--out", default="puzzles.json")
    ap.add_argument("--cap-seconds", type=float, default=600)
    args = ap.parse_args()
    random.seed(12345)
    buckets = {"easy": [], "medium": [], "hard": [], "evil": []}
    remove_choices = [40, 48, 54, 58]
    start = time.time(); attempts = 0
    while any(len(v) < args.target for v in buckets.values()):
        if time.time() - start > args.cap_seconds:
            print(f"cap-seconds reached after {attempts} attempts", file=sys.stderr)
            break
        attempts += 1
        puzzle = make_puzzle(random.choice(remove_choices))
        g = grade(puzzle)
        if g and len(buckets[g]) < args.target:
            buckets[g].append(grid_to_string(puzzle).replace("0", "."))
        if attempts % 50 == 0:
            print({k: len(v) for k, v in buckets.items()}, "attempts", attempts, file=sys.stderr)
    print("FINAL COUNTS:", {k: len(v) for k, v in buckets.items()}, "attempts", attempts, file=sys.stderr)
    with open(args.out, "w") as f:
        json.dump(buckets, f, separators=(",", ":"))
    print(args.out)

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/hugocemep/GitHub/sudoku/sudoku/scripts && python3 -m unittest test_generate_pool -v`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit** (the `sudoku/` repo is NOT under git; if it later is, commit there. The solver repo gets the JSON in Task 2.) Skip git here; just confirm the files exist:

Run: `ls -l /Users/hugocemep/GitHub/sudoku/sudoku/scripts/generate_pool.py`
Expected: file present.

---

### Task 2: Generate the puzzle pool → `src/data/puzzles.json`

**Files:**
- Create: `/Users/hugocemep/GitHub/sudoku-solver/src/data/puzzles.json` (generated artifact)

- [ ] **Step 1: Run the generator** (may take several minutes; cap is 10 min)

Run:
```bash
mkdir -p /Users/hugocemep/GitHub/sudoku-solver/src/data
cd /Users/hugocemep/GitHub/sudoku/sudoku/scripts && \
python3 generate_pool.py --target 100 --cap-seconds 600 \
  --out /Users/hugocemep/GitHub/sudoku-solver/src/data/puzzles.json
```
Expected: stderr ends with `FINAL COUNTS: {...}`. Note the real per-bucket counts.

- [ ] **Step 2: Sanity-check the JSON** (each entry is 81 chars; report counts)

Run:
```bash
cd /Users/hugocemep/GitHub/sudoku-solver && node -e "
const p=require('./src/data/puzzles.json');
for(const k of Object.keys(p)){const bad=p[k].filter(s=>s.length!==81);
console.log(k, p[k].length, 'bad-length:', bad.length);}"
```
Expected: 4 buckets listed, each `bad-length: 0`. Counts may be < 100 for `hard`/`evil` — record the actual numbers (no silent truncation; report them to the user).

- [ ] **Step 3: Commit**

```bash
cd /Users/hugocemep/GitHub/sudoku-solver
git add src/data/puzzles.json
git commit -m "feat(data): generated puzzle pool (easy/medium/hard/evil) via solver grading"
```

---

### Task 3: `Aleatório ▾` picker + on-demand loader + example-as-default

**Files:**
- Create: `src/data/loadPuzzles.ts`
- Create: `src/components/DifficultyMenu.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/tokens.css` (dropdown styles)
- Modify: `tsconfig.app.json` (ensure `resolveJsonModule`)

**Interfaces:**
- Produces: `Difficulty = 'easy'|'medium'|'hard'|'evil'`; `loadRandomPuzzle(d: Difficulty): Promise<string>`; `DifficultyMenu` props `{ onSelect: (d: Difficulty) => void; disabled?: boolean }`.
- `Toolbar` props become `{ mode; canSolve; canCheck; loading; onSolve; onCheck; onClear; onEdit; onRandom }` (consumed in later tasks too).

- [ ] **Step 1: Ensure `resolveJsonModule`** — open `tsconfig.app.json`; if `"resolveJsonModule": true` is absent from `compilerOptions`, add it.

Run: `cd /Users/hugocemep/GitHub/sudoku-solver && grep resolveJsonModule tsconfig.app.json || echo MISSING`
If `MISSING`, add `"resolveJsonModule": true,` inside `compilerOptions`.

- [ ] **Step 2: Create `src/data/loadPuzzles.ts`**

```ts
export type Difficulty = 'easy' | 'medium' | 'hard' | 'evil';
type Pool = Record<Difficulty, string[]>;

let cache: Pool | null = null;

export async function loadRandomPuzzle(diff: Difficulty): Promise<string> {
  if (!cache) {
    const mod = await import('./puzzles.json');
    cache = (mod.default ?? mod) as unknown as Pool;
  }
  const list = cache[diff];
  if (!list || list.length === 0) throw new Error(`Sem puzzles para ${diff}`);
  return list[Math.floor(Math.random() * list.length)];
}
```

- [ ] **Step 3: Create `src/components/DifficultyMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Difficulty } from '../data/loadPuzzles';

const ITEMS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Fácil' },
  { key: 'medium', label: 'Médio' },
  { key: 'hard', label: 'Difícil' },
  { key: 'evil', label: 'Evil' },
];

export function DifficultyMenu({ onSelect, disabled }: { onSelect: (d: Difficulty) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => setOpen((o) => !o)}>
        Aleatório ▾
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {ITEMS.map((it) => (
            <button
              key={it.key}
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => { setOpen(false); onSelect(it.key); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `Toolbar.tsx`** to the new props (Conferir + Aleatório in edit mode; `play`/`solved` show Editar/Limpar):

```tsx
import { DifficultyMenu } from './DifficultyMenu';
import type { Difficulty } from '../data/loadPuzzles';

type Props = {
  mode: 'edit' | 'solved' | 'play';
  canSolve: boolean;
  canCheck: boolean;
  loading: boolean;
  onSolve: () => void;
  onCheck: () => void;
  onClear: () => void;
  onEdit: () => void;
  onRandom: (d: Difficulty) => void;
};

export function Toolbar({ mode, canSolve, canCheck, loading, onSolve, onCheck, onClear, onEdit, onRandom }: Props) {
  if (mode === 'edit') {
    return (
      <div className="toolbar">
        <button className="btn btn-primary" onClick={onSolve} disabled={!canSolve}>▶ Resolver</button>
        <button className="btn btn-secondary" onClick={onCheck} disabled={!canCheck}>✔ Conferir</button>
        <button className="btn btn-ghost" onClick={onClear}>Limpar</button>
        <DifficultyMenu onSelect={onRandom} disabled={loading} />
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

- [ ] **Step 5: Wire App** — in `src/App.tsx`:
  - Change initial state: `const [cells, setCells] = useState<Grid>(() => parseGrid(EXAMPLE));`
  - Add `import { loadRandomPuzzle } from './data/loadPuzzles';` and `import type { Difficulty } from './data/loadPuzzles';`
  - Add `const [loading, setLoading] = useState(false);`
  - Add the handler:

```tsx
async function handleRandom(d: Difficulty) {
  setLoading(true);
  try {
    const puzzle = await loadRandomPuzzle(d);
    setCells(parseGrid(puzzle));
    setResult(null);
    setMode('edit');
    setError(null);
    setSelected(null);
  } catch {
    setError('Não foi possível carregar um puzzle aleatório.');
  } finally {
    setLoading(false);
  }
}
```

  - Update the `<Toolbar ... />` usage: remove `onExample`; add `canCheck`, `loading`, `onCheck`, `onRandom`. (`canCheck`/`onCheck` are finalized in Task 8 — for now pass `canCheck={false}` and `onCheck={() => {}}` so this task compiles independently.)
  - Delete the now-unused `handleExample` function.

- [ ] **Step 6: Add dropdown styles** — append to `src/styles/tokens.css`:

```css
.dropdown { position: relative; display: inline-block; }
.dropdown-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; min-width: 160px;
  background: var(--surface-card); border: 1px solid var(--hairline-strong);
  border-radius: 8px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}
.dropdown-item {
  text-align: left; background: transparent; border: 0; color: var(--ink);
  font-family: inherit; font-size: 14px; font-weight: 500; padding: 8px 12px;
  border-radius: 6px; cursor: pointer;
}
.dropdown-item:hover { background: var(--surface-elevated); }
```

- [ ] **Step 7: Type-check + test**

Run: `npx tsc -b && npm test`
Expected: tsc clean; tests still green.

- [ ] **Step 8: Commit**

```bash
git add src/data/loadPuzzles.ts src/components/DifficultyMenu.tsx src/components/Toolbar.tsx src/App.tsx src/styles/tokens.css tsconfig.app.json
git commit -m "feat(ui): example-as-default + Aleatório dropdown loading puzzles on demand"
```

---

### Task 4: Auto-mode layout-shift fix (item 4) + mobile step-card baseline (item 1)

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/StepPlayer.tsx` (fixed-width toggle button)

- [ ] **Step 1: Fix the mobile grid blowout + add mobile step min-height** — in `src/styles/tokens.css`, replace the mobile grid rule:

Find: `@media (max-width: 880px) { .grid2 { grid-template-columns: 1fr; } }`
Replace with:
```css
@media (max-width: 880px) {
  .grid2 { grid-template-columns: minmax(0, 1fr); }
  .step { min-height: 300px; }
}
```

- [ ] **Step 2: Give the Auto/Pausar toggle a fixed width** — in `src/components/StepPlayer.tsx`, change the toggle button to a stable width so the label swap can't reflow the row:

```tsx
<button className="btn btn-ghost auto-toggle" onClick={() => setAuto((a) => !a)}>
  {auto ? '⏸ Pausar' : '⏯ Auto'}
</button>
```

And append the rule to `src/styles/tokens.css`:
```css
.auto-toggle { min-width: 116px; justify-content: center; }
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/components/StepPlayer.tsx
git commit -m "fix(ui): stop mobile layout shift on Auto toggle; baseline step-card height on mobile"
```

(Runtime regression for this is asserted in Task 9.)

---

### Task 5: Protocol modal close affordances (item 2)

**Files:**
- Modify: `src/components/ProtocolView.tsx`
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add the ✕ button and Esc-to-close** — rewrite `src/components/ProtocolView.tsx`:

```tsx
import { useEffect } from 'react';
import { renderGridText } from '../solver/grid';
import type { Grid } from '../solver/grid';
import type { SolveResult } from '../solver/solve';

type Props = { result: SolveResult; givens: Grid; onClose: () => void };

export function ProtocolView({ result, givens, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="protocol" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
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

- [ ] **Step 2: Style the ✕** — append to `src/styles/tokens.css` (and make `.protocol` a positioning context):

```css
.protocol { position: relative; }
.modal-close {
  position: absolute; top: 16px; right: 16px; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-elevated); color: var(--body);
  border: 1px solid var(--hairline-strong); border-radius: 8px;
  font-size: 16px; cursor: pointer;
}
.modal-close:hover { color: var(--ink); background: var(--surface-card); }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProtocolView.tsx src/styles/tokens.css
git commit -m "feat(ui): protocol modal close button (top-right X) and Esc-to-close"
```

---

### Task 6: `playStatus` helper + validity memo refactor (item 5 core, TDD)

**Files:**
- Create: `src/solver/play.ts`
- Test: `src/solver/play.test.ts`
- Modify: `src/App.tsx` (replace `solvable` memo with a `validity` memo)

**Interfaces:**
- Produces: `playStatus(playGrid: Grid, givens: Grid, solution: Grid): { correct: Set<number>; wrong: Set<number>; complete: boolean }`.

- [ ] **Step 1: Write the failing test** — `src/solver/play.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { emptyGrid } from './grid';
import { playStatus } from './play';

function gridFrom(rows: number[][]) { return rows.map((r) => r.slice()); }

describe('playStatus', () => {
  it('classifies user entries as correct/wrong and ignores givens', () => {
    const givens = emptyGrid(); givens[0][0] = 5; // a given
    const solution = emptyGrid();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) solution[r][c] = ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
    solution[0][0] = 5;
    const play = gridFrom(givens);
    play[0][1] = solution[0][1];      // correct user entry
    play[0][2] = (solution[0][2] % 9) + 1; // wrong user entry
    const st = playStatus(play, givens, solution);
    expect(st.correct.has(0 * 9 + 1)).toBe(true);
    expect(st.wrong.has(0 * 9 + 2)).toBe(true);
    expect(st.correct.has(0 * 9 + 0)).toBe(false); // givens are not "user entries"
    expect(st.complete).toBe(false);
  });

  it('reports complete when every cell is filled and correct', () => {
    const solution = emptyGrid();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) solution[r][c] = ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
    const givens = emptyGrid();
    const play = solution.map((r) => r.slice());
    const st = playStatus(play, givens, solution);
    expect(st.wrong.size).toBe(0);
    expect(st.complete).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- play.test.ts`
Expected: FAIL — cannot import `playStatus` from `./play`.

- [ ] **Step 3: Implement `src/solver/play.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (all green).

- [ ] **Step 5: Refactor the App validity memo** — in `src/App.tsx`:
  - Change the solve import to include `countSolutions` and drop `hasSolution` if it becomes unused: `import { solve, countSolutions } from './solver/solve';`
  - Replace the `solvable` memo + `canSolve` line:

```tsx
const validity = useMemo(() => {
  if (conflicts.length || filledCount === 0) return { solvable: true, unique: false };
  const { count } = countSolutions(cells, 2);
  return { solvable: count >= 1, unique: count === 1 };
}, [cells, conflicts.length, filledCount]);
const canSolve = conflicts.length === 0 && filledCount > 0 && validity.solvable;
const canCheck = conflicts.length === 0 && filledCount > 0 && validity.unique;
```

  - Update the no-solution banner condition to `mode === 'edit' && !validity.solvable && filledCount > 0 && conflicts.length === 0`.
  - Pass `canCheck={canCheck}` to `<Toolbar />` (replacing the temporary `false`).

- [ ] **Step 6: Type-check + test**

Run: `npx tsc -b && npm test`
Expected: clean + green.

- [ ] **Step 7: Commit**

```bash
git add src/solver/play.ts src/solver/play.test.ts src/App.tsx
git commit -m "feat(solver): playStatus helper; App validity memo (solvable + unique)"
```

---

### Task 7: `Board` play-mode rendering + success token

**Files:**
- Modify: `src/components/Board.tsx`
- Modify: `src/styles/tokens.css`

**Interfaces:**
- `Board` `Props.mode` becomes `'edit' | 'solved' | 'play'`; add `solution?: Grid`. In play mode `editGrid` carries the play grid and `givens` carries the locked clues.

- [ ] **Step 1: Add the play branch to `Board.tsx`** — update the `mode` type to `'edit' | 'solved' | 'play'`, add `solution?: Grid;` to `Props`, destructure `solution`, and extend the cell loop and handlers:

In the cell-building loop, add a `play` branch alongside the existing `edit`/`solved` branches:

```tsx
if (mode === 'edit') {
  value = editGrid[r][c];
  if (value) classes.push('given');
  if (conflictSet.has(k)) classes.push('conflict');
  if (selected && selected.r === r && selected.c === c) classes.push('selected');
} else if (mode === 'play') {
  value = editGrid[r][c];
  if (givens[r][c]) classes.push('given');
  else if (value) classes.push(value === solution![r][c] ? 'correct' : 'wrong');
  if (selected && selected.r === r && selected.c === c) classes.push('selected');
} else {
  value = view!.grid[r][c];
  if (currentSet.has(k)) classes.push('cur');
  else if (givens[r][c]) classes.push('given');
  else if (value) classes.push('filled');
  if (highlightSet.has(k) && !currentSet.has(k)) classes.push('peer');
}
```

Update the cell's `onClick` so play-mode non-given cells are selectable:

```tsx
onClick={
  mode === 'edit' || (mode === 'play' && !givens[r][c])
    ? () => setSelected({ r, c })
    : undefined
}
```

Update `onKeyDown` to also handle play mode (write only to non-given cells):

```tsx
function onKeyDown(e: KeyboardEvent) {
  if ((mode !== 'edit' && mode !== 'play') || !selected) return;
  const { r, c } = selected;
  if (mode === 'play' && givens[r][c]) return;
  if (e.key >= '1' && e.key <= '9') setCell(r, c, Number(e.key));
  else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') setCell(r, c, 0);
  else if (e.key === 'ArrowUp') setSelected({ r: Math.max(0, r - 1), c });
  else if (e.key === 'ArrowDown') setSelected({ r: Math.min(8, r + 1), c });
  else if (e.key === 'ArrowLeft') setSelected({ r, c: Math.max(0, c - 1) });
  else if (e.key === 'ArrowRight') setSelected({ r, c: Math.min(8, c + 1) });
  else return;
  e.preventDefault();
}
```

- [ ] **Step 2: Add the success token + play cell colors** — in `src/styles/tokens.css`, add `--success` to `:root` and the cell classes:

In `:root { ... }` add: `--success: #22c55e;`

After the `.cell.conflict` rule add:
```css
.cell.correct { color: var(--success); font-weight: 700; }
.cell.wrong { color: var(--error); font-weight: 700; }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: clean. (Board's new `solution`/`play` are exercised by App in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add src/components/Board.tsx src/styles/tokens.css
git commit -m "feat(ui): Board play-mode rendering with green/red verification"
```

---

### Task 8: `Conferir` / play mode wiring in App

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `playStatus` (Task 6), `Board.solution` + play mode (Task 7), `Toolbar.onCheck/onClear/onEdit` (Task 3), `Celebration` (existing).

- [ ] **Step 1: Add play state + imports** — in `src/App.tsx`:
  - `import { playStatus } from './solver/play';`
  - Update mode state type: `const [mode, setMode] = useState<'edit' | 'solved' | 'play'>('edit');`
  - Add: `const [solution, setSolution] = useState<Grid | null>(null);` and `const [playGrid, setPlayGrid] = useState<Grid>(() => emptyGrid());`

- [ ] **Step 2: Route `setCell` and add handlers** — replace `setCell` and add `handleCheck`; update `handleClear`/`handleEdit`:

```tsx
function setCell(r: number, c: number, v: number) {
  if (mode === 'play') {
    if (givens[r][c]) return;
    setPlayGrid((g) => { const n = cloneGrid(g); n[r][c] = v; return n; });
    return;
  }
  setCells((g) => { const n = cloneGrid(g); n[r][c] = v; return n; });
}

function handleCheck() {
  setError(null);
  const { count, solution: sol } = countSolutions(cells, 2);
  if (count !== 1 || !sol) { setError('Conferir precisa de uma solução única.'); return; }
  setSolution(sol);
  setGivens(cloneGrid(cells));
  setPlayGrid(cloneGrid(cells));
  setSelected(null);
  setMode('play');
}

function handleClear() {
  if (mode === 'play') { setPlayGrid(cloneGrid(givens)); setSelected(null); return; }
  setCells(emptyGrid());
  setResult(null);
  setMode('edit');
  setError(null);
  setSelected(null);
}

function handleEdit() {
  setMode('edit');
  setResult(null);
  setSolution(null);
  setError(null);
}
```

- [ ] **Step 3: Compute play status + celebration** — add near the other memos:

```tsx
const status = useMemo(
  () => (mode === 'play' && solution ? playStatus(playGrid, givens, solution) : null),
  [mode, solution, playGrid, givens],
);
const celebrate =
  (mode === 'solved' && !!result && stepIndex === result.steps.length - 1) ||
  (mode === 'play' && !!status?.complete);
```
(Replace the existing single-line `celebrate` definition from round 1.)

- [ ] **Step 4: Update JSX** — three edits:
  - `Board`: pass play-aware grids + solution:
    ```tsx
    <Board
      mode={mode}
      editGrid={mode === 'play' ? playGrid : cells}
      givens={mode === 'edit' ? cells : givens}
      solution={solution ?? undefined}
      view={view}
      conflicts={conflicts}
      selected={selected}
      setSelected={setSelected}
      setCell={setCell}
      celebrate={CELEBRATION.boardGlow && celebrate}
    />
    ```
  - `NumberPad`: render in play mode too — change the wrapper condition from `{mode === 'edit' && (` to `{(mode === 'edit' || mode === 'play') && (`.
  - `Toolbar`: pass the real handlers: `onCheck={handleCheck}` (replacing the temporary `() => {}` from Task 3).
  - Add a small muted note when the grid is solvable but not unique (Conferir disabled), next to the no-solution banner:
    ```tsx
    {mode === 'edit' && filledCount > 0 && conflicts.length === 0 && validity.solvable && !validity.unique && (
      <div className="muted note">Conferir precisa de solução única (este tem mais de uma).</div>
    )}
    ```

- [ ] **Step 5: Add the note style** — append to `src/styles/tokens.css`:
```css
.note { font-size: 13px; margin: -6px 0 14px; }
```

- [ ] **Step 6: Type-check + test + build**

Run: `npx tsc -b && npm test && npm run build`
Expected: clean + green + build OK.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/styles/tokens.css
git commit -m "feat(ui): Conferir play mode with live verification and completion celebration"
```

---

### Task 9: Full verification gate (unit + build + CDP smokes)

**Files:** none (verification only)

- [ ] **Step 1: Unit tests + build**

Run: `npm test && npm run build`
Expected: all green; build OK.

- [ ] **Step 2: Write the round-2 CDP smoke** — `/tmp/sdd-sudoku/smoke4.mjs` (reuse the harness from `smoke2.mjs`: CDP connect, `evalJS`, `pollFor`, `clickBtnText`). Assertions:
  - App starts with the example loaded (board shows ≥17 givens immediately, no Exemplo click).
  - `Aleatório ▾` opens the menu; clicking `Fácil` loads a puzzle (board has ≥17 givens, still edit mode, `.numpad-grid` present).
  - `Conferir` (with the example loaded) enters play mode; pick the first empty cell and set it to each digit 1..9 in turn via the keypad — **exactly one** yields `.cell.correct` and the rest `.cell.wrong` (verifies live green/red).
  - Protocol modal: from solved mode, open "Ver explicação completa" → `.modal-close` exists → click it closes; reopen → press Escape closes.
  - Item 4 regression: at 390px width (`Emulation.setDeviceMetricsOverride`), solve example, record `.board` width, click Auto, wait, re-read `.board` width → **unchanged**.

- [ ] **Step 3: Run the smoke** (start preview + headless Chrome like Task-9 round 1):

```bash
cd /Users/hugocemep/GitHub/sudoku-solver
npm run preview -- --port 4182 > /tmp/sdd-sudoku/prev4.log 2>&1 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9227 --user-data-dir=/tmp/sdd-sudoku/cp4 \
  --window-size=1280,900 --no-first-run --no-default-browser-check --disable-gpu about:blank \
  > /tmp/sdd-sudoku/chrome4.log 2>&1 &
sleep 3
node /tmp/sdd-sudoku/smoke4.mjs "http://localhost:4182/" 9227
```
Expected: `ALL SMOKE CHECKS PASSED`. Kill the preview + chrome PIDs afterward.

- [ ] **Step 4: Confirm clean tree**

Run: `git status --short`
Expected: empty.

---

## Self-Review

**Spec coverage:**
- Item 4 (auto layout shift) → Task 4 (minmax + toggle min-width) + Task 9 regression. ✓
- Item 1 (mobile step min-height) → Task 4. ✓
- Item 2 (modal X + Esc) → Task 5 + Task 9. ✓
- Item 3 (generated pool, default example, Aleatório dropdown, dynamic import) → Tasks 1, 2, 3 + Task 9. ✓
- Item 5 (Conferir/play, green/red, unique gating, celebration) → Tasks 6, 7, 8 + Task 9. ✓

**Placeholder scan:** all code/CSS/commands shown in full; the only deferred values are the temporary `canCheck={false}`/`onCheck={() => {}}` in Task 3, explicitly finalized in Tasks 6/8. ✓

**Type consistency:** `Difficulty` defined in `loadPuzzles.ts`, imported by `DifficultyMenu`/`Toolbar`/`App`. `Toolbar` props (`canCheck`, `loading`, `onCheck`, `onRandom`) introduced in Task 3 and fully satisfied by Task 8. `playStatus(...) => {correct,wrong,complete}` defined in Task 6, consumed in Task 8. `Board.mode: 'edit'|'solved'|'play'` + `solution?: Grid` defined in Task 7, passed in Task 8. `classify`/`grade` names consistent across Task 1 test + impl. ✓
