export const TIER_POINTS = { VERY_EASY: 10, EASY: 15, MEDIUM: 20, HARD: 25 };
export const WRONG_PENALTY = { STANDARD: -10, DEFENCE: -2 };
export const STRENGTH_BONUS_POINTS = 5;

// In sync with frontend gameConfig
export const MINI_GAME_TIERS: Record<string, string> = {
  six_card_shuffle: 'VERY_EASY', three_doors: 'VERY_EASY', memory_chain: 'VERY_EASY',
  villain_timeline: 'EASY', clue_to_character: 'EASY', actor_match: 'EASY',
  contexto: 'MEDIUM', wordle: 'MEDIUM', word_search: 'MEDIUM',
  hashtag_game: 'HARD', sudoku: 'HARD', light_up_puzzle: 'HARD',
};

const MIN_MS_PER_ELEMENT = 300;

export interface ScorePayload {
  globalAbility: 'SPEED' | 'STRENGTH' | 'DEFENCE';
  totalScore: number;
  completionTimeMs: number;
  elements: Array<{ gameId: string; correct: boolean; elapsedMs: number }>;
}

export function validateScore(payload: ScorePayload) {
  const { globalAbility, totalScore, completionTimeMs, elements } = payload;

  if (!['SPEED', 'STRENGTH', 'DEFENCE'].includes(globalAbility)) {
    return { valid: false, reason: 'invalid_ability' };
  }
  if (!Array.isArray(elements) || elements.length !== 7) {
    return { valid: false, reason: 'must_submit_exactly_7_elements' };
  }

  let recomputedScore = 0;
  const seenIds = new Set<string>();

  for (const el of elements) {
    if (seenIds.has(el.gameId)) {
      return { valid: false, reason: 'duplicate_element' };
    }
    seenIds.add(el.gameId);

    const tier = MINI_GAME_TIERS[el.gameId];
    if (!tier) {
      return { valid: false, reason: `unknown_game_id:${el.gameId}` };
    }
    if (typeof el.elapsedMs !== 'number' || el.elapsedMs < MIN_MS_PER_ELEMENT) {
      return { valid: false, reason: `implausible_timing:${el.gameId}` };
    }

    if (el.correct) {
      recomputedScore += (TIER_POINTS as any)[tier] + (globalAbility === 'STRENGTH' ? STRENGTH_BONUS_POINTS : 0);
    } else {
      recomputedScore += globalAbility === 'DEFENCE' ? WRONG_PENALTY.DEFENCE : WRONG_PENALTY.STANDARD;
    }
  }

  if (recomputedScore !== totalScore) {
    return { valid: false, reason: 'score_mismatch', recomputedScore };
  }

  const minPlausibleTotalMs = MIN_MS_PER_ELEMENT * elements.length;
  if (typeof completionTimeMs !== 'number' || completionTimeMs < minPlausibleTotalMs) {
    return { valid: false, reason: 'implausible_total_time' };
  }

  return { valid: true, recomputedScore };
}
