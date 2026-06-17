# Sudoku Solver

Web app that solves a 9×9 Sudoku and explains every deduction, step by step.

- Solver: pure TypeScript (human techniques + backtracking fallback), runs in the browser.
- UI: React 19 + Vite. Design follows `DESIGN.md`. UI and step text are in Portuguese.

## Features

- **Enter a grid** with the keyboard (click a cell, type 1–9 / Backspace, arrow-key
  navigation) **or the on-screen numeric keypad** below the board — works on touch/mobile.
- **No-solution guard:** repeated-digit conflicts and genuinely unsolvable grids are
  detected live; **Resolver** stays disabled (with an explanation) until the grid is solvable.
- **Step-by-step player:** walk each deduction (Próximo/Anterior, Auto-play), with the
  technique and a plain-language explanation. On desktop the card is pinned to the board's
  height with the text scrolling internally, so the controls never jump.
- **Full protocol → PDF** via the browser print dialog.
- **Completion celebration** on the last step (confetti, board glow, "Resolvido!" badge).
  Each effect is a **code-only toggle** in `src/components/Celebration.tsx`
  (`export const CELEBRATION = { confetti, boardGlow, badge }`) — flip a boolean to enable/
  disable it; there is no user-facing control. Respects `prefers-reduced-motion`.

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
