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
