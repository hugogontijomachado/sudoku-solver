# Sudoku Solver — improvements round 3 (design)

Date: 2026-06-17
Status: approved (ready for implementation plan)

Source: `todo.txt` (repo root):
1. Bug — typing a digit into an (almost) empty grid then solving makes the screen go
   black. Improve the behavior, UI/UX-focused.
2. A page/tab documenting the **25 techniques** (source content: `docs/tecnicas_sudoku.md`).

## Context

React 19 + Vite 8 + TS 6 (strict `tsconfig.app.json`: `verbatimModuleSyntax`,
`noUnusedLocals/Parameters`, `erasableSyntaxOnly`, `include: ["src"]`), Vitest 4. CSS
variables from `DESIGN.md` in `src/styles/tokens.css` — **tokens only, never inline hex**.
UI + explanations in Portuguese. State machine in `App.tsx` is `mode: 'edit' | 'solved' |
'play'`. Solver in `src/solver/` exports `solve`, `countSolutions`, `hasSolution`;
`techniques.ts` exposes `Step` (`technique`, `text`, `placements?`, `eliminations?`,
`highlight`) and the technique functions. UI verified by headless-Chrome CDP smokes
(`scripts/smoke/`); solver logic unit-tested (Vitest). No router; no new runtime deps.

---

## Item 1 — "Tela preta" bug

### Root cause (confirmed, not a hang)

The validity search is ~1 ms even on a blank grid, so the freeze theory is wrong. The
real failure: a grid with too few clues has **no logical deduction**, so `solve()` falls
straight to backtracking and returns `steps: []`. Then:

- `App.tsx` `view` memo (`result.steps[stepIndex].highlight`) dereferences `undefined`.
- `StepPlayer` reads `steps[index].technique/.text` and computes `pct = (index+1)/0`.

Both throw during render, and because `main.tsx` has **no error boundary**, React unmounts
the whole tree → bare `#0a0a0a` body = the "tela preta". Trigger: clear grid → type a
digit → **Resolver** (the grid is "solvable" so Resolver is enabled, but non-unique).

### Behavior (three layers)

**A) Resolver gating + multiple-solutions helper (the requested UX)**
- **No solution / over-constrained:** `Resolver` stays **disabled** (already gated by
  `validity.solvable`); keep the existing no-solution banner. Verified by smoke.
- **Non-unique (too few clues):** `Resolver` becomes **enabled but interceptive** — on
  click, instead of solving, it opens a **`MultipleSolutionsDialog`** modal: "Ainda há
  várias soluções possíveis para este tabuleiro." with two actions:
  1. **Continuar preenchendo** — close, return to editing.
  2. **Preencher uma célula** — auto-fill **one random empty cell with a valid value**
     (taken from a real solution, so always possible), nudging toward uniqueness. The
     dialog stays open and re-evaluates after each fill: while still non-unique it keeps
     the two actions and updates the count message; once the board becomes **unique** the
     message switches to "Agora há solução única!" and a primary **Resolver agora** button
     appears that runs the normal solve and closes the dialog. Solving only ever proceeds
     on a unique grid.
- When the grid **is unique**, `Resolver` solves immediately as today.

**B) Crash guards (defense in depth, always on)**
- `view` memo: when `result.steps.length === 0`, return the completed grid
  (`givens` + `result.solution`) with no highlight (never index an empty array).
- Solved panel: render `StepPlayer` only when `steps.length > 0`; otherwise show a card
  "Resolvido por tentativa e erro — não há deduções lógicas a exibir para este tabuleiro."
  (`StepPlayer` itself also guards `total === 0` to be safe.)
- New `src/components/ErrorBoundary.tsx` (class component) wraps `<App/>` in `main.tsx`:
  on any render error shows a friendly PT fallback ("Algo deu errado…") + "Recarregar"
  button — **never** a black void.

**C) Helper** `fillRandomValidCell(grid, rng?) -> Grid | null` (pure). Computes a real
solution via `countSolutions(grid, 1).solution`, picks a random empty cell, returns a new
grid with that cell set to its solution value; returns `null` if full/unsolvable. `rng`
injectable for deterministic tests. Lives in `src/solver/solve.ts` (next to its deps).

---

## Item 2 — Techniques page ("Técnicas" tab)

Chosen concept (validated in the visual companion): **navigable card reference (all 25)
with an inline "real-case" animation** on the value-adding techniques.

### Navigation (in-app tab, no router)

`App` gains top-level UI state `tab: 'solver' | 'tecnicas'`. The nav bar renders two tab
buttons (Resolver / Técnicas). `tab === 'solver'` renders today's app; `tab === 'tecnicas'`
renders `<TechniquesPage/>`. The whole solver state machine is untouched (it just isn't
rendered while on the Técnicas tab). `TechniquesPage` is **lazy-loaded** (`React.lazy` +
`Suspense`) so it stays out of the initial bundle.

### Content & layout

- Hero + a **concepts strip** (Célula / Unidade / Candidato / Peer — short defs from the
  md's "Conceitos" section).
- **Sticky filter**: Todas / Implementadas ✅ / Não implementadas ⬜, plus a count
  ("25 técnicas · 11 no solver").
- Techniques grouped by the md's **8 levels**; each technique is a card: number, PT name,
  EN name, level badge, ✅/⬜ badge, explanation (from the md, example-specifics removed),
  and — where it adds value — a `MiniBoard` with **▶ Animar**.
- Source of truth for copy is `docs/tecnicas_sudoku.md` (committed); the page **ignores
  that file's worked-example references** (it explains techniques generically).

### Where animations are shown (only where they add value)

- **Animated, real cases:** Level 1 singles (naked/hidden single), Level 2 subsets
  (naked/hidden pair/triple/quad), Level 3 intersections (pointing/claiming), Level 4
  X-Wing. These come from the **real solver** (see data pipeline).
- **Animated, constructed cases (verified):** a few unimplemented but visual patterns the
  user explicitly wants — wings (Y-Wing) and a fish (Swordfish) — as small hand-authored
  grids, verified by test.
- **Static diagram + text (no animation):** Jellyfish, XYZ/W-Wing where a clean case is
  hard.
- **Text only:** Level 6 coloring/chains (3D Medusa, X-Cycles, XY-Chain, Forcing Chains,
  Nishio, Simple Coloring), Level 7 unicidade (Unique Rectangle, BUG), Level 8
  Backtracking — too abstract for a small board diagram.

### Components & data

- `src/components/MiniBoard.tsx` — renders a 9×9 from an 81-char grid (givens shown,
  block borders) and animates a `TechniqueCase`: steps through `frames`, each frame a
  caption + a set of `{ idx, cls: 'hl'|'peer'|'elim'|'place', d? }`. Honors
  `prefers-reduced-motion` (renders the final frame statically, no timers). ~1.3 s/frame
  (rhythm approved in the prototype). Tokens only.
- `src/components/TechniquesPage.tsx` — the page (hero, concepts, filter, level sections,
  cards). Filter is local state.
- `src/data/techniques.ts` — the 25 techniques metadata: `{ n, namePt, nameEn, level,
  implemented, text, caseKey? }`. Static.
- `src/data/techniqueCases.ts` — `Record<string, TechniqueCase>` (`{ grid: string;
  frames: Frame[] }`). The animated cases live here.

### Data pipeline for real cases (build-time, baked static)

A **throwaway** Vitest (`src/data/_gen_cases.test.ts`, deleted after use — Vite resolves
the solver's extensionless imports) scans `src/data/puzzles.json` with `solve()`, and for
each implemented technique finds an early, clean step, capturing the **grid snapshot**
(givens + placements of all prior steps) plus the step's `highlight`/`eliminations`/
`placements` and the focus digit(s). It emits ready-to-paste `TechniqueCase` objects which
are baked into `src/data/techniqueCases.ts`. No runtime solving, full coverage (it can
scan all 400 puzzles to find rare quads).

Frames per case (2–3, matching the prototype):
1. **Padrão** — highlight the technique's `highlight` cells (showing the focus digit);
   for singles also mark the target's peers (`peer`).
2. **Conclusão** — `place` the placement (singles) or `elim` the eliminations (subsets,
   intersections, X-Wing), each with its digit; caption = a trimmed version of the step
   text.

Constructed (wings/swordfish) cases are authored directly in `techniqueCases.ts`.

### Verification of cases (committed test)

`src/data/techniqueCases.test.ts` re-verifies every case so the baked data can't drift:
- For each **implemented** technique's case: build a `Board` from `grid`, run that exact
  technique fn, and assert it returns a step whose `highlight`/`eliminations`/`placements`
  match the case's "padrão"/"conclusão" frames.
- For **constructed** cases: assert the structural claim (e.g. the Y-Wing pivot + two
  pincers are bivalue and the elimination target is a peer of both pincers) via the
  `Board` candidate sets.

---

## Architecture / new files

- New: `src/components/ErrorBoundary.tsx`, `src/components/MultipleSolutionsDialog.tsx`,
  `src/components/TechniquesPage.tsx`, `src/components/MiniBoard.tsx`,
  `src/data/techniques.ts`, `src/data/techniqueCases.ts`,
  `src/data/techniqueCases.test.ts`, `src/solver/solve.test.ts` additions (or a new
  `fillRandomValidCell` test).
- Changed: `src/main.tsx` (wrap in ErrorBoundary), `src/App.tsx` (tab state, Resolver
  intercept, empty-steps guard, render TechniquesPage), `src/components/StepPlayer.tsx`
  (guard `total === 0`), `src/solver/solve.ts` (`fillRandomValidCell`),
  `src/styles/tokens.css` (any new tokens for tab/cards/mini-board — reuse existing where
  possible).
- `.gitignore`: `.superpowers/` (visual-companion artifacts) — done.

## Testing

- **Unit (Vitest):** `fillRandomValidCell` (validity, progress toward uniqueness,
  deterministic with injected rng, `null` on full grid); empty-steps `solve()` result
  shape on a 1-clue grid; every `TechniqueCase` re-verified against the solver/checker.
- **UI runtime (CDP smokes):** new `smoke5` — (a) regression: clear → type 1 digit →
  Resolver shows the multiple-solutions modal (no black screen); "preencher célula" adds a
  cell; (b) Técnicas tab opens, shows cards, ▶ Animar advances a frame, back to Resolver
  works. Keep existing smokes green.
- Gate every change on `npm test` + `npx tsc -b` + `npm run build`, then the smokes.

## Out of scope

- Implementing the unimplemented solving techniques in the solver (the page documents them;
  the solver still backtracks for them).
- Pencil-mark (candidate) rendering on the main board.
- Accessibility backlog (ARIA grid roles, per-cell focus) — tracked separately, though new
  interactive controls (tabs, dialog, animate) use real `<button>`s with labels.
- A URL route per tab (in-app state toggle only).
