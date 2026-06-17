import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { TechniqueCase, CellMark } from '../data/techniqueCases';
import { useMediaQuery } from '../hooks/layout';

const FRAME_MS = 1300;

// Renders an 81-cell grid from a real case snapshot and animates the deduction frame by
// frame (pattern → conclusion). Respects prefers-reduced-motion by showing the final
// frame statically (no timers, no button).
export function MiniBoard({ tcase }: { tcase: TechniqueCase }) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const last = tcase.frames.length - 1;
  // -1 = idle (no marks yet); otherwise the frame index currently shown.
  const [frameIdx, setFrameIdx] = useState(reduce ? last : -1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (frameIdx >= last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setFrameIdx((i) => i + 1), FRAME_MS);
    return () => clearTimeout(id);
  }, [playing, frameIdx, last]);

  const marks = new Map<number, CellMark>();
  if (frameIdx >= 0) for (const m of tcase.frames[frameIdx].cells) marks.set(m.idx, m);

  const caption =
    frameIdx >= 0 ? tcase.frames[frameIdx].caption : 'Clique em ▶ Animar para ver a dedução.';

  function play() {
    setFrameIdx(0);
    setPlaying(true);
  }

  const label = playing ? '● Animando…' : frameIdx >= last ? '↺ Repetir' : '▶ Animar';

  return (
    <div className="mb-wrap">
      <div className="mb-col">
        <div className="mb-grid" aria-hidden="true">
          {Array.from({ length: 81 }, (_, i) => {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const ch = tcase.grid[i];
            const given = ch !== '0' && ch !== '.';
            const m = marks.get(i);
            const cls = ['mb-cell'];
            if (c === 2 || c === 5) cls.push('mb-br');
            if (r === 2 || r === 5) cls.push('mb-bb');
            if (given) cls.push('mb-given');
            if (m) cls.push('mb-' + m.cls);
            let content: ReactNode = given ? ch : '';
            if (m?.cls === 'place') content = String(m.d);
            else if (m?.cls === 'elim') content = <span className="mb-strike">{m.d}</span>;
            return (
              <div key={i} className={cls.join(' ')}>
                {content}
              </div>
            );
          })}
        </div>
        {!reduce && (
          <button className="mb-btn" onClick={play} disabled={playing}>
            {label}
          </button>
        )}
      </div>
      <div className={'mb-cap' + (frameIdx < 0 ? ' mb-cap-idle' : '')}>{caption}</div>
    </div>
  );
}
