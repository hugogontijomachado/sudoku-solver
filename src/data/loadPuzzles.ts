export type Difficulty = 'easy' | 'medium' | 'hard' | 'evil';
type Pool = Record<Difficulty, string[]>;

let cache: Pool | null = null;

export async function loadRandomPuzzle(diff: Difficulty): Promise<string> {
  if (!cache) {
    const mod = await import('./puzzles.json');
    cache = (mod.default ?? mod) as unknown as Pool;
  }
  const list = cache[diff];
  if (!list || list.length === 0) throw new Error(`Sem puzzles para ${diff}`);
  return list[Math.floor(Math.random() * list.length)];
}
