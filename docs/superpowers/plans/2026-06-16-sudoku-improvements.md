# Sudoku Solver UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4 `todo.txt` improvements: block solving unsolvable grids, add a mobile-friendly numeric keypad, fix the right-hand step card height on desktop, and add a code-toggleable completion celebration.

**Architecture:** Add one pure solver helper (`hasSolution`) and wire it into `App`'s `canSolve`. Add two presentational components (`NumberPad`, `Celebration`) and two tiny layout hooks (`useMediaQuery`, `useElementHeight`). All visual styling goes in `src/styles/tokens.css` using existing `DESIGN.md` CSS variables. No new npm dependencies.

**Tech Stack:** React 19, Vite 8, TypeScript 6 (strict), Vitest 4. Plain CSS variables.

## Global Constraints

- Type-only imports MUST use `import type` (`verbatimModuleSyntax`).
- No unused locals/params (`noUnusedLocals`, `noUnusedParameters`).
- `*.test.ts` under `src/` ARE type-checked by `tsc -b`.
- React 19 JSX: no `import React`; for React types use `import type { X } from 'react'`.
- All UI copy in Portuguese. Colors via `var(--token)` from `tokens.css`; never inline hex.
- No new dependencies.
- Gate every task on `npx tsc -b` clean + `npm test` green. Final task adds `npm run build`.
- Commands run inside `/Users/hugocemep/GitHub/sudoku-solver`.

---

### Task 1: `hasSolution` solver helper (TDD)

**Files:**
- Modify: `src/solver/solve.ts` (add exported `hasSolution`)
- Test: `src/solver/solver.test.ts` (append a `describe` block)

**Interfaces:**
- Produces: `hasSolution(grid: Grid): boolean` — `true` iff `countSolutions(grid, 1).count > 0`.

- [ ] **Step 1: Write the failing tests** — append to `src/solver/solver.test.ts`. Add `hasSolution` to the existing solve import (`import { solve, hasSolution } from './solve';`) and append:

```ts
describe('hasSolution', () => {
  it('is true for a solvable puzzle', () => {
    expect(hasSolution(parseGrid(PUZZLE))).toBe(true);
  });

  it('is true for the empty grid', () => {
    expect(hasSolution(parseGrid('.'.repeat(81)))).toBe(true);
  });

  it('is false for an unsolvable grid (no candidate, no duplicate)', () => {
    const unsolvable = '12345678.' + '........9' + '.'.repeat(63);
    expect(hasSolution(parseGrid(unsolvable))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- solver.test.ts`
Expected: FAIL — `hasSolution` is not exported (import error / not a function).

- [ ] **Step 3: Implement `hasSolution`** — add to `src/solver/solve.ts`, right after `countSolutions` (before `solve`):

```ts
export function hasSolution(grid: Grid): boolean {
  return countSolutions(grid, 1).count > 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests green (the existing 22 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/solver/solve.ts src/solver/solver.test.ts
git commit -m "feat(solver): add hasSolution helper for no-solution detection"
```

---

### Task 2: Block "Resolver" on no-solution grids (App wiring)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `hasSolution` from `./solver/solve`.

- [ ] **Step 1: Import `hasSolution`** — extend the existing solve import in `src/App.tsx`:

```ts
import { solve, hasSolution } from './solve';
```

Note: the current line is `import { solve } from './solve';` and `import type { SolveResult } from './solve';` — keep the `import type` line as-is; only add `hasSolution` to the value import.

- [ ] **Step 2: Add the `solvable` memo and fold into `canSolve`** — replace the existing line `const canSolve = conflicts.length === 0 && filledCount > 0;` with:

```ts
const solvable = useMemo(
  () => (conflicts.length === 0 && filledCount > 0 ? hasSolution(cells) : true),
  [cells, conflicts.length, filledCount],
);
const canSolve = conflicts.length === 0 && filledCount > 0 && solvable;
```

- [ ] **Step 3: Add the live edit-mode banner** — directly after the existing `{error && <div className="banner error">{error}</div>}` line, add:

```tsx
{mode === 'edit' && !solvable && (
  <div className="banner error">Este Sudoku não tem solução. Revise as pistas.</div>
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: clean (no output / exit 0).

- [ ] **Step 5: Runtime sanity** — `npm run dev`, type the unsolvable grid `1 2 3 4 5 6 7 8` across row 1 (leaving r1c9 empty) and a `9` in r2c9; confirm Resolver is disabled and the banner shows. Then `npm test` to confirm still green.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): disable Resolver and warn when the grid has no solution"
```

---

### Task 3: On-screen numeric keypad (always visible, edit mode)

**Files:**
- Create: `src/components/NumberPad.tsx`
- Modify: `src/App.tsx` (render it in the board card, edit mode)
- Modify: `src/styles/tokens.css` (keypad styles)

**Interfaces:**
- Produces: `NumberPad` — `{ disabled: boolean; onInput: (d: number) => void; onErase: () => void }`.

- [ ] **Step 1: Create `src/components/NumberPad.tsx`**

```tsx
type Props = {
  disabled: boolean;
  onInput: (d: number) => void;
  onErase: () => void;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberPad({ disabled, onInput, onErase }: Props) {
  return (
    <div className="numpad">
      <div className="numpad-grid">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className="numpad-btn"
            disabled={disabled}
            onClick={() => onInput(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="numpad-btn numpad-erase"
          disabled={disabled}
          onClick={onErase}
          aria-label="Apagar"
        >
          ⌫
        </button>
      </div>
      {disabled && <div className="numpad-hint">Selecione uma célula para digitar</div>}
    </div>
  );
}
```

- [ ] **Step 2: Render it in `App.tsx`** — import at the top with the other component imports:

```ts
import { NumberPad } from './components/NumberPad';
```

Then inside the board `<div className="card">`, between `<Board ... />` and `<div className="legend">...`, add:

```tsx
{mode === 'edit' && (
  <NumberPad
    disabled={!selected}
    onInput={(d) => selected && setCell(selected.r, selected.c, d)}
    onErase={() => selected && setCell(selected.r, selected.c, 0)}
  />
)}
```

- [ ] **Step 3: Add keypad styles** — append to `src/styles/tokens.css`:

```css
.numpad { margin-top: 16px; }
.numpad-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.numpad-btn {
  min-height: 48px; border-radius: 8px; border: 1px solid var(--hairline-strong);
  background: var(--surface-elevated); color: var(--ink);
  font-family: inherit; font-size: 20px; font-weight: 600; cursor: pointer;
}
.numpad-btn:hover:not(:disabled) { background: var(--surface-card); }
.numpad-btn:active:not(:disabled) { background: var(--primary); color: var(--on-primary); }
.numpad-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.numpad-erase { font-size: 18px; color: var(--body); }
.numpad-hint { margin-top: 10px; color: var(--muted); font-size: 13px; text-align: center; }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 5: Runtime sanity** — `npm run dev`; on desktop and a narrow viewport, click a cell then tap digits (fills) and ⌫ (clears). With no cell selected, buttons are disabled and the hint shows.

- [ ] **Step 6: Commit**

```bash
git add src/components/NumberPad.tsx src/App.tsx src/styles/tokens.css
git commit -m "feat(ui): add always-visible numeric keypad for touch input"
```

---

### Task 4: Fix step card height on desktop (internal scroll)

**Files:**
- Create: `src/hooks/layout.ts` (`useMediaQuery`, `useElementHeight`)
- Modify: `src/App.tsx` (measure board card, detect desktop, pass height to StepPlayer)
- Modify: `src/components/StepPlayer.tsx` (accept `cardHeight`, apply to `.step`)
- Modify: `src/styles/tokens.css` (flex column + scrollable `.text`)

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`; `useElementHeight<T extends HTMLElement>(): [RefObject<T | null>, number]`.
- `StepPlayer` gains optional prop `cardHeight?: number`.

- [ ] **Step 1: Create `src/hooks/layout.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useElementHeight<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height];
}
```

- [ ] **Step 2: Wire into `App.tsx`** — add imports:

```ts
import { useMediaQuery, useElementHeight } from './hooks/layout';
```

Inside the component body (near the other hooks), add:

```ts
const isDesktop = useMediaQuery('(min-width: 881px)');
const [boardCardRef, boardCardH] = useElementHeight<HTMLDivElement>();
```

Attach the ref to the board card: change `<div className="card">` (the one wrapping `<Board />`) to `<div className="card" ref={boardCardRef}>`.

Pass the height to `StepPlayer` — add the prop to the existing `<StepPlayer ... />`:

```tsx
cardHeight={isDesktop ? boardCardH : undefined}
```

- [ ] **Step 3: Accept `cardHeight` in `StepPlayer.tsx`** — add to the `Props` type:

```ts
cardHeight?: number;
```

Add `cardHeight` to the destructured props, and apply it to the root `.step` div:

```tsx
<div className="step" style={cardHeight ? { height: cardHeight } : undefined}>
```

- [ ] **Step 4: Add the flex-column scroll styles** — append to `src/styles/tokens.css`:

```css
.step { display: flex; flex-direction: column; }
.step .meta, .step .progress, .step .nav-steps, .step .more { flex-shrink: 0; }
.step .text { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Runtime sanity** — `npm run dev`; on desktop (≥881px), solve the Exemplo and step through: the step card stays a fixed height (= board card), long instruction text scrolls inside `.text`, and the Anterior/Próximo buttons do not move. Narrow the window below 881px: the card returns to natural height (buttons flow normally).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/layout.ts src/App.tsx src/components/StepPlayer.tsx src/styles/tokens.css
git commit -m "feat(ui): pin step card to board height on desktop with scrollable text"
```

---

### Task 5: Completion celebration (confetti + glow + badge, code-toggleable)

**Files:**
- Create: `src/components/Celebration.tsx` (exports `Celebration` and `CELEBRATION`)
- Modify: `src/components/Board.tsx` (accept `celebrate` prop → glow class)
- Modify: `src/App.tsx` (compute `celebrate`, render `<Celebration>`, pass glow flag to `Board`)
- Modify: `src/styles/tokens.css` (confetti, badge, board glow)

**Interfaces:**
- Produces: `CELEBRATION: { confetti: boolean; boardGlow: boolean; badge: boolean }`; `Celebration` — `{ active: boolean }`.
- `Board` gains optional prop `celebrate?: boolean`.

- [ ] **Step 1: Create `src/components/Celebration.tsx`**

```tsx
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useMediaQuery } from '../hooks/layout';

// Code-only toggles — flip these to test each effect. No user-facing control.
export const CELEBRATION = { confetti: true, boardGlow: true, badge: true };

const COLORS = ['var(--primary)', '#ffffff', 'var(--primary-active)'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        dur: 1.8 + Math.random() * 1.2,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => {
        const style: CSSProperties = {
          left: `${p.left}%`,
          width: p.size,
          height: p.size,
          background: p.color,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
        };
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}

export function Celebration({ active }: { active: boolean }) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (!active) return null;
  return (
    <>
      {CELEBRATION.confetti && !reduce && <Confetti />}
      {CELEBRATION.badge && <div className="celebrate-badge">✓ Resolvido!</div>}
    </>
  );
}
```

- [ ] **Step 2: Add the `celebrate` prop to `Board.tsx`** — add `celebrate?: boolean;` to `Props`, add `celebrate` to the destructured params, and append the class when set. Change the board container line to:

```tsx
<div className={`board${celebrate ? ' celebrate' : ''}`} tabIndex={0} onKeyDown={onKeyDown}>
```

- [ ] **Step 3: Wire into `App.tsx`** — import:

```ts
import { Celebration, CELEBRATION } from './components/Celebration';
```

Compute the flag in the component body:

```ts
const celebrate = mode === 'solved' && !!result && stepIndex === result.steps.length - 1;
```

Pass the glow flag to `Board` — add to the existing `<Board ... />` props:

```tsx
celebrate={CELEBRATION.boardGlow && celebrate}
```

Render the overlay inside the board card (the `<div className="card" ref={boardCardRef}>`), as the last child after the legend:

```tsx
<Celebration active={celebrate} />
```

Make the board card a positioning context — add `board-card` to its className: `<div className="card board-card" ref={boardCardRef}>`.

- [ ] **Step 4: Add celebration styles** — append to `src/styles/tokens.css`:

```css
.board-card { position: relative; }

.board.celebrate { animation: board-pulse 1.2s ease-in-out 2; }
@keyframes board-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 255, 105, 0); }
  50% { box-shadow: 0 0 0 4px rgba(250, 255, 105, 0.6), 0 0 24px 4px rgba(250, 255, 105, 0.45); }
}

.celebrate-badge {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: var(--primary); color: var(--on-primary);
  font-weight: 700; font-size: 22px; letter-spacing: 0.5px;
  padding: 12px 24px; border-radius: 9999px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  animation: badge-in 0.35s ease-out; z-index: 5; pointer-events: none;
}
@keyframes badge-in {
  0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 50; }
.confetti-piece {
  position: absolute; top: -16px; border-radius: 2px;
  animation-name: confetti-fall; animation-timing-function: linear; animation-fill-mode: forwards;
}
@keyframes confetti-fall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(85vh) rotate(720deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .board.celebrate { animation: none; }
  .celebrate-badge { animation: none; }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 6: Runtime sanity** — `npm run dev`; solve the Exemplo, click Próximo to the last step: confetti falls, the board glows, and the "✓ Resolvido!" badge appears. Step back (badge/glow clear) and forward (re-fires). Toggle each flag in `CELEBRATION` to confirm independent on/off.

- [ ] **Step 7: Commit**

```bash
git add src/components/Celebration.tsx src/components/Board.tsx src/App.tsx src/styles/tokens.css
git commit -m "feat(ui): add code-toggleable completion celebration (confetti, glow, badge)"
```

---

### Task 6: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: PASS — all green (25 tests / 4 files).

- [ ] **Step 2: Type-check + production build**

Run: `npm run build`
Expected: `tsc -b` clean, `vite build` succeeds.

- [ ] **Step 3: Headless-Chrome runtime smoke** — write `/tmp/sdd-sudoku/smoke2.mjs` (CDP via Chrome.app + Node global WebSocket, per the handoff pattern). Start the preview server (`npm run preview`), then drive: load app → click "Exemplo" → assert the keypad (`.numpad-grid`) is present in edit mode → click "Resolver" → assert `PASSO 01` appears → click "Próximo" to the last step → assert the celebration badge text "Resolvido" is in the DOM. Print PASS/FAIL.

Run: `node /tmp/sdd-sudoku/smoke2.mjs`
Expected: PASS lines for keypad, solve, and celebration.

- [ ] **Step 4: Final commit (if the smoke script is kept in-repo, otherwise skip)** — the smoke lives in `/tmp`, so nothing to commit here. Confirm the working tree is clean:

```bash
git status --short
```
Expected: empty.

---

## Self-Review

**Spec coverage:**
- Item 1 (no-solution guard) → Task 1 (`hasSolution` + tests) + Task 2 (App wiring, banner, disabled button). ✓
- Item 2 (mobile keypad, always visible) → Task 3. ✓
- Item 3 (PC step card fixed to board height + internal scroll; mobile unchanged) → Task 4. ✓
- Item 4 (celebration, 3 independent code toggles, reduced-motion) → Task 5. ✓
- Verification (unit + build + CDP smoke) → Task 6. ✓

**Placeholder scan:** No TBD/TODO; every code/CSS step shows full content. ✓

**Type consistency:** `hasSolution(grid: Grid): boolean` used identically in Task 1/2. `useElementHeight` returns `[RefObject<T | null>, number]`, consumed as `[boardCardRef, boardCardH]`. `StepPlayer.cardHeight?: number` defined in Task 4 / passed from App. `Board.celebrate?: boolean` defined in Task 5 / passed from App. `Celebration` props `{ active }` and `CELEBRATION` flags consistent. ✓
