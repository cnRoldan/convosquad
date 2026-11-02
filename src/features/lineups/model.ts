import type { RosterCategory } from '@/features/players/categories';

export type Candidate = { id: string; name: string; eligible: boolean; active: boolean; manual?: boolean; jerseyNumber?: number | null | undefined; category?: RosterCategory | undefined };
export type Slot = { id: number; x: number; y: number; playerId: string | null };
export type Formation = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2';
export type Preset = Formation | '3-5-2-one-pivot' | '3-5-2-two-pivots' | '4-4-2-diamond';
export type Lineup = { formation: Formation; slots: Slot[]; bench: string[]; manualIds?: string[]; excludedIds?: string[] | undefined };
export type LineupLayout = { formation: Formation; slots: Pick<Slot, 'id' | 'x' | 'y'>[] };
const lines: Record<Formation, number[]> = { '4-3-3': [4, 3, 3], '4-4-2': [4, 4, 2], '4-2-3-1': [4, 2, 3, 1], '3-5-2': [3, 5, 2] };

export function preset(formation: Preset): Slot[] {
  const variants: Partial<Record<Preset, [number, number][]>> = {
    '3-5-2-one-pivot': [[.25,.72],[.5,.72],[.75,.72],[.16,.45],[.5,.60],[.34,.34],[.66,.34],[.84,.45],[.36,.15],[.64,.15]],
    '3-5-2-two-pivots': [[.25,.72],[.5,.72],[.75,.72],[.16,.45],[.35,.56],[.65,.56],[.84,.45],[.5,.33],[.36,.15],[.64,.15]],
    '4-4-2-diamond': [[.2,.72],[.4,.72],[.6,.72],[.8,.72],[.5,.58],[.27,.45],[.73,.45],[.5,.32],[.36,.15],[.64,.15]],
  };
  const coordinates = variants[formation];
  if (coordinates) return [{ id: 0, x: .5, y: .9, playerId: null }, ...coordinates.map(([x,y], index) => ({ id: index + 1, x, y, playerId: null }))];
  const slots: Slot[] = [{ id: 0, x: 0.5, y: 0.9, playerId: null }];
  lines[formation as Formation].forEach((count, row, rows) => {
    for (let column = 0; column < count; column++) slots.push({
      id: slots.length, x: (column + 1) / (count + 1), y: 0.72 - row * (0.57 / (rows.length - 1)), playerId: null,
    });
  });
  return slots;
}

// IDs are stable roster identities, never names or call-up snapshot IDs.
export function inheritLineup(previous: Lineup | null, candidates: Candidate[]): Lineup {
  const eligible = new Set(candidates.filter(p => p.active && p.eligible).map(p => p.id));
  const slots = previous ? previous.slots.map(s => ({ ...s, playerId: s.playerId && eligible.has(s.playerId) ? s.playerId : null })) : preset('4-3-3');
  const placed = new Set(slots.flatMap(s => s.playerId ? [s.playerId] : []));
  const bench = [...new Set([...(previous?.bench ?? []), ...eligible])].filter(id => eligible.has(id) && !placed.has(id));
  return { formation: previous?.formation ?? '4-3-3', slots, bench };
}

export function applyPreset(lineup: Lineup, selected: Preset): Lineup {
  const formation: Formation = selected.startsWith('3-5-2') ? '3-5-2' : selected === '4-4-2-diamond' ? '4-4-2' : selected as Formation;
  return { ...lineup, formation, slots: preset(selected).map(s => ({ ...s, playerId: lineup.slots.find(old => old.id === s.id)?.playerId ?? null })) };
}

export function layoutFromLineup(lineup: Lineup): LineupLayout {
  return { formation: lineup.formation, slots: lineup.slots.map(({ id, x, y }) => ({ id, x, y })) };
}

export function applyLayout(lineup: Lineup, layout: LineupLayout): Lineup {
  return { ...lineup, formation: layout.formation, slots: layout.slots.map(slot => ({ ...slot, playerId: lineup.slots.find(current => current.id === slot.id)?.playerId ?? null })) };
}

export function moveSlot(lineup: Lineup, slotId: number, x: number, y: number): Lineup {
  if (slotId === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return lineup;
  return { ...lineup, slots: lineup.slots.map(s => s.id === slotId ? { ...s, x: Math.max(0.08, Math.min(0.92, x)), y: Math.max(0.08, Math.min(0.82, y)) } : s) };
}

export function assignPlayer(lineup: Lineup, slotId: number, playerId: string): Lineup {
  const target = lineup.slots.find(s => s.id === slotId);
  const source = lineup.slots.find(s => s.playerId === playerId);
  if (!target || source?.id === target.id || (!source && !lineup.bench.includes(playerId))) return lineup;
  return {
    ...lineup,
    slots: lineup.slots.map(s => s.id === slotId ? { ...s, playerId } : s.id === source?.id ? { ...s, playerId: target.playerId } : s),
    bench: source ? lineup.bench : lineup.bench.map(id => id === playerId ? target.playerId : id).filter((id): id is string => id !== null),
    excludedIds: lineup.excludedIds?.filter(id => id !== playerId),
  };
}

export function sendToBench(lineup: Lineup, slotId: number): Lineup {
  const playerId = lineup.slots.find(s => s.id === slotId)?.playerId;
  if (!playerId) return lineup;
  return { ...lineup, slots: lineup.slots.map(s => s.id === slotId ? { ...s, playerId: null } : s), bench: [...lineup.bench, playerId], excludedIds: lineup.excludedIds?.filter(id => id !== playerId) };
}

export function removeFromBench(lineup: Lineup, playerId: string): Lineup {
  if (!lineup.bench.includes(playerId)) return lineup;
  return { ...lineup, bench: lineup.bench.filter(id => id !== playerId), excludedIds: [...new Set([...(lineup.excludedIds ?? []), playerId])] };
}

export function canPublish(lineup: Lineup): boolean {
  return lineup.slots.length === 11 && lineup.slots.every(s => s.playerId !== null)
    && new Set(lineup.slots.map(s => s.playerId)).size === 11;
}

export function reconcileLineup(lineup: Lineup, candidates: Candidate[]): Lineup {
  const manualIds = (lineup.manualIds ?? []).filter(id => candidates.some(c => c.id === id && c.active));
  const excludedIds = (lineup.excludedIds ?? []).filter(id => candidates.some(c => c.id === id && c.active));
  const eligibleCandidates = candidates.map(c => ({...c,eligible:(c.eligible || manualIds.includes(c.id)) && !excludedIds.includes(c.id)}));
  const result = inheritLineup(lineup, eligibleCandidates);
  return {...result,manualIds,excludedIds};
}
