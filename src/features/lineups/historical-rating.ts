export function historicalRatingColor(score: number | null): string {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 10) return '#AABCB0';
  if (score < 4) return '#FF8B8B';
  if (score < 5) return '#FFBC66';
  if (score < 7) return '#FFE46B';
  return '#B4F16C';
}

export function lineupHistoricalRating(lineup: { slots: { playerId: string | null }[] }, ratings: ReadonlyMap<string, number | null>): number | null {
  const players = new Set(lineup.slots.flatMap(slot => slot.playerId ? [slot.playerId] : []));
  const scores = [...players].flatMap(id => {
    const score = ratings.get(id);
    return score !== null && score !== undefined && Number.isFinite(score) && score >= 0 && score <= 10 ? [score] : [];
  });
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) : null;
}
