const ratingDuration = 24 * 60 * 60 * 1000;

type RatingCall = { id: string; status: string; ends_at: string; evaluation_at: string | null; starts_at: string };

export function ratingDeadline(call: Pick<RatingCall, 'ends_at'>): number {
  return Date.parse(call.ends_at) + ratingDuration;
}

export function ratingWindowOpen(call: RatingCall, now: number): boolean {
  return (call.status === 'open' || call.status === 'closed') && Boolean(call.evaluation_at)
    && Date.parse(call.evaluation_at!) <= now && Date.parse(call.ends_at) <= now && now < ratingDeadline(call);
}

export function latestRatingCalls<T extends RatingCall>(calls: readonly T[], now: number): T[] {
  const latest = calls.filter(call => (call.status === 'open' || call.status === 'closed') && Date.parse(call.ends_at) <= now)
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at) || Date.parse(b.starts_at) - Date.parse(a.starts_at) || b.id.localeCompare(a.id))[0];
  return latest && ratingWindowOpen(latest, now) ? [latest] : [];
}

export function ratingCutoff(now: number): number {
  const cutoff = new Date(now);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff.getTime();
}
