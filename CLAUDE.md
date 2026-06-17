# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. This repo is
**self-contained** — everything needed to build, test, deploy, and extend the app lives
here. (It began as part of a sibling `sudoku` skill repo; that history is no longer
required reading.)

## What this is

A static web app that solves a 9×9 Sudoku **in the browser** and explains every
deduction step by step, plus a "Conferir" mode where you solve it yourself with live
right/wrong feedback. No backend. Deployed on Vercel; every push to `main` redeploys.

- **Repo:** https://github.com/hugogontijomachado/sudoku-solver · local checkout
  `/Users/hugocemep/GitHub/sudoku-solver`.
- **UI and all explanations are in Portuguese.**

## Design source of truth

**`DESIGN.md` (repo root) is the single source of truth for all UI/visual design** — a
full design system (color tokens, Inter / JetBrains-Mono type scale, spacing, radii,
component specs; near-pure-black canvas `#0a0a0a`, electric-yellow `#faff69` accent).
The tokens are implemented as CSS variables in `src/styles/tokens.css`. **Always
reference tokens (`var(--primary)`, etc.) — never inline hex or ad-hoc sizes.** When
design and code disagree, `DESIGN.md` wins.

## Stack & strict-tsconfig gotchas

React **19**, Vite **8**, TypeScript **6**, Vitest **4**. Plain CSS variables (no CSS
framework). PDF via `window.print()` + a print stylesheet.

`tsconfig.app.json` is strict — these bite every edit:
- `verbatimModuleSyntax` → type-only imports MUST use `import type { X }`.
- `noUnusedLocals` + `noUnusedParameters` → remove imports/params that stop being used.
- `erasableSyntaxOnly` → no enums/namespaces/parameter-properties (type-only TS only).
- `resolveJsonModule` is on (for `import('./puzzles.json')`).
- `include: ["src"]` → `*.test.ts` under `src/` ARE type-checked by `tsc -b`.
- React 19 JSX: no `import React`; for React types use `import type { KeyboardEvent } from 'react'`.

## Commands

```bash
npm install
npm run dev            # local dev server
npm test               # Vitest (solver + play unit tests)
npm run build          # tsc -b && vite build  (gate every change on this + npm test)
npm run preview        # serve the production build (used by the smoke runner)

# Refresh the puzzle pool (offline; needs python3 only, stdlib):
python3 scripts/generate_pool.py --target 100 --out src/data/puzzles.json
python3 -m unittest -v   # run from scripts/: tests the difficulty grading

# End-to-end smokes (headless Chrome via DevTools Protocol, no extra npm deps):
bash scripts/smoke/run.sh            # build + serve + run smoke2/3/4
bash scripts/smoke/run.sh smoke4     # a single suite
```

## Architecture

State machine lives in `src/App.tsx`: **`mode: 'edit' | 'solved' | 'play'`**.

### Solver — `src/solver/` (pure TS, runs in the browser)
- `grid.ts` — `Grid`/`Coord` types, units/peers, `parseGrid`, `cloneGrid`, `findConflicts`,
  `renderGridText`, `combinations`.
- `candidates.ts` — `Board` keeping a candidate set per empty cell, updated incrementally
  on each placement via precomputed `PEERS`/`UNITS_OF`.
- `techniques.ts` — `TECHNIQUES`, an **ordered list applied easiest-first** (naked single →
  hidden single → naked/hidden subsets pair/triple/quad → pointing → claiming → X-Wing).
  Each returns `Step[]` with a plain-language Portuguese explanation. After any progress
  the solve loop restarts from the top, so the simplest applicable technique is shown.
- `solve.ts` — `solve(grid): SolveResult` (`steps`, `unique`, `usedBacktracking`, `solved`,
  `solution`); `countSolutions(grid, limit)`; `hasSolution(grid)`. **Backtracking is only a
  fallback** when logic stalls, and is used to verify uniqueness.
- `play.ts` — `playStatus(playGrid, givens, solution)` → `{ correct, wrong, complete }`
  (Sets of `r*9+c`), the pure helper behind Conferir's live green/red.
- To add a technique: write a `(b: Board) => Step[]` and insert it into `TECHNIQUES` at the
  right difficulty; the driver and protocol pick it up automatically.

### UI — `src/components/`
`Cell`, `Board` (renders edit/solved/play; play colors entries via `solution`), `Toolbar`
(Resolver/Conferir/Limpar/`Aleatório ▾` in edit; Editar/Limpar otherwise), `StepPlayer`
(step navigation + Auto), `ProtocolView` (modal: full protocol, print-to-PDF, ✕ + Esc to
close), `NumberPad` (always-visible 1–9 + ⌫ keypad for touch, edit & play), `Celebration`,
`DifficultyMenu` (the `Aleatório ▾` dropdown).

### Hooks / data
- `src/hooks/layout.ts` — `useMediaQuery`, `useElementHeight` (ResizeObserver). On desktop
  the StepPlayer card is pinned to the board card's height with the instruction text
  scrolling internally, so nav buttons don't jump; on mobile `.step` has a `min-height`.
- `src/data/loadPuzzles.ts` — `loadRandomPuzzle(difficulty)` dynamically `import()`s
  `puzzles.json` (a separate ~33 KB chunk, out of the initial bundle) and returns a random
  81-char clue string. The example loads as the default board on startup.

## Puzzle pool & generator

`src/data/puzzles.json` = `{ easy, medium, hard, evil: string[] }`, each a **81-char clue
string** (`.` = empty), **100 per difficulty**. Generated by `scripts/generate_pool.py`
(Python, stdlib only, **standalone** — bundles its own copy of the reference solver
`scripts/sudoku_solver.py`; **seed 12345 → reproducible**).

Method: random full grid → dig cells while keeping the solution **unique** → score each
puzzle by the solver's **solve effort** (technique weights, + backtracking lands in a top
band) → **band the pool into four ordered tiers**. Important: difficulty is rated by
overall effort, NOT "needs technique X" — the X-Wing tier alone is too rare to fill
(only ~3 in 90 s). Average clues land ≈ 49 / 41 / 34 / 27 (easy→evil).

Refresh: `python3 scripts/generate_pool.py --target 100 --out src/data/puzzles.json`
(commit the regenerated JSON). `scripts/test_generate_pool.py` covers the grading.

## Notable behaviors

- **No-solution / uniqueness gating:** an App `validity` memo runs `countSolutions(cells, 2)`
  per edit → drives **Resolver** (enabled when solvable) and **Conferir** (enabled only when
  the solution is unique); shows a banner for no-solution and a note for non-unique.
- **Conferir (play mode):** computes the unique solution, locks current cells as givens,
  then live-colors your entries green (`--success`) / red (`--error`) via `playStatus`;
  reuses `Celebration` on full-correct.
- **Celebration** (`src/components/Celebration.tsx`): confetti + board glow + "✓ Resolvido!"
  badge, each an independent **code-only toggle** —
  `export const CELEBRATION = { confetti, boardGlow, badge }` (no user-facing control; flip a
  boolean to test). Honors `prefers-reduced-motion`.

## Testing & verification

- **Unit (Vitest):** solver + `play.ts`. Includes a **golden solve** asserting the exact
  known solution, `unique=true`, `usedBacktracking=false`. Gate on `npm test` + `npx tsc -b`.
- **End-to-end (`scripts/smoke/`):** headless Chrome driven via the DevTools Protocol with
  Node's global `fetch`/`WebSocket` — **no extra npm deps**. `run.sh` builds, serves the
  preview, launches Chrome, and runs the suites: `smoke2` (keypad + celebration), `smoke3`
  (no-solution guard + fixed step card), `smoke4` (Aleatório dropdown, Conferir green/red,
  modal X+Esc, auto-toggle mobile regression). Desktop uses `--window-size=1280,900`; mobile
  checks use CDP `Emulation.setDeviceMetricsOverride`.
- **GOTCHA:** `.mlabel` is `text-transform: uppercase`, so `innerText` returns UPPERCASE in
  Chrome — assert against non-transformed text (e.g. body copy), not the label.

## Deployment

Vercel, framework preset **Vite** (install/build/output auto-detected; no env vars). Pushes
to `main` auto-redeploy. See `README.md`.

## History & backlog

Specs/plans (rationale, kept) live in `docs/superpowers/`:
- Build: `…/specs/2026-06-16-sudoku-web-app-design.md`, `…/plans/2026-06-16-sudoku-solver-web-app.md`.
- Round 1 (no-solution guard, keypad, fixed step card, celebration): `…-sudoku-improvements*`.
- Round 2 (mobile auto-fix, mobile card baseline, modal close, random puzzles, Conferir):
  `…-sudoku-improvements-round2*`.

**Open backlog:**
- **Accessibility:** board needs `role="grid"`/`role="gridcell"` + aria-labels; cells should
  be individually focusable with per-cell key handling (today only the board container has
  `tabIndex`/`onKeyDown` — the keypad is the reliable touch path); swap `StepPlayer`'s
  `<a onClick>` for a real `<button>`.
- **Enhancements:** more techniques (Y-Wing/Swordfish/coloring) via `TECHNIQUES`; optionally
  render `Step.eliminations` on the board (today only placements/highlight are drawn).

## Conventions for future work

- Process: brainstorm → spec (`docs/superpowers/specs/`) → plan (`docs/superpowers/plans/`)
  → execute with TDD + frequent commits. Reproduce bugs with a failing test first.
- Branch off `main`; gate on `npm test` + `npx tsc -b` + `npm run build`; runtime-verify UI
  with the smokes before merging.
