export const TIER_POINTS = {
  VERY_EASY: 10,
  EASY: 15,
  MEDIUM: 20,
  HARD: 25,
};

export const WRONG_PENALTY = {
  STANDARD: -10,
  DEFENCE: -2,
};

export const SPEED_BONUS_SECONDS = 30;
export const STRENGTH_BONUS_POINTS = 5;

export type Ability = 'SPEED' | 'STRENGTH' | 'DEFENCE';
export type Tier = 'VERY_EASY' | 'EASY' | 'MEDIUM' | 'HARD';

export interface MiniGame {
  id: string;
  name: string;
  tier: Tier;
  component: string;
  timeLimitMs: number;
}

export const MINI_GAMES: MiniGame[] = [
  { id: 'six_card_shuffle', name: 'Six-Card Shuffle', tier: 'VERY_EASY', component: 'MiniGamePlaceholder', timeLimitMs: 15000 },
  { id: 'three_doors',      name: 'Three Doors',       tier: 'VERY_EASY', component: 'MiniGamePlaceholder', timeLimitMs: 10000 },
  { id: 'memory_chain',     name: 'Memory Chain',      tier: 'VERY_EASY', component: 'MiniGamePlaceholder', timeLimitMs: 20000 },

  { id: 'villain_timeline', name: 'Villain Timeline',  tier: 'EASY', component: 'MiniGamePlaceholder', timeLimitMs: 25000 },
  { id: 'clue_to_character',name: 'Clue to Character', tier: 'EASY', component: 'MiniGamePlaceholder', timeLimitMs: 20000 },
  { id: 'actor_match',      name: 'Actor Match',       tier: 'EASY', component: 'MiniGamePlaceholder', timeLimitMs: 15000 },

  { id: 'contexto',         name: 'Contexto',          tier: 'MEDIUM', component: 'MiniGamePlaceholder', timeLimitMs: 40000 },
  { id: 'wordle',           name: 'Wordle',            tier: 'MEDIUM', component: 'MiniGamePlaceholder', timeLimitMs: 45000 },
  { id: 'word_search',      name: 'Word Search',       tier: 'MEDIUM', component: 'MiniGamePlaceholder', timeLimitMs: 50000 },

  { id: 'hashtag_game',     name: 'Hashtag Game',      tier: 'HARD', component: 'MiniGamePlaceholder', timeLimitMs: 60000 },
  { id: 'sudoku',           name: 'Sudoku',             tier: 'HARD', component: 'MiniGamePlaceholder', timeLimitMs: 90000 },
  { id: 'light_up_puzzle',  name: 'Light-Up Puzzle',   tier: 'HARD', component: 'MiniGamePlaceholder', timeLimitMs: 75000 },
];

export function getMiniGameById(id: string): MiniGame | undefined {
  return MINI_GAMES.find((g) => g.id === id);
}
