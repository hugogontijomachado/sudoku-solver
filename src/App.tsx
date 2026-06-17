import { useMemo, useState } from 'react';
import { emptyGrid, cloneGrid, parseGrid, findConflicts } from './solver/grid';
import type { Grid, Coord } from './solver/grid';
import { solve, hasSolution } from './solver/solve';
import type { SolveResult } from './solver/solve';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { NumberPad } from './components/NumberPad';
import { Celebration, CELEBRATION } from './components/Celebration';
import { StepPlayer } from './components/StepPlayer';
import { ProtocolView } from './components/ProtocolView';
import { useMediaQuery, useElementHeight } from './hooks/layout';
import { loadRandomPuzzle } from './data/loadPuzzles';
import type { Difficulty } from './data/loadPuzzles';

const EXAMPLE = [
  '...5...6.', '8.9....1.', '16..87...', '3...26...', '..7.1.6..',
  '...85...3', '...47..21', '.4....9.8', '.8...3...',
].join('\n');

export default function App() {
  const [cells, setCells] = useState<Grid>(() => parseGrid(EXAMPLE));
  const [mode, setMode] = useState<'edit' | 'solved'>('edit');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [givens, setGivens] = useState<Grid>(emptyGrid());
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<Coord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProtocol, setShowProtocol] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 881px)');
  const [boardCardRef, boardCardH] = useElementHeight<HTMLDivElement>();
  const celebrate = mode === 'solved' && !!result && stepIndex === result.steps.length - 1;

  const conflicts = useMemo(() => (mode === 'edit' ? findConflicts(cells) : []), [cells, mode]);
  const filledCount = useMemo(() => cells.flat().filter((v) => v).length, [cells]);
  const solvable = useMemo(
    () => (conflicts.length === 0 && filledCount > 0 ? hasSolution(cells) : true),
    [cells, conflicts.length, filledCount],
  );
  const canSolve = conflicts.length === 0 && filledCount > 0 && solvable;

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
        <div className="card board-card" ref={boardCardRef}>
          <Board
            mode={mode}
            editGrid={cells}
            givens={mode === 'solved' ? givens : cells}
            view={view}
            conflicts={conflicts}
            selected={selected}
            setSelected={setSelected}
            setCell={setCell}
            celebrate={CELEBRATION.boardGlow && celebrate}
          />
          {mode === 'edit' && (
            <NumberPad
              disabled={!selected}
              onInput={(d) => selected && setCell(selected.r, selected.c, d)}
              onErase={() => selected && setCell(selected.r, selected.c, 0)}
            />
          )}
          <div className="legend">
            <span><i className="sw-given" />pista (digitada)</span>
            <span><i className="sw-filled" />preenchido pelo solver</span>
            <span><i className="sw-cur" />passo atual</span>
          </div>
          <Celebration active={celebrate} />
        </div>

        <div>
          <Toolbar
            mode={mode}
            canSolve={canSolve}
            canCheck={false}
            loading={loading}
            onSolve={handleSolve}
            onCheck={() => {}}
            onClear={handleClear}
            onEdit={handleEdit}
            onRandom={handleRandom}
          />

          {error && <div className="banner error">{error}</div>}

          {mode === 'edit' && !solvable && (
            <div className="banner error">Este Sudoku não tem solução. Revise as pistas.</div>
          )}

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
                cardHeight={isDesktop ? boardCardH : undefined}
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
