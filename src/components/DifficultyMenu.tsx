import { useEffect, useRef, useState } from 'react';
import type { Difficulty } from '../data/loadPuzzles';

const ITEMS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Fácil' },
  { key: 'medium', label: 'Médio' },
  { key: 'hard', label: 'Difícil' },
  { key: 'evil', label: 'Evil' },
];

export function DifficultyMenu({ onSelect, disabled }: { onSelect: (d: Difficulty) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => setOpen((o) => !o)}>
        Aleatório ▾
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {ITEMS.map((it) => (
            <button
              key={it.key}
              type="button"
              className="dropdown-item"
              role="menuitem"
              onClick={() => { setOpen(false); onSelect(it.key); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
