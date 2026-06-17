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
