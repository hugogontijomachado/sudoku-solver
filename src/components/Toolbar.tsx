type Props = {
  mode: 'edit' | 'solved';
  canSolve: boolean;
  onSolve: () => void;
  onClear: () => void;
  onExample: () => void;
  onEdit: () => void;
};

export function Toolbar({ mode, canSolve, onSolve, onClear, onExample, onEdit }: Props) {
  if (mode === 'edit') {
    return (
      <div className="toolbar">
        <button className="btn btn-primary" onClick={onSolve} disabled={!canSolve}>
          ▶ Resolver
        </button>
        <button className="btn btn-secondary" onClick={onClear}>Limpar</button>
        <button className="btn btn-ghost" onClick={onExample}>Exemplo</button>
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
