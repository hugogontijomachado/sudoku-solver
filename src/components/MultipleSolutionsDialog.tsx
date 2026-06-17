import { useEffect } from 'react';

type Props = {
  unique: boolean;
  onFill: () => void;
  onSolve: () => void;
  onClose: () => void;
};

// Shown when Resolver is pressed on a board that still has more than one solution. The
// parent recomputes `unique` from the grid after each fill, so this flips to the "unique"
// state on its own once enough cells are present.
export function MultipleSolutionsDialog({ unique, onFill, onSolve, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="protocol multi-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Fechar" onClick={onClose}>
          ✕
        </button>
        <h2>{unique ? 'Agora há solução única!' : 'Ainda há várias soluções'}</h2>
        <p className="multi-text">
          {unique ? (
            'Este tabuleiro agora tem uma única solução — dá para resolver e explicar passo a passo.'
          ) : (
            <>
              Com poucas pistas, este tabuleiro tem <b>mais de uma</b> solução possível, então não
              existe uma dedução única para explicar. Preencha mais pistas — ou deixe o app preencher
              uma célula válida para você, aproximando de uma solução única.
            </>
          )}
        </p>
        <div className="actions">
          {unique ? (
            <button className="btn btn-primary" onClick={onSolve}>
              Resolver agora
            </button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={onFill}>
                Preencher uma célula
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Continuar preenchendo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
