import {
  ROWS, COLS, BOXES, UNITS, boxIndex, cellName, unitName, combinations,
} from './grid';
import type { Coord } from './grid';
import { Board } from './candidates';

export type Elim = { r: number; c: number; d: number };
export type Step = {
  technique: string;
  text: string;
  placements?: { r: number; c: number; d: number }[];
  eliminations?: Elim[];
  highlight: { r: number; c: number }[];
};

const sortCells = (cells: Coord[]) => [...cells].sort((a, b) => a.r - b.r || a.c - b.c);
const cellsNames = (cells: Coord[]) => sortCells(cells).map((x) => cellName(x.r, x.c)).join(', ');
const digitsStr = (ds: number[]) => [...ds].sort((a, b) => a - b).join('/');
const hl = (cells: Coord[]) => cells.map((x) => ({ r: x.r, c: x.c }));
const elimCells = (e: Elim[]) => hl(e.map((x) => ({ r: x.r, c: x.c })));

export function nakedSingle(b: Board): Step[] {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const s = b.cand[r * 9 + c];
      if (s && s.size === 1) {
        const d = [...s][0];
        b.place(r, c, d);
        return [{
          technique: 'Candidata única',
          text: `${cellName(r, c)} = ${d}: era o único candidato que sobrava nesta célula (os outros 8 dígitos já aparecem na linha, coluna ou bloco dela).`,
          placements: [{ r, c, d }],
          highlight: [{ r, c }],
        }];
      }
    }
  return [];
}

export function hiddenSingle(b: Board): Step[] {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const spots = unit.filter(({ r, c }) => b.cand[r * 9 + c]?.has(d));
      if (spots.length === 1) {
        const { r, c } = spots[0];
        b.place(r, c, d);
        return [{
          technique: 'Único lugar',
          text: `${cellName(r, c)} = ${d}: na ${unitName(unit)}, esta é a única célula que ainda aceita o ${d}.`,
          placements: [{ r, c, d }],
          highlight: hl(unit),
        }];
      }
    }
  }
  return [];
}

export function nakedSubset(b: Board, k: number): Step[] {
  const name = { 2: 'Par nu', 3: 'Trio nu', 4: 'Quadra nua' }[k]!;
  for (const unit of UNITS) {
    const empties = unit.filter(({ r, c }) => b.cand[r * 9 + c]);
    const cands = empties.filter(({ r, c }) => {
      const s = b.cand[r * 9 + c]!;
      return s.size >= 2 && s.size <= k;
    });
    for (const combo of combinations(cands, k)) {
      const union = new Set<number>();
      for (const { r, c } of combo) for (const d of b.cand[r * 9 + c]!) union.add(d);
      if (union.size !== k) continue;
      const comboKeys = new Set(combo.map((x) => x.r * 9 + x.c));
      const elim: Elim[] = [];
      for (const { r, c } of empties) {
        if (comboKeys.has(r * 9 + c)) continue;
        const s = b.cand[r * 9 + c]!;
        for (const d of union) if (s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
      }
      if (elim.length) {
        const affected = elim.map((e) => `${cellName(e.r, e.c)} (tira ${e.d})`).join('; ');
        return [{
          technique: name,
          text: `Na ${unitName(unit)}, as células ${cellsNames(combo)} só aceitam ${digitsStr([...union])} entre si → esses dígitos não podem aparecer nas demais células da unidade. Removo: ${affected}.`,
          eliminations: elim,
          highlight: hl(combo),
        }];
      }
    }
  }
  return [];
}

export function hiddenSubset(b: Board, k: number): Step[] {
  const name = { 2: 'Par escondido', 3: 'Trio escondido', 4: 'Quadra escondida' }[k]!;
  for (const unit of UNITS) {
    const empties = unit.filter(({ r, c }) => b.cand[r * 9 + c]);
    const pos = new Map<number, Coord[]>();
    for (let d = 1; d <= 9; d++) {
      const spots = empties.filter(({ r, c }) => b.cand[r * 9 + c]!.has(d));
      if (spots.length >= 1 && spots.length <= k) pos.set(d, spots);
    }
    for (const combo of combinations([...pos.keys()], k)) {
      const cells = new Map<number, Coord>();
      for (const d of combo) for (const cell of pos.get(d)!) cells.set(cell.r * 9 + cell.c, cell);
      if (cells.size !== k) continue;
      const comboSet = new Set(combo);
      const elim: Elim[] = [];
      for (const cell of cells.values()) {
        const s = b.cand[cell.r * 9 + cell.c]!;
        for (const d of [...s]) if (!comboSet.has(d)) { s.delete(d); elim.push({ r: cell.r, c: cell.c, d }); }
      }
      if (elim.length) {
        const affected = elim.map((e) => `${cellName(e.r, e.c)} (tira ${e.d})`).join('; ');
        return [{
          technique: name,
          text: `Na ${unitName(unit)}, os dígitos ${digitsStr(combo)} só cabem nas células ${cellsNames([...cells.values()])} → essas células ficam restritas a ${digitsStr(combo)}. Removo: ${affected}.`,
          eliminations: elim,
          highlight: hl([...cells.values()]),
        }];
      }
    }
  }
  return [];
}

export function pointing(b: Board): Step[] {
  for (let bi = 0; bi < 9; bi++) {
    const box = BOXES[bi];
    const empties = box.filter(({ r, c }) => b.cand[r * 9 + c]);
    for (let d = 1; d <= 9; d++) {
      const spots = empties.filter(({ r, c }) => b.cand[r * 9 + c]!.has(d));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map((s) => s.r));
      const cols = new Set(spots.map((s) => s.c));
      let line: Coord[] | null = null;
      if (rows.size === 1) line = ROWS[spots[0].r];
      else if (cols.size === 1) line = COLS[spots[0].c];
      if (!line) continue;
      const boxKeys = new Set(box.map((x) => x.r * 9 + x.c));
      const elim: Elim[] = [];
      for (const { r, c } of line) {
        if (boxKeys.has(r * 9 + c)) continue;
        const s = b.cand[r * 9 + c];
        if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
      }
      if (elim.length) {
        return [{
          technique: 'Interseção (pointing)',
          text: `No bloco ${bi + 1}, o ${d} só pode ficar na ${unitName(line)} (células ${cellsNames(spots)}) → removo o ${d} das outras células dessa ${unitName(line)}: ${cellsNames(elimCells(elim))}.`,
          eliminations: elim,
          highlight: hl(spots),
        }];
      }
    }
  }
  return [];
}

export function claiming(b: Board): Step[] {
  for (const unit of [...ROWS, ...COLS]) {
    const empties = unit.filter(({ r, c }) => b.cand[r * 9 + c]);
    for (let d = 1; d <= 9; d++) {
      const spots = empties.filter(({ r, c }) => b.cand[r * 9 + c]!.has(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map((s) => boxIndex(s.r, s.c)));
      if (boxes.size !== 1) continue;
      const bi = [...boxes][0];
      const unitKeys = new Set(unit.map((x) => x.r * 9 + x.c));
      const elim: Elim[] = [];
      for (const { r, c } of BOXES[bi]) {
        if (unitKeys.has(r * 9 + c)) continue;
        const s = b.cand[r * 9 + c];
        if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
      }
      if (elim.length) {
        return [{
          technique: 'Interseção (claiming)',
          text: `Na ${unitName(unit)}, o ${d} só pode ficar dentro do bloco ${bi + 1} (células ${cellsNames(spots)}) → removo o ${d} das outras células do bloco: ${cellsNames(elimCells(elim))}.`,
          eliminations: elim,
          highlight: hl(spots),
        }];
      }
    }
  }
  return [];
}

export function xWing(b: Board): Step[] {
  for (let d = 1; d <= 9; d++) {
    const rowsPos = new Map<number, number[]>();
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) if (b.cand[r * 9 + c]?.has(d)) cols.push(c);
      if (cols.length === 2) rowsPos.set(r, cols);
    }
    for (const [[r1, c1], [r2, c2]] of combinations([...rowsPos.entries()], 2)) {
      if (c1[0] === c2[0] && c1[1] === c2[1]) {
        const [ca, cb] = c1;
        const elim: Elim[] = [];
        for (let r = 0; r < 9; r++) {
          if (r === r1 || r === r2) continue;
          for (const c of [ca, cb]) {
            const s = b.cand[r * 9 + c];
            if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
          }
        }
        if (elim.length) {
          return [{
            technique: 'X-Wing',
            text: `X-Wing no dígito ${d}: nas linhas ${r1 + 1} e ${r2 + 1} o ${d} só aparece nas colunas ${ca + 1} e ${cb + 1} → removo o ${d} dessas colunas nas demais linhas: ${cellsNames(elimCells(elim))}.`,
            eliminations: elim,
            highlight: [{ r: r1, c: ca }, { r: r1, c: cb }, { r: r2, c: ca }, { r: r2, c: cb }],
          }];
        }
      }
    }
    const colsPos = new Map<number, number[]>();
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) if (b.cand[r * 9 + c]?.has(d)) rows.push(r);
      if (rows.length === 2) colsPos.set(c, rows);
    }
    for (const [[c1, r1], [c2, r2]] of combinations([...colsPos.entries()], 2)) {
      if (r1[0] === r2[0] && r1[1] === r2[1]) {
        const [ra, rb] = r1;
        const elim: Elim[] = [];
        for (let c = 0; c < 9; c++) {
          if (c === c1 || c === c2) continue;
          for (const r of [ra, rb]) {
            const s = b.cand[r * 9 + c];
            if (s && s.has(d)) { s.delete(d); elim.push({ r, c, d }); }
          }
        }
        if (elim.length) {
          return [{
            technique: 'X-Wing',
            text: `X-Wing no dígito ${d}: nas colunas ${c1 + 1} e ${c2 + 1} o ${d} só aparece nas linhas ${ra + 1} e ${rb + 1} → removo o ${d} dessas linhas nas demais colunas: ${cellsNames(elimCells(elim))}.`,
            eliminations: elim,
            highlight: [{ r: ra, c: c1 }, { r: rb, c: c1 }, { r: ra, c: c2 }, { r: rb, c: c2 }],
          }];
        }
      }
    }
  }
  return [];
}

export const TECHNIQUES: ((b: Board) => Step[])[] = [
  nakedSingle,
  hiddenSingle,
  (b) => nakedSubset(b, 2),
  (b) => hiddenSubset(b, 2),
  (b) => nakedSubset(b, 3),
  (b) => hiddenSubset(b, 3),
  pointing,
  claiming,
  (b) => nakedSubset(b, 4),
  (b) => hiddenSubset(b, 4),
  xWing,
];
