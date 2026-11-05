export function historicalRatingColor(score: number | null): string {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 10) return '#AABCB0';
  if (score < 4) return '#FF8B8B';
  if (score < 5) return '#FFBC66';
  if (score < 7) return '#FFE46B';
  return '#B4F16C';
}
