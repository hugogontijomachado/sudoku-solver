# Sudoku Solver — improvements & bug fixes (design)

Date: 2026-06-16
Status: approved (ready for implementation plan)

Source: `/Users/hugocemep/GitHub/sudoku/todo.txt` (4 items, in Portuguese).
All work happens in the `sudoku-solver` repo (this repo).

## Context

As-built stack: React 19, Vite 8, TypeScript 6 (strict `tsconfig.app.json`:
`verbatimModuleSyntax`, `noUnusedLocals/Parameters`, `include: ["src"]`), Vitest 4.
Plain CSS variables from `DESIGN.md` live in `src/styles/tokens.css`. UI + step text
are in Portuguese. The solver is a TS port of the Python reference; `solve()` and
`countSolutions()` are exported from `src/solver/solve.ts`. Component tests have no
jsdom/testing-library; solver logic is unit-tested with Vitest. UI is verified at
runtime via a headless-Chrome CDP smoke (handoff pattern).

Current relevant behavior:
- `App.tsx` `canSolve = conflicts.length === 0 && filledCount > 0`. `solve()` already
  throws `"Este Sudoku não tem solução."` when `countSolutions(grid,2).count === 0`,
  but only *after* the user clicks Resolver (caught into an error banner).
- The board is a `<div tabIndex={0} onKeyDown>`; tapping a cell only selects it. There
  is **no** number-entry path on mobile (no soft keyboard is summoned).
- The right column is `Toolbar + banners + StepPlayer + status`; `StepPlayer`'s
  `.text` length drives the card height, so the nav buttons shift between steps.
  `.grid2` uses `align-items: start` and collapses to one column at `max-width: 880px`.
- Nothing fires when the last step is reached.

## Item 1 — Block "Resolver" when the puzzle has no solution

Detect unsolvable grids proactively and disable Resolver (don't only error after click).

- Add pure helper `hasSolution(grid: Grid): boolean` in `src/solver/solve.ts`, a thin
  wrapper over `countSolutions(grid, 1).count > 0`.
- In `App.tsx` add a memo `solvable`, computed **only** when
  `conflicts.length === 0 && filledCount > 0` (else `true`, so empty/partial grids stay
  allowed). Fold into `canSolve` so the Resolver button disables for no-solution grids.
- Live edit-mode banner when `conflicts.length === 0 && filledCount > 0 && !solvable`:
  *"Este Sudoku não tem solução. Revise as pistas."* The existing post-click error in
  `handleSolve` stays as a safety net.
- Perf: the check runs per edit via `useMemo`. Fast for 9×9 (MRV + bail on first
  solution / first contradiction). Start synchronous; add a small debounce only if
  runtime testing shows lag.

TDD: unit-test `hasSolution` — solvable puzzle → true, empty grid → true, a constructed
no-solution-but-no-direct-conflict grid → false (e.g. a row whose only empty cell must
be 9 while that cell's column already contains a 9 elsewhere → no candidate, no repeat).

## Item 2 — Always-visible numeric keypad (PC + mobile)

User decision: an on-screen keypad shown on all devices (not device-detected).

- New `src/components/NumberPad.tsx`: buttons **1–9 + ⌫ (apagar)**, laid out 5×2 with
  ≥44px touch targets, styled with `DESIGN.md` tokens.
- Rendered **inside the board card, below the board, only in edit mode**.
- Tapping a cell selects it; a digit writes via the existing `setCell(selected.r,
  selected.c, d)`; ⌫ clears (`setCell(..., 0)`). Buttons are disabled with a subtle
  "selecione uma célula" hint until a cell is selected.
- The physical-keyboard path (`Board.onKeyDown`) is unchanged. Per-cell focus a11y
  remains a separate backlog item — out of scope here.

## Item 3 — PC: step card fixed to board height + internal scroll; mobile: unchanged

Stop the nav buttons jumping as instruction text length changes.

- Measure the board card height with a `ref` + `ResizeObserver`; detect desktop with
  `matchMedia('(min-width: 881px)')` (matches the `.grid2` collapse breakpoint).
- On desktop, set the `.step` (StepPlayer) card height = board card height. `.step`
  becomes a flex column; only `.text` gets `flex:1; overflow-y:auto; min-height:0`, so
  meta/progress/nav-steps/more stay pinned. The two columns read as equal-height.
- On mobile (not desktop), no fixed height → current natural flow.
- Clean interaction: the keypad is edit-mode-only and the step card is solved-mode-only,
  so they never inflate the board card at the same time.

## Item 4 — Completion celebration (3 independent code toggles)

User decision: implement all three effects, each toggleable **in code only** (no user UI),
so the user can flip them while testing.

- New `src/components/Celebration.tsx` plus a config block:
  ```ts
  export const CELEBRATION = { confetti: true, boardGlow: true, badge: true };
  ```
- Trigger: `mode === 'solved' && stepIndex === lastStep`. Re-arms when leaving/returning
  to the last step.
- `confetti` — dependency-free burst (~40 particles, `--primary` / white /
  `--primary-active`), fixed overlay, `pointer-events: none`, auto-fades ~2.5s.
- `boardGlow` — pulse class added to `.board` (Board takes a `celebrate?` prop).
- `badge` — "✓ Resolvido!" overlay centered over the board.
- All honor `prefers-reduced-motion` (skip motion; keep the static badge).

## Verification

- Item 1: Vitest unit tests for `hasSolution` (red → green). Existing golden solve test
  must stay green.
- Items 2/3/4: runtime headless-Chrome CDP smoke — load → Exemplo → keypad input →
  Resolver → step to the end → assert keypad present in edit mode, step nav fixed on
  desktop, and celebration on last step.
- Gate every change on `npm test` + `npx tsc -b` clean, then `npm run build`.

## Out of scope

- Per-cell focus / full ARIA grid roles (separate backlog item).
- New solving techniques (Y-Wing/Swordfish/coloring) and rendering `Step.eliminations`.
- Adding jsdom/testing-library (UI verified via CDP smoke instead).
