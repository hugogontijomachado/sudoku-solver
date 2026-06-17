import unittest
from generate_pool import classify, grade
from sudoku_solver import parse_grid

PUZZLE = "".join([
    "...5...6.", "8.9....1.", "16..87...", "3...26...", "..7.1.6..",
    "...85...3", "...47..21", ".4....9.8", ".8...3...",
])


class TestClassify(unittest.TestCase):
    def test_singles_only_is_easy(self):
        self.assertEqual(classify(["Candidata única", "Único lugar"], False), "easy")

    def test_subset_is_medium(self):
        self.assertEqual(classify(["Candidata única", "Par escondido"], False), "medium")

    def test_xwing_is_hard(self):
        self.assertEqual(classify(["Único lugar", "X-Wing"], False), "hard")

    def test_backtracking_is_evil(self):
        self.assertEqual(classify(["Candidata única"], True), "evil")


class TestGrade(unittest.TestCase):
    def test_reference_puzzle_is_medium(self):
        # reference puzzle uses the hidden pair ("Par escondido"), no X-Wing, no backtracking
        self.assertEqual(grade(parse_grid(PUZZLE)), "medium")


if __name__ == "__main__":
    unittest.main()
