#!/usr/bin/env python3
"""Logical Sudoku solver with a human-readable, step-by-step protocol (Portuguese).

This solver does NOT brute-force first. It keeps a set of candidates per empty
cell and applies human techniques in increasing order of difficulty, logging a
plain-language explanation for every deduction:

  1. Naked single        (única candidata na célula)
  2. Hidden single       (único lugar para um dígito numa unidade)
  3. Naked subset        (pares/trios/quadras nus)
  4. Hidden subset       (pares/trios/quadras escondidos)
  5. Pointing            (interseção bloco -> linha/coluna)
  6. Claiming            (interseção linha/coluna -> bloco)
  7. X-Wing              (no dígito, em linhas/colunas)

Backtracking is used ONLY as a clearly-flagged fallback if the logical
techniques stall, and is always used (silently) to check that the puzzle has a
unique solution.

Input formats accepted by `parse_grid`:
  - 81-char string, using '0' or '.' for empties (rows concatenated)
  - multi-line text, one row per line (non-digit chars treated as empty)

CLI:
  ./sudoku_solver.py solve "<81-char-string>"      # solve + print protocol
  ./sudoku_solver.py solve --file grid.txt
  echo "<grid>" | ./sudoku_solver.py solve -
  ./sudoku_solver.py solve "<grid>" --protocol-out protocolo.md
"""

from __future__ import annotations

import argparse
import sys
from itertools import combinations
from typing import Dict, List, Optional, Set, Tuple

Cell = Tuple[int, int]  # (row, col), 0-based
Grid = List[List[int]]

# ---------------------------------------------------------------------------
# Geometry: units (rows, cols, boxes) and peers, precomputed once.
# ---------------------------------------------------------------------------

ROWS = [[(r, c) for c in range(9)] for r in range(9)]
COLS = [[(r, c) for r in range(9)] for c in range(9)]
BOXES = [
    [(br * 3 + dr, bc * 3 + dc) for dr in range(3) for dc in range(3)]
    for br in range(3)
    for bc in range(3)
]
ALL_UNITS = ROWS + COLS + BOXES


def box_index(r: int, c: int) -> int:
    return (r // 3) * 3 + (c // 3)


# units that contain a given cell
UNITS_OF: Dict[Cell, List[List[Cell]]] = {}
PEERS: Dict[Cell, Set[Cell]] = {}
for r in range(9):
    for c in range(9):
        mine = [ROWS[r], COLS[c], BOXES[box_index(r, c)]]
        UNITS_OF[(r, c)] = mine
        peers: Set[Cell] = set()
        for u in mine:
            peers.update(u)
        peers.discard((r, c))
        PEERS[(r, c)] = peers


# ---------------------------------------------------------------------------
# Display helpers (1-based for humans).
# ---------------------------------------------------------------------------

def cell_name(cell: Cell) -> str:
    r, c = cell
    return f"r{r + 1}c{c + 1}"


def cells_names(cells) -> str:
    return ", ".join(cell_name(x) for x in sorted(cells))


def digits_str(ds) -> str:
    return "/".join(str(d) for d in sorted(ds))


def unit_name(unit: List[Cell]) -> str:
    """Human name for a unit, e.g. 'linha 4', 'coluna 7', 'bloco 5' (1-based)."""
    rs = {r for r, _ in unit}
    cs = {c for _, c in unit}
    if len(rs) == 1:
        return f"linha {next(iter(rs)) + 1}"
    if len(cs) == 1:
        return f"coluna {next(iter(cs)) + 1}"
    r0, c0 = unit[0]
    return f"bloco {box_index(r0, c0) + 1}"


# ---------------------------------------------------------------------------
# Parsing.
# ---------------------------------------------------------------------------

def parse_grid(text: str) -> Grid:
    digits = []
    for ch in text:
        if ch.isdigit():
            digits.append(int(ch))
        elif ch in ".":
            digits.append(0)
        # any other char (whitespace, '|', '-', letters) is ignored as separator
    if len(digits) != 81:
        raise ValueError(
            f"Esperava 81 células, encontrei {len(digits)}. "
            "Use 0 ou . para vazias."
        )
    return [digits[i * 9:(i + 1) * 9] for i in range(9)]


def grid_to_string(grid: Grid) -> str:
    return "".join(str(grid[r][c]) for r in range(9) for c in range(9))


def render_grid(grid: Grid) -> str:
    lines = []
    for r in range(9):
        if r in (3, 6):
            lines.append("------+-------+------")
        cells = []
        for c in range(9):
            if c in (3, 6):
                cells.append("|")
            v = grid[r][c]
            cells.append(str(v) if v else ".")
        lines.append(" ".join(cells))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Candidate bookkeeping.
# ---------------------------------------------------------------------------

class Board:
    def __init__(self, grid: Grid):
        self.grid = [row[:] for row in grid]
        self.cand: Dict[Cell, Set[int]] = {}
        self._init_candidates()

    def _init_candidates(self) -> None:
        for r in range(9):
            for c in range(9):
                if self.grid[r][c] == 0:
                    used = {
                        self.grid[pr][pc]
                        for pr, pc in PEERS[(r, c)]
                        if self.grid[pr][pc] != 0
                    }
                    self.cand[(r, c)] = set(range(1, 10)) - used

    def is_solved(self) -> bool:
        return all(self.grid[r][c] != 0 for r in range(9) for c in range(9))

    def place(self, cell: Cell, d: int) -> None:
        r, c = cell
        self.grid[r][c] = d
        self.cand.pop(cell, None)
        for p in PEERS[cell]:
            if p in self.cand:
                self.cand[p].discard(d)

    def validate_givens(self) -> None:
        for unit in ALL_UNITS:
            seen = {}
            for (r, c) in unit:
                v = self.grid[r][c]
                if v:
                    if v in seen:
                        raise ValueError(
                            f"Conflito nas pistas: {cell_name((r, c))} e "
                            f"{cell_name(seen[v])} têm {v} na mesma "
                            f"{unit_name(unit)}."
                        )
                    seen[v] = (r, c)
            # also detect an empty cell with zero candidates
        for cell, cs in self.cand.items():
            if not cs:
                raise ValueError(
                    f"Pistas inconsistentes: {cell_name(cell)} não tem nenhum "
                    "candidato possível."
                )


# ---------------------------------------------------------------------------
# A logged step in the protocol.
# ---------------------------------------------------------------------------

class Step:
    def __init__(self, technique: str, text: str, placement: Optional[Tuple[Cell, int]] = None):
        self.technique = technique
        self.text = text
        self.placement = placement  # (cell, digit) if this step placed a value


# ---------------------------------------------------------------------------
# Techniques. Each returns a list[Step] of progress made (and mutates board),
# or [] if it found nothing. They are tried in order; after any progress we
# restart from the top so the simplest applicable technique is always shown.
# ---------------------------------------------------------------------------

def naked_single(b: Board) -> List[Step]:
    for cell, cs in b.cand.items():
        if len(cs) == 1:
            d = next(iter(cs))
            b.place(cell, d)
            return [Step(
                "Candidata única",
                f"{cell_name(cell)} = {d}: era o único candidato que sobrava "
                f"nesta célula (os outros 8 dígitos já aparecem na linha, "
                f"coluna ou bloco dela).",
                placement=(cell, d),
            )]
    return []


def hidden_single(b: Board) -> List[Step]:
    for unit in ALL_UNITS:
        empties = [cell for cell in unit if cell in b.cand]
        for d in range(1, 10):
            spots = [cell for cell in empties if d in b.cand[cell]]
            if len(spots) == 1:
                cell = spots[0]
                b.place(cell, d)
                return [Step(
                    "Único lugar",
                    f"{cell_name(cell)} = {d}: na {unit_name(unit)}, esta é a "
                    f"única célula que ainda aceita o {d}.",
                    placement=(cell, d),
                )]
    return []


def _naked_subset(b: Board, k: int) -> List[Step]:
    name = {2: "Par nu", 3: "Trio nu", 4: "Quadra nua"}[k]
    for unit in ALL_UNITS:
        empties = [cell for cell in unit if cell in b.cand]
        # cells whose candidate set is small enough to be part of a size-k subset
        candidates = [cell for cell in empties if 2 <= len(b.cand[cell]) <= k]
        for combo in combinations(candidates, k):
            union = set()
            for cell in combo:
                union |= b.cand[cell]
            if len(union) == k:
                # eliminate `union` digits from the other empties in this unit
                removed = []
                for cell in empties:
                    if cell in combo:
                        continue
                    gone = b.cand[cell] & union
                    if gone:
                        b.cand[cell] -= union
                        removed.append((cell, gone))
                if removed:
                    affected = "; ".join(
                        f"{cell_name(cell)} (tira {digits_str(g)})" for cell, g in removed
                    )
                    return [Step(
                        name,
                        f"Na {unit_name(unit)}, as células {cells_names(combo)} "
                        f"só aceitam {digits_str(union)} entre si → esses dígitos "
                        f"não podem aparecer nas demais células da unidade. "
                        f"Removo: {affected}.",
                    )]
    return []


def _hidden_subset(b: Board, k: int) -> List[Step]:
    name = {2: "Par escondido", 3: "Trio escondido", 4: "Quadra escondida"}[k]
    for unit in ALL_UNITS:
        empties = [cell for cell in unit if cell in b.cand]
        # positions of each digit within the unit
        pos: Dict[int, List[Cell]] = {}
        for d in range(1, 10):
            spots = [cell for cell in empties if d in b.cand[cell]]
            if 1 <= len(spots) <= k:
                pos[d] = spots
        for combo in combinations(sorted(pos), k):
            cells = set()
            for d in combo:
                cells |= set(pos[d])
            if len(cells) == k:
                combo_set = set(combo)
                removed = []
                for cell in cells:
                    extra = b.cand[cell] - combo_set
                    if extra:
                        b.cand[cell] -= extra
                        removed.append((cell, extra))
                if removed:
                    affected = "; ".join(
                        f"{cell_name(cell)} (tira {digits_str(g)})" for cell, g in removed
                    )
                    return [Step(
                        name,
                        f"Na {unit_name(unit)}, os dígitos {digits_str(combo_set)} "
                        f"só cabem nas células {cells_names(cells)} → essas células "
                        f"ficam restritas a {digits_str(combo_set)}. Removo: {affected}.",
                    )]
    return []


def pointing(b: Board) -> List[Step]:
    """Box -> line: if a digit's candidates in a box share one row/col, remove
    that digit from the rest of that row/col."""
    for bi in range(9):
        box = BOXES[bi]
        empties = [cell for cell in box if cell in b.cand]
        for d in range(1, 10):
            spots = [cell for cell in empties if d in b.cand[cell]]
            if len(spots) < 2:
                continue
            rows = {r for r, _ in spots}
            cols = {c for _, c in spots}
            line = None
            if len(rows) == 1:
                line = ROWS[next(iter(rows))]
            elif len(cols) == 1:
                line = COLS[next(iter(cols))]
            if line is None:
                continue
            removed = []
            for cell in line:
                if cell in box:
                    continue
                if cell in b.cand and d in b.cand[cell]:
                    b.cand[cell].discard(d)
                    removed.append(cell)
            if removed:
                return [Step(
                    "Interseção (pointing)",
                    f"No bloco {bi + 1}, o {d} só pode ficar na {unit_name(line)} "
                    f"(células {cells_names(spots)}) → removo o {d} das outras "
                    f"células dessa {unit_name(line)}: {cells_names(removed)}.",
                )]
    return []


def claiming(b: Board) -> List[Step]:
    """Line -> box: if a digit's candidates in a row/col all fall in one box,
    remove that digit from the rest of the box."""
    for unit in ROWS + COLS:
        empties = [cell for cell in unit if cell in b.cand]
        for d in range(1, 10):
            spots = [cell for cell in empties if d in b.cand[cell]]
            if len(spots) < 2:
                continue
            boxes = {box_index(r, c) for r, c in spots}
            if len(boxes) != 1:
                continue
            bi = next(iter(boxes))
            removed = []
            for cell in BOXES[bi]:
                if cell in unit:
                    continue
                if cell in b.cand and d in b.cand[cell]:
                    b.cand[cell].discard(d)
                    removed.append(cell)
            if removed:
                return [Step(
                    "Interseção (claiming)",
                    f"Na {unit_name(unit)}, o {d} só pode ficar dentro do "
                    f"bloco {bi + 1} (células {cells_names(spots)}) → removo o {d} "
                    f"das outras células do bloco: {cells_names(removed)}.",
                )]
    return []


def x_wing(b: Board) -> List[Step]:
    for d in range(1, 10):
        # row-based: two rows where d sits in exactly the same two columns
        rows_pos = {}
        for r in range(9):
            cols = [c for c in range(9) if (r, c) in b.cand and d in b.cand[(r, c)]]
            if len(cols) == 2:
                rows_pos[r] = tuple(cols)
        items = list(rows_pos.items())
        for (r1, c1), (r2, c2) in combinations(items, 2):
            if c1 == c2:
                ca, cb = c1
                removed = []
                for r in range(9):
                    if r in (r1, r2):
                        continue
                    for c in (ca, cb):
                        if (r, c) in b.cand and d in b.cand[(r, c)]:
                            b.cand[(r, c)].discard(d)
                            removed.append((r, c))
                if removed:
                    return [Step(
                        "X-Wing",
                        f"X-Wing no dígito {d}: nas linhas {r1 + 1} e {r2 + 1} o "
                        f"{d} só aparece nas colunas {ca + 1} e {cb + 1} → removo o "
                        f"{d} dessas colunas nas demais linhas: {cells_names(removed)}.",
                    )]
        # column-based
        cols_pos = {}
        for c in range(9):
            rows = [r for r in range(9) if (r, c) in b.cand and d in b.cand[(r, c)]]
            if len(rows) == 2:
                cols_pos[c] = tuple(rows)
        items = list(cols_pos.items())
        for (c1, r1), (c2, r2) in combinations(items, 2):
            if r1 == r2:
                ra, rb = r1
                removed = []
                for c in range(9):
                    if c in (c1, c2):
                        continue
                    for r in (ra, rb):
                        if (r, c) in b.cand and d in b.cand[(r, c)]:
                            b.cand[(r, c)].discard(d)
                            removed.append((r, c))
                if removed:
                    return [Step(
                        "X-Wing",
                        f"X-Wing no dígito {d}: nas colunas {c1 + 1} e {c2 + 1} o "
                        f"{d} só aparece nas linhas {ra + 1} e {rb + 1} → removo o "
                        f"{d} dessas linhas nas demais colunas: {cells_names(removed)}.",
                    )]
    return []


TECHNIQUES = [
    naked_single,
    hidden_single,
    lambda b: _naked_subset(b, 2),
    lambda b: _hidden_subset(b, 2),
    lambda b: _naked_subset(b, 3),
    lambda b: _hidden_subset(b, 3),
    pointing,
    claiming,
    lambda b: _naked_subset(b, 4),
    lambda b: _hidden_subset(b, 4),
    x_wing,
]


# ---------------------------------------------------------------------------
# Plain backtracking: uniqueness check + fallback.
# ---------------------------------------------------------------------------

def count_solutions(grid: Grid, limit: int = 2) -> Tuple[int, Optional[Grid]]:
    """Count solutions up to `limit`. Returns (count, one_solution)."""
    work = [row[:] for row in grid]
    found = []

    def candidates(r, c):
        used = set()
        for pr, pc in PEERS[(r, c)]:
            used.add(work[pr][pc])
        return [d for d in range(1, 10) if d not in used]

    def find_empty():
        best = None
        best_opts = None
        for r in range(9):
            for c in range(9):
                if work[r][c] == 0:
                    opts = candidates(r, c)
                    if best is None or len(opts) < len(best_opts):
                        best, best_opts = (r, c), opts
                        if len(opts) <= 1:
                            return best, best_opts
        return best, best_opts

    def solve():
        if len(found) >= limit:
            return
        cell, opts = find_empty()
        if cell is None:
            found.append([row[:] for row in work])
            return
        r, c = cell
        for d in opts:
            work[r][c] = d
            solve()
            work[r][c] = 0
            if len(found) >= limit:
                return

    solve()
    return len(found), (found[0] if found else None)


# ---------------------------------------------------------------------------
# Main solve driver.
# ---------------------------------------------------------------------------

class SolveResult:
    def __init__(self):
        self.steps: List[Step] = []
        self.solved = False
        self.used_backtracking = False
        self.unique = None  # True/False/None
        self.solution: Optional[Grid] = None
        self.techniques_used: List[str] = []


def solve(grid: Grid, check_unique: bool = True) -> SolveResult:
    res = SolveResult()
    b = Board(grid)
    b.validate_givens()

    if check_unique:
        n, _ = count_solutions(grid, limit=2)
        res.unique = (n == 1)

    while not b.is_solved():
        progressed = False
        for tech in TECHNIQUES:
            steps = tech(b)
            if steps:
                res.steps.extend(steps)
                progressed = True
                break
        if not progressed:
            # Logic stalled — fall back to backtracking for the remainder.
            res.used_backtracking = True
            n, sol = count_solutions(b.grid, limit=1)
            if sol is None:
                raise ValueError("Sem solução a partir deste ponto.")
            for r in range(9):
                for c in range(9):
                    b.grid[r][c] = sol[r][c]
            break

    res.solved = b.is_solved()
    res.solution = b.grid
    seen = []
    for s in res.steps:
        if s.technique not in seen:
            seen.append(s.technique)
    res.techniques_used = seen
    return res


# ---------------------------------------------------------------------------
# Protocol rendering.
# ---------------------------------------------------------------------------

def build_protocol(grid: Grid, res: SolveResult) -> str:
    out = []
    out.append("# Protocolo de Resolução do Sudoku\n")

    out.append("## Como ler as coordenadas\n")
    out.append(
        "Cada célula é nomeada por **`rXcY`**, onde:\n\n"
        "- **`r`** = *row* (linha), de **1 a 9, de cima para baixo**.\n"
        "- **`c`** = *column* (coluna), de **1 a 9, da esquerda para a direita**.\n\n"
        "Ou seja, **`r1c6`** = **linha 1, coluna 6** (a 6ª célula da 1ª linha); "
        "**`r5c8`** = linha 5, coluna 8. O número antes do `=` é sempre a célula; "
        "o número depois do `=` é o dígito que vai nela.\n"
    )

    out.append("## Tabuleiro inicial\n")
    out.append("```\n" + render_grid(grid) + "\n```\n")

    if res.unique is True:
        out.append("> Verificação: o puzzle tem **solução única**.\n")
    elif res.unique is False:
        out.append("> ⚠️ Atenção: o puzzle tem **mais de uma solução**.\n")

    out.append("## Passos\n")
    placements = 0
    for i, s in enumerate(res.steps, 1):
        out.append(f"{i}. **[{s.technique}]** {s.text}")
        if s.placement:
            placements += 1
    out.append("")

    if res.used_backtracking:
        out.append(
            "> ⚠️ As técnicas lógicas implementadas não bastaram para terminar; "
            "o restante foi completado por **backtracking** (tentativa e erro "
            "sistemática). Isso indica que o puzzle exige técnicas mais avançadas "
            "do que as cobertas aqui.\n"
        )

    out.append("## Técnicas utilizadas\n")
    for t in res.techniques_used:
        out.append(f"- {t}")
    out.append("")

    out.append("## Solução final\n")
    out.append("```\n" + render_grid(res.solution) + "\n```\n")
    out.append(f"Total de passos lógicos registrados: {len(res.steps)} "
               f"(colocações diretas: {placements}).")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# CLI.
# ---------------------------------------------------------------------------

def _read_input(value: Optional[str], file: Optional[str]) -> str:
    if file:
        with open(file, "r", encoding="utf-8") as fh:
            return fh.read()
    if value == "-" or value is None:
        return sys.stdin.read()
    return value


def cmd_solve(args: argparse.Namespace) -> int:
    text = _read_input(args.grid, args.file)
    grid = parse_grid(text)
    res = solve(grid, check_unique=not args.no_unique_check)
    protocol = build_protocol(grid, res)
    print(protocol)
    if args.protocol_out:
        with open(args.protocol_out, "w", encoding="utf-8") as fh:
            fh.write(protocol + "\n")
        print(f"\n[protocolo salvo em: {args.protocol_out}]", file=sys.stderr)
    if args.string_out:
        print("\nSolução (81 chars): " + grid_to_string(res.solution), file=sys.stderr)
    return 0 if res.solved else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="sudoku_solver.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    ps = sub.add_parser("solve", help="Resolver e gerar o protocolo")
    ps.add_argument("grid", nargs="?", help="Grade (81 chars) ou '-' para stdin")
    ps.add_argument("--file", help="Ler a grade de um arquivo")
    ps.add_argument("--protocol-out", help="Salvar o protocolo em markdown")
    ps.add_argument("--string-out", action="store_true",
                    help="Imprimir também a solução como string de 81 chars")
    ps.add_argument("--no-unique-check", action="store_true",
                    help="Pular a verificação de unicidade (mais rápido)")
    ps.set_defaults(func=cmd_solve)
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
