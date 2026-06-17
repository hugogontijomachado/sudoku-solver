import { DifficultyMenu } from './DifficultyMenu';
import type { Difficulty } from '../data/loadPuzzles';

type Props = {
  mode: 'edit' | 'solved' | 'play';
  canSolve: boolean;
  canCheck: boolean;
  loading: boolean;
  onSolve: () => void;
  onCheck: () => void;
  onClear: () => void;
  onEdit: () => void;
  onRandom: (d: Difficulty) => void;
};

export function Toolbar({ mode, canSolve, canCheck, loading, onSolve, onCheck, onClear, onEdit, onRandom }: Props) {
  if (mode === 'edit') {
    return (
      <div className="toolbar">
        <button className="btn btn-primary" onClick={onSolve} disabled={!canSolve}>▶ Resolver</button>
        <button className="btn btn-secondary" onClick={onCheck} disabled={!canCheck}>✔ Conferir</button>
        <button className="btn btn-ghost" onClick={onClear}>Limpar</button>
        <DifficultyMenu onSelect={onRandom} disabled={loading} />
      </div>
    );
  }
  return (
    <div className="toolbar">
      <button className="btn btn-secondary" onClick={onEdit}>✎ Editar</button>
      <button className="btn btn-ghost" onClick={onClear}>Limpar</button>
    </div>
  );
}
