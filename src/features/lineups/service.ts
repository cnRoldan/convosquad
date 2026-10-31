import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { listCallUpPlayers, listCallUpTrials, listAids, getCallUp } from '@/features/call-ups/service';
import { listTrials } from '@/features/trials/service';
import { listPlayers } from '@/features/players/service';
import type { Json } from '@/types/database';
import { inheritLineup, reconcileLineup, type Candidate, type Lineup, type LineupLayout } from './model';

export type LineupAccess = { activated: boolean; premium: boolean; remaining: number; allowed: boolean };
export type LineupDraft = { id: string; ordinal: number; title: string; document: Lineup; revision: number; submittedAt: string | null; createdBy: string; updatedBy: string; updatedAt: string; upVotes: number; downVotes: number; myVote: boolean | null; published: boolean };

export async function readLineupAccess(callId: string): Promise<LineupAccess> {
  return unwrap(await requireSupabase().rpc('read_lineup_access', { p_call_id: callId })) as unknown as LineupAccess;
}

export async function activateLineupAccess(callId: string): Promise<LineupAccess> {
  return unwrap(await requireSupabase().rpc('activate_lineup_access', { p_call_id: callId })) as unknown as LineupAccess;
}

export async function listLineupDrafts(callId: string): Promise<LineupDraft[]> {
  return unwrap(await requireSupabase().rpc('list_lineup_drafts', { p_call_id: callId })) as unknown as LineupDraft[];
}

export async function saveLineupDraft(callId: string, draft: LineupDraft | null, title: string, document: Lineup, submit = false) {
  return unwrap(await requireSupabase().rpc('save_lineup_draft', { p_call_id: callId, p_draft_id: (draft?.id ?? null) as unknown as string, p_revision: draft?.revision ?? 0, p_title: title, p_document: document as unknown as Json, p_submit: submit })) as unknown as Pick<LineupDraft, 'id' | 'ordinal' | 'title' | 'document' | 'revision' | 'submittedAt'>;
}

export async function voteLineupDraft(draftId: string, approved: boolean) {
  const { error } = await requireSupabase().rpc('vote_lineup_draft', { p_draft_id: draftId, p_approved: approved }); if (error) throw error;
}

export async function publishLineupDraft(draftId: string) {
  const { error } = await requireSupabase().rpc('publish_lineup_draft', { p_draft_id: draftId }); if (error) throw error;
}

export async function deleteLineupDraft(draftId: string) {
  const { error } = await requireSupabase().rpc('delete_lineup_draft', { p_draft_id: draftId }); if (error) throw error;
}

export async function loadLineup(clubId: string, callId: string, captain: boolean) {
  const [players, roster, saved, guests, trials, aids, rosterTrials, call, preference] = await Promise.all([
    listCallUpPlayers(callId), listPlayers(clubId),
    requireSupabase().rpc('read_lineup', { p_call_id: callId }).then(unwrap),
    requireSupabase().rpc('list_lineup_guests', { p_call_id: callId }).then(unwrap),
    listCallUpTrials(callId), listAids(callId), listTrials(clubId), getCallUp(clubId,callId),
    requireSupabase().rpc('read_lineup_preference', { p_club_id: clubId }).then(unwrap),
  ]);
  const data = saved as unknown as { revision: number; document: Lineup | null; inherited: boolean };
  const eligible = new Set(players.filter(p => p.availability === 'available' || p.availability === 'backup').map(p => p.source_player_id));
  const candidates: Candidate[] = roster.map(p => ({ id: p.id, name: p.ea_id, jerseyNumber: p.jersey_number, category: p.category, active: p.is_active, eligible: eligible.has(p.id) }));
  candidates.push(...guests.map(g => ({id:g.id,name:g.name,jerseyNumber:rosterTrials.find(t=>t.id===g.source_trial_id)?.jersey_number ?? trials.find(t=>t.id===g.trial_id)?.jersey_number_snapshot,active:g.source_trial_id ? rosterTrials.some(t=>t.id===g.source_trial_id) : true,eligible:false})));
  candidates.push(...rosterTrials.filter(t=>!guests.some(g=>g.source_trial_id===t.id)).map(t=>({id:t.id,name:t.ea_id,jerseyNumber:t.jersey_number,active:true,eligible:false})));
  candidates.push(...trials.filter(t=>!t.source_trial_id && !guests.some(g=>g.trial_id===t.id)).map(t=>({id:t.id,name:t.ea_id_snapshot,jerseyNumber:t.jersey_number_snapshot,active:true,eligible:false})));
  candidates.push(...aids.filter(a=>!guests.some(g=>g.aid_id===a.id || g.id===a.lineup_guest_id)).map(a=>({id:a.id,name:a.body,active:true,eligible:false})));
  const active=['open','closed'].includes(call.status)&&new Date(call.ends_at).getTime()>Date.now();
  const customLayout = isLineupLayout(preference) ? preference : null;
  return { revision: data.revision, candidates, active, preference: customLayout, playerColor: isPlayerColor(preference) ? preference.playerColor : '#B4F16C', jerseyColor: isJerseyColor(preference) ? preference.jerseyColor : '#0B1210', positionLocked: isPositionLocked(preference) ? preference.positionLocked : true, document: captain && data.inherited ? inheritLineup(data.document, candidates) : data.document && active ? reconcileLineup(data.document,candidates) : data.document };
}

export async function saveLineup(callId: string, revision: number, document: Lineup, publish: boolean) {
  return unwrap(await requireSupabase().rpc('save_lineup', { p_call_id: callId, p_revision: revision, p_document: document as unknown as Json, p_publish: publish }));
}

export async function saveLineupPreference(clubId: string, layout: LineupLayout): Promise<LineupLayout> {
  return unwrap(await requireSupabase().rpc('save_lineup_preference', { p_club_id: clubId, p_formation: layout.formation, p_slots: layout.slots as unknown as Json })) as unknown as LineupLayout;
}

export async function deleteLineupPreference(clubId: string) {
  const { error } = await requireSupabase().rpc('delete_lineup_preference', { p_club_id: clubId });
  if (error) throw error;
}

export async function setLineupPlayerColor(clubId: string, color: string) {
  return unwrap(await requireSupabase().rpc('set_lineup_player_color', { p_club_id: clubId, p_color: color }));
}

export async function setLineupPlayerColors(clubId: string, playerColor: string, jerseyColor: string) {
  return unwrap(await requireSupabase().rpc('set_lineup_player_colors', { p_club_id: clubId, p_player_color: playerColor, p_jersey_color: jerseyColor })) as unknown as { playerColor: string; jerseyColor: string };
}

export async function setLineupPositionLock(clubId: string, locked: boolean) {
  return unwrap(await requireSupabase().rpc('set_lineup_position_lock', { p_club_id: clubId, p_locked: locked }));
}

function isLineupLayout(value: unknown): value is LineupLayout {
  if (!value || typeof value !== 'object' || !('formation' in value) || !('slots' in value)) return false;
  return ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'].includes(String(value.formation)) && Array.isArray(value.slots) && value.slots.length === 11;
}

function isPlayerColor(value: unknown): value is { playerColor: string } {
  return Boolean(value && typeof value === 'object' && 'playerColor' in value && typeof value.playerColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.playerColor));
}

function isJerseyColor(value: unknown): value is { jerseyColor: string } {
  return Boolean(value && typeof value === 'object' && 'jerseyColor' in value && typeof value.jerseyColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.jerseyColor));
}

function isPositionLocked(value: unknown): value is { positionLocked: boolean } {
  return Boolean(value && typeof value === 'object' && 'positionLocked' in value && typeof value.positionLocked === 'boolean');
}
