#!/usr/bin/env python3
"""Clean the 'evil' tier of the puzzle pool.

The app's value is the step-by-step LOGICAL explanation, so a puzzle the solver can only
finish by backtracking is "incompleto" — its explanation can't be completed. Those land
in the evil tier (~24%). This script DROPS them and refills evil with hard, logic-solvable
puzzles (no backtracking) of comparable difficulty. easy/medium/hard are left untouched
(they have 0 incomplete puzzles). Reproducible via a fixed seed.

Run from the repo root:
    python3 scripts/regen_evil.py --out src/data/puzzles.json [--target 100] [--cap-seconds 300]
"""
import argparse
import copy
import json
import random
import sys
import time

from sudoku_solver import solve, grid_to_string, parse_grid
from generate_pool import make_puzzle, difficulty_score

SEED = 12345


def logic_solvable(grid):
    res = solve(copy.deepcopy(grid), check_unique=False)
    return res.solved and not res.used_backtracking


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="src/data/puzzles.json")
    ap.add_argument("--target", type=int, default=100)
    ap.add_argument("--cap-seconds", type=float, default=300)
    args = ap.parse_args()

    with open(args.out) as f:
        pool = json.load(f)

    seen = set()
    for tier in ("easy", "medium", "hard", "evil"):
        for s in pool.get(tier, []):
            seen.add(s)

    # Keep only logic-solvable evil puzzles; the tier's lower score bound defines "evil".
    kept = []
    threshold = None
    dropped = 0
    for s in pool["evil"]:
        g = parse_grid(s)
        if logic_solvable(g):
            kept.append(s)
            sc = difficulty_score(g)
            threshold = sc if threshold is None else min(threshold, sc)
        else:
            dropped += 1
    print(f"evil: kept {len(kept)} logic-solvable, dropped {dropped} backtracking; "
          f"evil score threshold = {threshold}", file=sys.stderr)

    # Refill with new hard, logic-solvable, evil-tier puzzles.
    random.seed(SEED)
    start = time.time()
    attempts = 0
    added = 0
    while len(kept) < args.target:
        if time.time() - start > args.cap_seconds:
            print(f"cap reached: evil={len(kept)} after {attempts} attempts", file=sys.stderr)
            break
        attempts += 1
        puzzle = make_puzzle(random.randint(40, 58))
        s = grid_to_string(puzzle).replace("0", ".")
        if s in seen:
            continue
        if not logic_solvable(puzzle):
            continue
        sc = difficulty_score(puzzle)
        if sc is None or sc < threshold:
            continue
        seen.add(s)
        kept.append(s)
        added += 1
        if added % 5 == 0:
            print(f"  +{added} (evil={len(kept)}/{args.target}, attempts={attempts})", file=sys.stderr)

    pool["evil"] = kept
    print("FINAL COUNTS:", {k: len(v) for k, v in pool.items()}, file=sys.stderr)
    with open(args.out, "w") as f:
        json.dump(pool, f, separators=(",", ":"))
    print(args.out)


if __name__ == "__main__":
    main()
