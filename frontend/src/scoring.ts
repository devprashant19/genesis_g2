import { TIER_POINTS, WRONG_PENALTY, SPEED_BONUS_SECONDS, getMiniGameById, Ability } from './gameConfig';
import { GameResult } from './MiniGamePlaceholder';

export function computeFinalScore(results: GameResult[], ability: Ability, roundStartMs: number) {
  let totalScore = 0;
  const breakdown = [];

  for (const r of results) {
    const game = getMiniGameById(r.gameId);
    if (!game) continue;

    let points = 0;
    if (r.correct) {
      points = TIER_POINTS[game.tier] + (ability === 'STRENGTH' ? 5 : 0);
    } else {
      points = ability === 'DEFENCE' ? WRONG_PENALTY.DEFENCE : WRONG_PENALTY.STANDARD;
    }

    totalScore += points;
    breakdown.push({ gameId: r.gameId, tier: game.tier, correct: r.correct, points });
  }

  const completionTimeMs = Date.now() - roundStartMs;

  return { totalScore, completionTimeMs, breakdown };
}

export function getTaskTimeMs(baseTimeMs: number, ability: Ability) {
  return ability === 'SPEED' ? baseTimeMs + SPEED_BONUS_SECONDS * 1000 : baseTimeMs;
}

export function buildSubmissionPayload(playerId: string, ability: Ability, results: GameResult[], roundStartMs: number) {
  const { totalScore, completionTimeMs } = computeFinalScore(results, ability, roundStartMs);
  return {
    playerId,
    globalAbility: ability,
    totalScore,
    completionTimeMs,
    elements: results.map((r) => ({ gameId: r.gameId, correct: r.correct, elapsedMs: r.elapsedMs })),
  };
}
