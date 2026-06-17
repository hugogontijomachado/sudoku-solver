# Sudoku Solver — improvements round 2 (design)

Date: 2026-06-16
Status: approved (ready for implementation plan)

Source: `/Users/hugocemep/GitHub/sudoku/todo.txt` (items 1–4) + a 5th item proposed in
conversation ("Conferir" mode). Work happens in the `sudoku-solver` repo, except the
puzzle generator, which lives in the `sudoku/` skill repo and reuses `sudoku_solver.py`.

## Context

React 19 + Vite 8 + TS 6 (strict `tsconfig.app.json`: `verbatimModuleSyntax`,
`noUnusedLocals/Parameters`, `include: ["src"]`), Vitest 4. CSS variables from
`DESIGN.md` in `src/styles/tokens.css`. UI + step text in Portuguese. State machine in
`App.tsx` is currently `mode: 'edit' | 'solved'`. The solver exports `solve`,
`countSolutions`, `hasSolution` from `src/solver/solve.ts`. No jsdom/testing-library;
solver logic is unit-tested, UI is verified by headless-Chrome CDP smokes
(`/tmp/sdd-sudoku/*.mjs`). The Python solver (`sudoku/scripts/sudoku_solver.py`) exposes
`solve(grid, check_unique=True) -> SolveResult` (`.solved`, `.used_backtracking`,
`.techniques_used`), `count_solutions(grid, limit) -> (count, solution|None)`,
`parse_grid`, `grid_to_string`, and the ordered `TECHNIQUES` list.

## Item 4 (bug) — Auto mode shifts the mobile layout

Root cause (confirmed by measuring element rects before/after clicking Auto): mobile
`.grid2` uses `grid-template-columns: 1fr` (= `minmax(auto, 1fr)`), so the grid column
stretches to the step card's min-content width. Starting Auto changes the toggle button
label `⏯ Auto` (74px) → `⏸ Pausar` (89px), widening the nav row's min-content, which
widens the whole column — the board grew 297→311px (and taller via `aspect-ratio`).
Desktop is immune (its column is `minmax(0, 440px)`).

Fix: mobile `.grid2` → `grid-template-columns: minmax(0, 1fr)`, plus a fixed `min-width`
on the Auto/Pausar toggle button so its width is identical in both states.
Verify by re-measuring: board width must be constant across the Auto toggle.

## Item 1 — Mobile step card baseline height

On mobile (below 881px), give `.step` a `min-height` (~300px, tunable) so short steps
don't shrink the card and bounce the nav buttons; longer text grows the card naturally
(no internal scroll on mobile). Desktop behavior (height pinned to board card + `.text`
internal scroll) is unchanged.

## Item 2 — Protocol modal close affordances

`ProtocolView` gets an **✕ button in the top-right** (absolute, inside `.protocol`) and
keeps the bottom **Fechar** button. Backdrop click already closes; also close on **Esc**
(keydown listener while mounted). Styled with tokens; ✕ has `aria-label="Fechar"`.

## Item 3 — Random puzzles (generated, 100 per difficulty)

The skill's source (sudokuonline.io) only serves 5 fixed puzzles per difficulty
(repeated fetches return the same 5), so puzzles are generated instead.

- **Generator** `sudoku/scripts/generate_pool.py` (reuses `sudoku_solver.py`):
  1. Build a random complete valid solution (randomized backtracking fill).
  2. Dig cells: shuffle cell order; remove a cell only if `count_solutions(grid, 2)`
     still returns count 1 (unique). Dig more aggressively for harder buckets.
  3. Grade with `solve(grid)`: **Evil** if `used_backtracking`; else by hardest tier in
     `techniques_used` — **Fácil** = only singles (naked/hidden single); **Médio** =
     subsets (Par/Trio/Quadra nu/escondido) or pointing/claiming; **Difícil** = uses
     X-Wing.
  4. Accumulate into buckets until each has 100, with a wall-clock/attempt cap.
     **Log the actual count per bucket** (no silent truncation) — Difícil/Evil may land
     below 100; that is reported, not hidden.
  - Output: `src/data/puzzles.json` (in the solver repo) =
    `{ "easy": string[], "medium": string[], "hard": string[], "evil": string[] }`,
    each entry an **81-char clue string** (`.` = empty, digits = givens). ~32 KB.
  - The generator is committed for reproducibility and run once to produce the JSON.
- **Consumption (app):** load `src/data/puzzles.json` via **dynamic `import()`** only when
  a difficulty is selected, so it is code-split out of the initial bundle. Pick a random
  index from the chosen difficulty's array and load it into the grid (like the example).
- **UI:** the app **starts with the existing example loaded** as the default grid. The
  former `Exemplo` button becomes an **`Aleatório ▾` dropdown** listing the 4
  difficulties (Fácil / Médio / Difícil / Evil). Loading shows a brief disabled/busy
  state while the chunk loads. Toolbar stays at three controls.

## Item 5 — "Conferir" (solve-it-yourself with live verification)

- New **`Conferir`** button in edit mode. On click: compute the unique solution silently
  (`countSolutions(cells, 1).solution`), lock the current cells as givens, store the
  solution, and switch to a new **`play`** mode.
- **Play mode:** the user fills empty (non-given) cells via keypad/keyboard. Each filled
  cell is colored **green if it equals the solution, red if it does not**, live. Givens
  are locked (not selectable/editable). Toolbar: `✎ Editar`, `Limpar` (clears the user's
  entries, keeping givens). When every cell is filled and correct → reuse the existing
  **`Celebration`** (`active` true on full-correct).
- **Gating:** `Conferir` is enabled only when the grid has a **unique** solution. Replace
  the current `hasSolution`-based `solvable` memo with one `validity` memo computing
  `countSolutions(cells, 2)` per edit → `{ count }`; derive `solvable = count >= 1`
  (Resolver) and `unique = count === 1` (Conferir). `count === 0` → existing no-solution
  banner; `count >= 2` → `Conferir` disabled + a one-line muted note
  ("Conferir precisa de solução única").
- **Coloring token:** add `--success` (green, e.g. `#22c55e`) to `tokens.css` for correct
  cells; wrong cells use the existing `--error`.

## Architecture / components

- **State machine:** `mode: 'edit' | 'solved' | 'play'`. New `App` state: `solution:
  Grid | null`, `playGrid: Grid`. In play mode `setCell` writes to `playGrid` for
  non-given cells only.
- **`Board`** gains a `play` branch and a `solution?: Grid` prop: in play mode the cell
  value comes from `playGrid`; class is `given` (locked) / `correct` (green) / `wrong`
  (red) / empty; only non-given cells are selectable.
- **New files:** `src/components/DifficultyMenu.tsx` (the `Aleatório ▾` dropdown),
  `src/data/puzzles.json` (generated), `sudoku/scripts/generate_pool.py` (generator).
  A small pure helper `playStatus(playGrid, givens, solution)` (in `solver/` or a new
  `play.ts`) computes correct/wrong sets — unit-testable.

## Testing

- **Generator (Python):** unit-test the **grading function** (`grade(grid) ->
  'easy'|'medium'|'hard'|'evil'`) against known puzzles (e.g. the reference puzzle from
  `solucao_protocolo.md` and constructed cases); and assert every generated puzzle is
  unique. Run with `python3` (no new deps).
- **Play logic (TS):** unit-test the pure `playStatus` helper (correct/wrong/empty
  classification) and the `validity` memo's derivation (solvable/unique) via the solver.
- **UI runtime (CDP smokes):** keypad still works; `Aleatório ▾` loads a random puzzle;
  `Conferir` enters play mode and colors a correct entry green / wrong red; protocol modal
  ✕ and Fechar both close; Esc closes; and — regression for item 4 — board width is
  constant across the Auto toggle on mobile.
- Gate every change on `npm test` + `npx tsc -b` clean, then `npm run build`.

## Out of scope

- Live fetching of puzzles / a serverless backend (static app; generator bakes the pool).
- Accessibility backlog (ARIA grid roles, per-cell focus) — tracked separately.
- New solving techniques beyond what the solver already implements.
