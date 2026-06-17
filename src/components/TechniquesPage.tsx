import { useState } from 'react';
import { TECHNIQUES, LEVELS, CONCEPTS } from '../data/techniques';
import { CASES } from '../data/techniqueCases';
import { MiniBoard } from './MiniBoard';

type Filter = 'all' | 'impl' | 'todo';

export default function TechniquesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = TECHNIQUES.filter((t) =>
    filter === 'all' ? true : filter === 'impl' ? t.implemented : !t.implemented,
  );
  const implLogical = TECHNIQUES.filter((t) => t.implemented && t.level <= 4).length;

  return (
    <div className="tecnicas">
      <div className="head">
        <h1>As 25 técnicas de Sudoku</h1>
        <p>
          Todas as estratégias lógicas para resolver sem chutar, da mais simples à mais avançada.
          As marcadas com <b>✅</b> são as que o solver usa e explica passo a passo — clique em{' '}
          <b>▶ Animar</b> para ver a dedução acontecer num caso real.
        </p>
      </div>

      <div className="concepts">
        {CONCEPTS.map((c) => (
          <div className="concept" key={c.term}>
            <b>{c.term}</b>
            <p>{c.def}</p>
          </div>
        ))}
      </div>

      <div className="filterbar">
        <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>
          Todas
        </button>
        <button className={'chip' + (filter === 'impl' ? ' on' : '')} onClick={() => setFilter('impl')}>
          Implementadas ✅
        </button>
        <button className={'chip' + (filter === 'todo' ? ' on' : '')} onClick={() => setFilter('todo')}>
          Não implementadas ⬜
        </button>
        <span className="sp" />
        <span className="count">25 técnicas · {implLogical} lógicas no solver</span>
      </div>

      {LEVELS.map((lvl) => {
        const items = visible.filter((t) => t.level === lvl.n);
        if (!items.length) return null;
        return (
          <section key={lvl.n}>
            <div className="levelhead">
              <span className="ln">Nível {lvl.n}</span> {lvl.title}
            </div>
            <div className="tgrid">
              {items.map((t) => (
                <article className={'tcard' + (t.implemented ? '' : ' no')} key={t.n}>
                  <div className="thead">
                    <span className="tnum">{String(t.n).padStart(2, '0')}</span>
                    <div className="tname">
                      <div className="tpt">{t.namePt}</div>
                      <div className="ten">{t.nameEn}</div>
                    </div>
                    <span className="sp" />
                    <span className={'tbadge ' + (t.implemented ? 'impl' : 'no')}>
                      {t.implemented ? '✅ no solver' : '⬜ não impl.'}
                    </span>
                  </div>
                  <p className="ttext">{t.text}</p>
                  {t.caseKey && CASES[t.caseKey] && <MiniBoard tcase={CASES[t.caseKey]} />}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
