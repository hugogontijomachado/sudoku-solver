import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useMediaQuery } from '../hooks/layout';

// Code-only toggles — flip these to test each effect. No user-facing control.
export const CELEBRATION = { confetti: true, boardGlow: true, badge: true };

const COLORS = ['var(--primary)', '#ffffff', 'var(--primary-active)'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        dur: 1.8 + Math.random() * 1.2,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => {
        const style: CSSProperties = {
          left: `${p.left}%`,
          width: p.size,
          height: p.size,
          background: p.color,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
        };
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}

export function Celebration({ active }: { active: boolean }) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (!active) return null;
  return (
    <>
      {CELEBRATION.confetti && !reduce && <Confetti />}
      {CELEBRATION.badge && <div className="celebrate-badge">✓ Resolvido!</div>}
    </>
  );
}
