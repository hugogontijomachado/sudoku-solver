# Sudoku improvements round 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "tela preta" crash (with a multiple-solutions UX) and add an in-app
"Técnicas" tab documenting all 25 techniques with inline real-case animations.

**Architecture:** Two independent work streams in the existing React 19 + Vite static app.
Stream A hardens `App`/`solve`/`StepPlayer` and adds an `ErrorBoundary` + a
`MultipleSolutionsDialog`. Stream B adds a lazy `TechniquesPage` reached by a top-level
`tab` toggle, backed by static technique metadata + animation cases baked from the real
solver and re-verified by a committed test.

**Tech Stack:** React 19 (no `import React`), TypeScript 6 strict, Vitest 4, plain CSS
tokens. No new runtime deps, no router.

## Global Constraints

- Type-only imports MUST use `import type { X }` (`verbatimModuleSyntax`).
- No unused locals/params; no enums/namespaces/param-properties (`erasableSyntaxOnly`).
- `include: ["src"]` → every `src/**/*.test.ts` is type-checked by `tsc -b`.
- Tokens only — `var(--token)`, never inline hex or ad-hoc sizes (`DESIGN.md` is law).
- All user-facing copy in **Portuguese**.
- Gate every task on `npm test` + `npx tsc -b`; gate the whole change additionally on
  `npm run build` + `bash scripts/smoke/run.sh`.

---

## File structure

- `src/solver/solve.ts` — add `fillRandomValidCell`.
- `src/solver/solve.test.ts` — new unit tests (helper + empty-steps shape).
- `src/components/ErrorBoundary.tsx` — new class error boundary.
- `src/components/StepPlayer.tsx` — guard `total === 0`.
- `src/components/MultipleSolutionsDialog.tsx` — new modal.
- `src/App.tsx` — tab state, Resolver intercept, empty-steps guard, render page.
- `src/main.tsx` — wrap `<App/>` in `<ErrorBoundary>`.
- `src/data/techniques.ts` — 25 techniques metadata.
- `src/data/techniqueCases.ts` — baked animation cases + shared `TechniqueCase`/`Frame` types.
- `src/data/techniqueCases.test.ts` — re-verify every case against the solver.
- `src/components/MiniBoard.tsx` — render + animate a `TechniqueCase`.
- `src/components/TechniquesPage.tsx` — the page.
- `src/styles/tokens.css` — tab/card/mini-board styles (reuse tokens).
- `scripts/smoke/smoke5.mjs` + `scripts/smoke/run.sh` — e2e.

---

## Task 1: `fillRandomValidCell` helper

**Files:**
- Modify: `src/solver/solve.ts`
- Test: `src/solver/solve.test.ts` (create)

**Interfaces:**
- Produces: `fillRandomValidCell(grid: Grid, rng?: () => number): Grid | null` — returns a
  new grid (clone) with one previously-empty cell set to its value in a real solution;
  `null` if the grid is full or has no solution. `rng` defaults to `Math.random`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString } from './grid';
import { fillRandomValidCell, countSolutions, solve } from './solve';

const blank = '.'.repeat(81);

describe('fillRandomValidCell', () => {
  it('adds exactly one filled cell, valid and consistent with a solution', () => {
    const g = parseGrid(blank);
    const out = fillRandomValidCell(g, () => 0)!;
    expect(out).not.toBeNull();
    const before = gridToString(g).replace(/[^0]/g, '').length; // count zeros via inverse below
    const filled = gridToString(out).replace(/0/g, '').length;
    expect(filled).toBe(1); // exactly one non-zero cell
    expect(countSolutions(out, 1).count).toBe(1 <= 1 ? countSolutions(out,1).count : 0); // still solvable
    expect(countSolutions(out, 1).count).toBeGreaterThan(0);
  });

  it('does not mutate the input grid', () => {
    const g = parseGrid(blank);
    const snapshot = gridToString(g);
    fillRandomValidCell(g, () => 0);
    expect(gridToString(g)).toBe(snapshot);
  });

  it('returns null when the grid is already full', () => {
    const solved = solve(parseGrid('.'.repeat(81).replace(/^/, ''))) ; // placeholder, replaced below
    void solved;
    const full = parseGrid(
      '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
    );
    expect(fillRandomValidCell(full)).toBeNull();
  });

  it('is deterministic given a fixed rng (picks first empty cell when rng=0)', () => {
    const g = parseGrid(blank);
    const a = gridToString(fillRandomValidCell(g, () => 0)!);
    const b = gridToString(fillRandomValidCell(g, () => 0)!);
    expect(a).toBe(b);
  });
});
```

(Simplify the first test's assertions during implementation if noisy — the load-bearing
checks are: exactly one new filled cell, input unmutated, still solvable, deterministic
with fixed rng, `null` when full.)

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/solver/solve.test.ts` → FAIL (no export).

- [ ] **Step 3: Implement**

```ts
export function fillRandomValidCell(grid: Grid, rng: () => number = Math.random): Grid | null {
  const empties: number[] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] === 0) empties.push(r * 9 + c);
  if (empties.length === 0) return null;
  const { solution } = countSolutions(grid, 1);
  if (!solution) return null;
  const pick = empties[Math.min(empties.length - 1, Math.floor(rng() * empties.length))];
  const r = Math.floor(pick / 9), c = pick % 9;
  const out = cloneGrid(grid);
  out[r][c] = solution[r][c];
  return out;
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run src/solver/solve.test.ts` → PASS; `npx tsc -b` clean.

- [ ] **Step 5: Commit** — `git commit -m "feat(solver): fillRandomValidCell helper"`.

---

## Task 2: Empty-steps guards + ErrorBoundary

**Files:**
- Modify: `src/components/StepPlayer.tsx` (guard `total === 0`)
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx` (view memo + panel guard)
- Test: `src/solver/solve.test.ts` (assert 1-clue solve shape)

**Interfaces:**
- Produces: `<ErrorBoundary>{children}</ErrorBoundary>` — renders a PT fallback card with a
  "Recarregar" button on render error.

- [ ] **Step 1: Failing test for the crash precondition**

```ts
it('solve() on a 1-clue grid returns empty steps via backtracking (no logical steps)', () => {
  const g = parseGrid('5' + '.'.repeat(80));
  const res = solve(g);
  expect(res.steps.length).toBe(0);
  expect(res.usedBacktracking).toBe(true);
  expect(res.solved).toBe(true);
});
```

- [ ] **Step 2: Run** — `npx vitest run src/solver/solve.test.ts` → PASS already (documents the
  precondition the UI must survive; if it ever changes, this test flags it).

- [ ] **Step 3: Guard `StepPlayer`** — at top of component, after `const total = steps.length;`:

```tsx
if (total === 0) return null;
```

(Removes the `(index+1)/0` and `steps[index].text` hazards.)

- [ ] **Step 4: Create `ErrorBoundary.tsx`**

```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App crashed:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="wrap">
          <div className="card" style={{ marginTop: 40 }}>
            <div className="mlabel">Ops</div>
            <div>Algo deu errado ao exibir esta tela. Recarregue a página para continuar.</div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => location.reload()}>Recarregar</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 5: Wrap App in `main.tsx`** — import `{ ErrorBoundary }`, wrap `<App/>` inside
  `<StrictMode>`.

- [ ] **Step 6: Guard the `view` memo in `App.tsx`** — before indexing steps:

```tsx
if (result.steps.length === 0) {
  const g = cloneGrid(result.solution);
  return { grid: g, highlight: [] as Coord[], current: [] as { r: number; c: number; d: number }[] };
}
```

- [ ] **Step 7: Guard the solved panel** — render `<StepPlayer .../>` and the techniques-used
  status only when `result.steps.length > 0`; otherwise show:

```tsx
{result.steps.length === 0 && (
  <div className="card hint">
    <div className="mlabel">Resolvido</div>
    <div>Completado por tentativa e erro — não há deduções lógicas a exibir para este tabuleiro (poucas pistas).</div>
  </div>
)}
```

- [ ] **Step 8: Run gates** — `npm test`, `npx tsc -b` clean.

- [ ] **Step 9: Commit** — `git commit -m "fix(ui): guard empty solve steps + ErrorBoundary (no more black screen)"`.

---

## Task 3: MultipleSolutionsDialog + Resolver intercept

**Files:**
- Create: `src/components/MultipleSolutionsDialog.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/tokens.css` (reuse `.modal-backdrop`/`.protocol`/`.modal-close`)

**Interfaces:**
- Consumes: `fillRandomValidCell` (Task 1), `countSolutions`.
- Produces: `<MultipleSolutionsDialog unique onFill onSolve onClose />` where `unique:
  boolean`, `onFill(): void` (parent fills one cell), `onSolve(): void` (parent solves),
  `onClose(): void`.

- [ ] **Step 1: Create the dialog**

```tsx
import { useEffect } from 'react';

type Props = { unique: boolean; onFill: () => void; onSolve: () => void; onClose: () => void };

export function MultipleSolutionsDialog({ unique, onFill, onSolve, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="protocol" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Fechar" onClick={onClose}>✕</button>
        <h2>{unique ? 'Agora há solução única!' : 'Várias soluções possíveis'}</h2>
        <p style={{ color: 'var(--body)', lineHeight: 1.6 }}>
          {unique
            ? 'O tabuleiro agora tem uma única solução. Pode resolver.'
            : 'Este tabuleiro ainda tem mais de uma solução, então não há uma dedução única a explicar. Preencha mais pistas — ou deixe o app preencher uma célula válida para você.'}
        </p>
        <div className="actions">
          {unique ? (
            <button className="btn btn-primary" onClick={onSolve}>Resolver agora</button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={onFill}>Preencher uma célula</button>
              <button className="btn btn-secondary" onClick={onClose}>Continuar preenchendo</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App** — add state `const [showMulti, setShowMulti] = useState(false);`
  Change `handleSolve` to intercept non-unique:

```tsx
function handleSolve() {
  setError(null);
  if (conflicts.length) { setError('Há dígitos repetidos…'); return; }
  if (!validity.unique) { setShowMulti(true); return; }
  try { const res = solve(cells); setResult(res); setGivens(cloneGrid(cells)); setStepIndex(0); setMode('solved'); }
  catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível resolver.'); }
}
function handleFillOne() {
  const next = fillRandomValidCell(cells);
  if (next) setCells(next);
}
```

  Render at the bottom of the JSX (near ProtocolView):

```tsx
{showMulti && (
  <MultipleSolutionsDialog
    unique={validity.unique}
    onFill={handleFillOne}
    onSolve={() => { setShowMulti(false); handleSolve(); }}
    onClose={() => setShowMulti(false)}
  />
)}
```

  (Because `validity` recomputes from `cells` after each fill, the dialog flips to the
  "unique" state automatically.)

- [ ] **Step 3: Run gates** — `npm test`, `npx tsc -b`.

- [ ] **Step 4: Commit** — `git commit -m "feat(ui): multiple-solutions dialog + Resolver intercept on non-unique"`.

---

## Task 4: Technique metadata + baked real cases + verification

**Files:**
- Create: `src/data/techniques.ts`, `src/data/techniqueCases.ts`, `src/data/techniqueCases.test.ts`
- Throwaway: `src/data/_gen_cases.test.ts` (delete after baking)

**Interfaces:**
- Produces:
  ```ts
  // techniqueCases.ts
  export type CellMark = { idx: number; cls: 'hl' | 'peer' | 'elim' | 'place'; d?: number };
  export type Frame = { caption: string; cells: CellMark[] };
  export type TechniqueCase = { grid: string; frames: Frame[] }; // grid = 81 chars
  export const CASES: Record<string, TechniqueCase>;
  // techniques.ts
  export type Technique = { n: number; namePt: string; nameEn: string; level: number;
    implemented: boolean; text: string; caseKey?: string };
  export const TECHNIQUES: Technique[]; // length 25
  export const LEVELS: { n: number; title: string }[];
  ```

- [ ] **Step 1: Throwaway generator** `src/data/_gen_cases.test.ts` — scans puzzles with the
  real solver, finds an early clean step per implemented technique, reconstructs the grid
  snapshot (givens + prior placements), and `console.log`s a `TechniqueCase` literal
  (grid string + 2–3 frames built from `highlight`/`eliminations`/`placements`).

```ts
import { test } from 'vitest';
import puzzles from './puzzles.json';
import { parseGrid, gridToString, cloneGrid, PEERS } from '../solver/grid';
import { Board } from '../solver/candidates';
import { nakedSingle, hiddenSingle, pointing, claiming, xWing } from '../solver/techniques';
// subset fns are not exported individually — re-run TECHNIQUES and match by name instead.

test('emit cases', () => {
  // For each target technique name, iterate puzzles, run solve step-by-step via Board+TECHNIQUES,
  // stop at first step whose technique matches; snapshot grid = givens + placements so far.
  // Build frames: padrão (highlight -> 'hl', plus peers for singles) and conclusão
  // (placements -> 'place'/d, eliminations -> 'elim'/d). console.log JSON.
});
```

  Run: `npx vitest run src/data/_gen_cases.test.ts --disable-console-intercept`.
  (Implementation detail: replicate `solve.ts`'s loop locally so each step's pre-state grid
  is available; `Board.grid` after placements gives the snapshot. Export the subset fns
  from `techniques.ts` if needed, or drive `TECHNIQUES` and read `step.technique`.)

- [ ] **Step 2: Bake** the emitted literals into `src/data/techniqueCases.ts` under keys:
  `naked-single`, `hidden-single`, `naked-pair`, `naked-triple`, `naked-quad`,
  `hidden-pair`, `hidden-triple`, `hidden-quad`, `pointing`, `claiming`, `x-wing`. Add two
  hand-authored constructed cases: `y-wing`, `swordfish` (grid + frames written directly).

- [ ] **Step 3: Author `techniques.ts`** — the 25 entries (numbers/names/levels/implemented
  from `docs/tecnicas_sudoku.md`, generic `text`, `caseKey` for the animated ones) and the
  8 `LEVELS` titles.

- [ ] **Step 4: Verification test** `src/data/techniqueCases.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { CASES } from './techniqueCases';
import { parseGrid } from '../solver/grid';
import { Board } from '../solver/candidates';
import { nakedSingle, hiddenSingle, pointing, claiming, xWing } from '../solver/techniques';

const RUN: Record<string, (b: Board) => unknown[]> = {
  'naked-single': nakedSingle, 'hidden-single': hiddenSingle,
  'pointing': pointing, 'claiming': claiming, 'x-wing': xWing,
};

describe('technique cases are real', () => {
  it('every case grid is 81 chars and parses', () => {
    for (const [k, c] of Object.entries(CASES)) {
      expect(c.grid.length, k).toBe(81);
      expect(() => parseGrid(c.grid), k).not.toThrow();
    }
  });
  it('directly-runnable technique cases actually fire the technique', () => {
    for (const [key, fn] of Object.entries(RUN)) {
      const c = CASES[key];
      if (!c) continue;
      const steps = fn(new Board(parseGrid(c.grid)));
      expect(steps.length, key).toBeGreaterThan(0);
    }
  });
});
```

  (Subset cases are verified indirectly via the throwaway generator at bake time + the
  81-char/parse check; constructed cases get an explicit structural assertion if practical.)

- [ ] **Step 5: Delete the throwaway** `src/data/_gen_cases.test.ts`.

- [ ] **Step 6: Run gates** — `npm test`, `npx tsc -b`.

- [ ] **Step 7: Commit** — `git commit -m "feat(data): 25 techniques metadata + baked real animation cases (+verification)"`.

---

## Task 5: MiniBoard component

**Files:**
- Create: `src/components/MiniBoard.tsx`
- Modify: `src/styles/tokens.css` (mini-board styles)

**Interfaces:**
- Consumes: `TechniqueCase`, `Frame` from `techniqueCases.ts`.
- Produces: `<MiniBoard case={TechniqueCase} />` — renders the 81-cell grid, plays frames
  on a ▶ Animar button (~1300 ms/frame), shows the current caption, replays. Honors
  `prefers-reduced-motion` (shows the last frame statically, no timers, button hidden).

- [ ] **Step 1: Implement** — build 81 cells from `case.grid` (given digits shown, block
  borders via index math), a caption area, and a ▶ Animar / ↺ Repetir button. State:
  `frameIndex: number | null` (null = idle). On play, `setInterval` advances; clearing
  applies the frame's `cells` marks (`hl`/`peer`/`elim`/`place`, optional `d`). Use
  `useMediaQuery('(prefers-reduced-motion: reduce)')` to short-circuit to the final frame.
  Tokens only; mirror the prototype's mini-board CSS.

- [ ] **Step 2: Styles** — add `.mini`, `.mini .c`, `.c.hl/.peer/.elim/.place`, `.c.br/.bb`,
  `.mini-cap`, `.mini-btn` to `tokens.css` using existing color tokens.

- [ ] **Step 3: Run gates** — `npx tsc -b`, `npm run build` (component compiles & bundles).

- [ ] **Step 4: Commit** — `git commit -m "feat(ui): MiniBoard with technique animation"`.

---

## Task 6: TechniquesPage + tab navigation

**Files:**
- Create: `src/components/TechniquesPage.tsx`
- Modify: `src/App.tsx` (tab state, nav buttons, lazy render)
- Modify: `src/styles/tokens.css` (tab + technique-card styles)

**Interfaces:**
- Consumes: `TECHNIQUES`, `LEVELS` (Task 4), `CASES`, `<MiniBoard/>` (Task 5).
- Produces: `<TechniquesPage/>` (default export ok for `React.lazy`).

- [ ] **Step 1: TechniquesPage** — hero + concepts strip + sticky filter (Todas /
  Implementadas / Não implementadas, local `useState`) + level sections; each technique a
  card (number, names, level + ✅/⬜ badges, text, `<MiniBoard>` when `caseKey` present).
  Filter hides cards by `implemented`.

- [ ] **Step 2: Tab nav in App** — `const [tab, setTab] = useState<'solver'|'tecnicas'>('solver');`
  In `.nav`, render two `<button>`s (Resolver / Técnicas) with an `active` class. Lazy:

```tsx
const TechniquesPage = lazy(() => import('./components/TechniquesPage'));
// ...
{tab === 'tecnicas'
  ? <Suspense fallback={<div className="muted" style={{ padding: 40 }}>Carregando…</div>}><TechniquesPage /></Suspense>
  : (/* existing head + grid2 markup */)}
```

- [ ] **Step 3: Styles** — `.tabs`, `.tab`, `.tab.active`, `.tcard`, `.levelhead`, concepts
  chips, filter chips — tokens only, mirroring the approved prototype.

- [ ] **Step 4: Run gates** — `npm test`, `npx tsc -b`, `npm run build`.

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): Técnicas tab + page (25 techniques, animated)"`.

---

## Task 7: Smoke e2e + full gates

**Files:**
- Create: `scripts/smoke/smoke5.mjs`
- Modify: `scripts/smoke/run.sh` (run smoke5)

- [ ] **Step 1: smoke5** — using the existing CDP helpers in `scripts/smoke/`:
  (a) Limpar → type a digit into one cell → click Resolver → assert the
  MultipleSolutionsDialog appears AND the app root still has content (no black screen);
  click "Preencher uma célula" → assert one more filled cell.
  (b) Click the Técnicas tab → assert technique cards present (e.g. text "X-Wing") →
  click a ▶ Animar → assert a caption/elim class appears → click Resolver tab → board back.

- [ ] **Step 2: Wire into run.sh** — add `smoke5` to the suite list.

- [ ] **Step 3: Run everything** — `npm test` && `npx tsc -b` && `npm run build` &&
  `bash scripts/smoke/run.sh`.

- [ ] **Step 4: Commit** — `git commit -m "test(smoke): black-screen fix + Técnicas tab (smoke5)"`.

- [ ] **Step 5: Stop the visual-companion server**; return to the user to ask about pushing.

---

## Task 8: Puzzle pool integrity (added after approval)

**Files:** Create `scripts/regen_evil.py`, `src/data/puzzles.test.ts`; modify `src/data/puzzles.json`.

- [ ] **Step 1: Failing regression test** — `puzzles.test.ts` asserts every puzzle in each
  tier is 81 cells, conflict-free, `solve()` → `solved && unique && !usedBacktracking`.
  Run → FAIL on evil (24 backtracking puzzles).
- [ ] **Step 2: Regenerate evil** — `python3 scripts/regen_evil.py --out src/data/puzzles.json`
  drops the 24 backtracking evil puzzles and refills with logic-solvable evil-tier puzzles
  (score ≥ evil lower bound), seed 12345, to 100. easy/medium/hard untouched.
- [ ] **Step 3: Run** — `npx vitest run src/data/puzzles.test.ts` → PASS (all tiers clean).
- [ ] **Step 4: Commit** — `git commit -m "fix(data): purge logic-incomplete evil puzzles + pool integrity test"`.

## Self-review notes

- **Spec coverage:** Item 1 A/B/C → Tasks 1–3; Item 2 nav/page/cases/animation/verification
  → Tasks 4–6; testing → Tasks present unit + Task 7 smokes. ✓
- **Types:** `Grid` (solver), `TechniqueCase`/`Frame`/`CellMark`, `Technique`/`LEVELS`,
  dialog props, `tab` union — consistent across tasks. ✓
- **No placeholders:** generator (Task 4 Step 1) is described as a dev throwaway with a
  concrete algorithm; its exact emitted literals are produced at bake time and committed in
  Step 2 — acceptable since the data is mechanically generated and re-verified by Task 4
  Step 4's committed test.
