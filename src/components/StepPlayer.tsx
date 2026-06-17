import { useEffect, useState } from 'react';
import type { Step } from '../solver/techniques';

type Props = {
  steps: Step[];
  index: number;
  setIndex: (i: number) => void;
  onShowProtocol: () => void;
};

export function StepPlayer({ steps, index, setIndex, onShowProtocol }: Props) {
  const [auto, setAuto] = useState(false);
  const total = steps.length;
  const step = steps[index];
  const pct = Math.round(((index + 1) / total) * 100);

  useEffect(() => {
    if (!auto) return;
    if (index >= total - 1) {
      setAuto(false);
      return;
    }
    const id = setTimeout(() => setIndex(index + 1), 900);
    return () => clearTimeout(id);
  }, [auto, index, total, setIndex]);

  return (
    <div className="step">
      <div className="meta">
        <span className="count">PASSO {String(index + 1).padStart(2, '0')} / {total}</span>
        <span className="pill">{step.technique}</span>
      </div>
      <p className="text">{step.text}</p>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>
      <div className="nav-steps">
        <button className="btn btn-secondary" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
          ◀ Anterior
        </button>
        <button className="btn btn-primary" onClick={() => setIndex(Math.min(total - 1, index + 1))} disabled={index === total - 1}>
          Próximo ▶
        </button>
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={() => setAuto((a) => !a)}>
          {auto ? '⏸ Pausar' : '⏯ Auto'}
        </button>
      </div>
      <div className="more">
        <a onClick={onShowProtocol}>Ver explicação completa (lista)</a>
      </div>
    </div>
  );
}
