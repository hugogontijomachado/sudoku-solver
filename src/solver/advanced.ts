// Standalone detectors for two advanced techniques used to produce REAL educational
// examples for the Técnicas page. They are intentionally NOT part of `TECHNIQUES` (the
// solver's behavior is unchanged); they only read a Board's naive candidates and report
// the pattern + eliminations, exactly like the built-in techniques' `Step` shape.
import { PEERS, cellName, combinations } from './grid';
import type { Coord } from './grid';
import type { Board } from './candidates';
import type { Step, Elim } from './techniques';

const hl = (cells: Coord[]) => cells.map((x) => ({ r: x.r, c: x.c }));
const sortCells = (cells: Coord[]) => [...cells].sort((a, b) => a.r - b.r || a.c - b.c);
const names = (cells: Coord[]) => sortCells(cells).map((x) => cellName(x.r, x.c)).join(', ');

// Swordfish: a 3×3 generalization of X-Wing on a single digit. If, across 3 rows, digit d
// only appears in (a subset of) the same 3 columns, then d can be removed from those
// columns in every other row. (And the column/row-swapped variant.)
export function findSwordfish(b: Board): Step[] {
  for (let d = 1; d <= 9; d++) {
    const byRow = fishAxis(b, d, true);
    if (byRow) return [byRow];
    const byCol = fishAxis(b, d, false);
    if (byCol) return [byCol];
  }
  return [];
}

function fishAxis(b: Board, d: number, rowBased: boolean): Step | null {
  // positions[lineIdx] = list of cross-indices (cols for rows, rows for cols) where d is candidate
  const pos = new Map<number, number[]>();
  for (let i = 0; i < 9; i++) {
    const cross: number[] = [];
    for (let j = 0; j < 9; j++) {
      const { r, c } = rowBased ? { r: i, c: j } : { r: j, c: i };
      if (b.cand[r * 9 + c]?.has(d)) cross.push(j);
    }
    if (cross.length >= 2 && cross.length <= 3) pos.set(i, cross);
  }
  for (const combo of combinations([...pos.keys()], 3)) {
    const union = new Set<number>();
    for (const li of combo) for (const x of pos.get(li)!) union.add(x);
    if (union.size !== 3) continue;
    const crosses = [...union];
    const chosen = new Set(combo);
    const elim: Elim[] = [];
    for (let li = 0; li < 9; li++) {
      if (chosen.has(li)) continue;
      for (const x of crosses) {
        const { r, c } = rowBased ? { r: li, c: x } : { r: x, c: li };
        if (b.cand[r * 9 + c]?.has(d)) elim.push({ r, c, d });
      }
    }
    if (!elim.length) continue;
    const highlight: Coord[] = [];
    for (const li of combo)
      for (const x of pos.get(li)!) {
        const { r, c } = rowBased ? { r: li, c: x } : { r: x, c: li };
        highlight.push({ r, c });
      }
    const axis = rowBased ? 'linhas' : 'colunas';
    const cross = rowBased ? 'colunas' : 'linhas';
    return {
      technique: 'Swordfish',
      text: `Swordfish no dígito ${d}: em 3 ${axis} o ${d} só aparece nas mesmas 3 ${cross} → removo o ${d} dessas ${cross} nas demais ${axis}: ${names(elim)}.`,
      eliminations: elim,
      highlight: hl(highlight),
    };
  }
  return null;
}

// Y-Wing (XY-Wing): a pivot cell with candidates {X,Y}; two pincers seen by the pivot,
// one {X,Z} and one {Y,Z}. Whatever the pivot becomes, one pincer is forced to Z, so Z
// can be removed from every cell seen by BOTH pincers.
export function findYWing(b: Board): Step[] {
  const peerSet: Set<number>[] = PEERS.map((ps) => new Set(ps.map((p) => p.r * 9 + p.c)));
  const bivalue: number[] = [];
  for (let i = 0; i < 81; i++) if (b.cand[i]?.size === 2) bivalue.push(i);

  for (const pivot of bivalue) {
    const [X, Y] = [...b.cand[pivot]!];
    const pincers = bivalue.filter((i) => i !== pivot && peerSet[pivot].has(i));
    for (const a of pincers) {
      const ca = b.cand[a]!;
      // pincer A must share exactly one pivot digit and carry a third digit Z
      const shareA = [X, Y].filter((d) => ca.has(d));
      if (shareA.length !== 1) continue;
      const zA = [...ca].find((d) => d !== X && d !== Y);
      if (zA === undefined) continue;
      for (const c of pincers) {
        if (c === a) continue;
        const cc = b.cand[c]!;
        const shareC = [X, Y].filter((d) => cc.has(d));
        if (shareC.length !== 1) continue;
        if (shareC[0] === shareA[0]) continue; // must cover the OTHER pivot digit
        if (!cc.has(zA)) continue; // same Z
        const Z = zA;
        const elim: Elim[] = [];
        for (let k = 0; k < 81; k++) {
          if (k === pivot || k === a || k === c) continue;
          if (!b.cand[k]?.has(Z)) continue;
          if (peerSet[a].has(k) && peerSet[c].has(k)) {
            elim.push({ r: Math.floor(k / 9), c: k % 9, d: Z });
          }
        }
        if (!elim.length) continue;
        const cells = [pivot, a, c].map((i) => ({ r: Math.floor(i / 9), c: i % 9 }));
        return [{
          technique: 'Y-Wing',
          text: `Y-Wing: o pivô ${cellName(cells[0].r, cells[0].c)} (${X}/${Y}) vê as pontas ${cellName(cells[1].r, cells[1].c)} e ${cellName(cells[2].r, cells[2].c)}; uma delas será ${Z} → removo o ${Z} de ${names(elim)}.`,
          eliminations: elim,
          highlight: hl(cells),
        }];
      }
    }
  }
  return [];
}
