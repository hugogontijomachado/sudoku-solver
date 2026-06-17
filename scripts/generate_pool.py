#!/usr/bin/env python3
"""Generate unique 9x9 Sudoku puzzles graded by difficulty using sudoku_solver.py.
Writes JSON {easy,medium,hard,evil: [81-char clue strings, '.'=empty]}.
Usage: python3 generate_pool.py [--target N] [--out PATH] [--cap-seconds S]"""
import argparse
import copy
import json
import random
import sys
import time
from sudoku_solver import solve, count_solutions, grid_to_string, parse_grid  # noqa: F401

EASY = {"Candidata única", "Único lugar"}
HARD = {"X-Wing"}


def classify(techniques_used, used_backtracking):
    if used_backtracking:
        return "evil"
    used = set(techniques_used)
    if used & HARD:
        return "hard"
    if used and used <= EASY:
        return "easy"
    return "medium"


def grade(grid):
    res = solve(copy.deepcopy(grid), check_unique=False)
    if not res.solved:
        return None
    return classify(res.techniques_used, res.used_backtracking)


# Per-technique difficulty weight, used to score a puzzle by the effort its
# solve path demands (the standard "rate by solving technique" approach). The
# X-Wing tier is rare, so puzzles are graded by a continuous score and then
# banded into four ordered tiers, rather than keyed to one specific technique.
TIER_WEIGHT = {
    "Candidata única": 1,
    "Único lugar": 1,
    "Par nu": 3,
    "Trio nu": 3,
    "Quadra nua": 3,
    "Par escondido": 3,
    "Trio escondido": 3,
    "Quadra escondida": 3,
    "Interseção (pointing)": 4,
    "Interseção (claiming)": 4,
    "X-Wing": 7,
}


def difficulty_score(grid):
    """Higher = harder. Sum of per-step technique weights plus a sparsity term;
    puzzles that need backtracking (logic stalls) land in a top band of their own."""
    res = solve(copy.deepcopy(grid), check_unique=False)
    if not res.solved:
        return None
    clues = sum(1 for row in grid for v in row if v)
    if res.used_backtracking:
        return 1000 + (81 - clues)
    weight = sum(TIER_WEIGHT.get(s.technique, 3) for s in res.steps)
    return weight + (81 - clues)


def full_solution():
    grid = [[0] * 9 for _ in range(9)]

    def fits(r, c, d):
        if any(grid[r][k] == d for k in range(9)):
            return False
        if any(grid[k][c] == d for k in range(9)):
            return False
        br, bc = 3 * (r // 3), 3 * (c // 3)
        return all(grid[br + i][bc + j] != d for i in range(3) for j in range(3))

    def fill(pos=0):
        if pos == 81:
            return True
        r, c = divmod(pos, 9)
        ds = list(range(1, 10))
        random.shuffle(ds)
        for d in ds:
            if fits(r, c, d):
                grid[r][c] = d
                if fill(pos + 1):
                    return True
                grid[r][c] = 0
        return False

    fill()
    return grid


def make_puzzle(max_remove):
    sol = full_solution()
    puzzle = [row[:] for row in sol]
    cells = list(range(81))
    random.shuffle(cells)
    removed = 0
    for k in cells:
        if removed >= max_remove:
            break
        r, c = divmod(k, 9)
        if puzzle[r][c] == 0:
            continue
        saved = puzzle[r][c]
        puzzle[r][c] = 0
        cnt, _ = count_solutions(puzzle, 2)
        if cnt != 1:
            puzzle[r][c] = saved  # removal broke uniqueness — restore
        else:
            removed += 1
    return puzzle


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=100)
    ap.add_argument("--out", default="puzzles.json")
    ap.add_argument("--cap-seconds", type=float, default=600)
    args = ap.parse_args()
    random.seed(12345)
    need = args.target * 4
    pool = []  # (score, clue_string)
    seen = set()
    start = time.time()
    attempts = 0
    while len(pool) < need:
        if time.time() - start > args.cap_seconds:
            print(f"cap-seconds reached after {attempts} attempts, pool={len(pool)}", file=sys.stderr)
            break
        attempts += 1
        puzzle = make_puzzle(random.randint(28, 58))  # spread of removal depths
        s = grid_to_string(puzzle)
        if s in seen:
            continue
        score = difficulty_score(puzzle)
        if score is None:
            continue
        seen.add(s)
        pool.append((score, s.replace("0", ".")))
        if len(pool) % 50 == 0:
            print(f"pool={len(pool)}/{need} attempts={attempts}", file=sys.stderr)
    # Sort by difficulty and band into four ordered tiers of equal size.
    pool.sort(key=lambda x: x[0])
    labels = ["easy", "medium", "hard", "evil"]
    per = len(pool) // 4
    buckets = {}
    for i, label in enumerate(labels):
        chunk = pool[i * per:(i + 1) * per] if i < 3 else pool[3 * per:]
        buckets[label] = [s for _, s in chunk]
    print("FINAL COUNTS:", {k: len(v) for k, v in buckets.items()}, "attempts", attempts, file=sys.stderr)
    with open(args.out, "w") as f:
        json.dump(buckets, f, separators=(",", ":"))
    print(args.out)


if __name__ == "__main__":
    sys.exit(main())
