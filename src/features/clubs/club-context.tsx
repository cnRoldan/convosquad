import { t, useLanguage } from '@/features/i18n/runtime';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { callUps, clubs, demoUserId, memberships, players } from './mock-data';
import { useAuth } from '@/features/auth/auth-context';
import { listClubMembers, listMyClubs, listMyMemberships } from './service';
import { listPlayers } from '@/features/players/service';
import { listCurrentCallUps, listCallUpPlayers } from '@/features/call-ups/service';
import { clubLocalDateTime } from '@/features/call-ups/local-time';
import { getMyProfile } from '@/features/profiles/service';
import { backendErrorMessage } from '@/lib/backend-result';
import { useResource } from '@/hooks/use-resource';
import type { CallUp, Club, Membership, RosterPlayer } from './types';

type ClubContextValue = {
  accountEaId: string | null;
  availableClubs: Club[];
  ownMemberships: Membership[];
  activeClub: Club | null;
  currentMembership: Membership | null;
  roster: RosterPlayer[];
  upcomingCallUp: CallUp | null;
  isLoading: boolean;
  error: string | null;
  rosterLoading: boolean;
  rosterVersion: number;
  notice: string | null;
  notifyClub: (clubId: string, message: string) => void;
  rosterError: string | null;
  refresh: () => void;
  refreshRoster: () => void;
  reloadClubs: (preferredId?: string) => Promise<void>;
  selectClub: (clubId: string) => void;
  clearClub: () => void;
};
type ClubsState = { userId: string; eaId: string | null; clubs: Club[]; memberships: Membership[]; error: string | null };
type Selection = { scope: string; id: string | null };
const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: PropsWithChildren) {
  useLanguage();
  const { session, isDemo, isLoading: authLoading, isRecovery } = useAuth();
  const userId = session?.user.id;
  const scope = isDemo ? 'demo' : userId ?? 'guest';
  const [selection, setSelection] = useState<Selection>({ scope: 'guest', id: null });
  const selectionRef = useRef(selection);
  const [liveClubs, setLiveClubs] = useState<ClubsState | null>(null);
  const requestId = useRef(0);
  const [notice, setNotice] = useState<{ scope: string; clubId: string; message: string } | null>(null);

  const reloadClubs = useCallback(async (preferredId?: string) => {
    if (!userId || isDemo || isRecovery) return;
    const version = ++requestId.current;
    try {
      const [clubRows, memberRows, profile, savedId] = await Promise.all([
        listMyClubs(), listMyMemberships(userId), getMyProfile(userId),
        AsyncStorage.getItem(`convosquad:club:${userId}`).catch(() => null),
      ]);
      if (version !== requestId.current) return;
      const own = memberRows.map((member) => ({ id: member.id, clubId: member.club_id, userId: member.user_id, role: member.role, displayName: profile.username }));
      const available = clubRows.filter((club) => own.some((member) => member.clubId === club.id))
        .map((club) => ({ id: club.id, name: club.name, description: club.description, timezone: club.timezone, crestPath: club.crest_path ?? null }));
      const current = selectionRef.current.scope === userId ? selectionRef.current.id : null;
      const candidate = preferredId ?? current ?? savedId;
      const chosen = available.find((club) => club.id === candidate)?.id ?? (available.length === 1 ? available[0]?.id ?? null : null);
      setLiveClubs({ userId, eaId: profile.username, clubs: available, memberships: own, error: null });
      const next = { scope: userId, id: chosen };
      selectionRef.current = next;
      setSelection(next);
      if (chosen) await AsyncStorage.setItem(`convosquad:club:${userId}`, chosen).catch(() => undefined);
      if (preferredId && chosen !== preferredId) throw new Error(t("No se pudo cargar el club seleccionado."));
    } catch (error) {
      if (version === requestId.current) setLiveClubs({ userId, eaId: null, clubs: [], memberships: [], error: backendErrorMessage(error) });
      throw error;
    }
  }, [userId, isDemo, isRecovery]);

  useEffect(() => {
    void reloadClubs().catch(() => undefined);
    return () => { requestId.current += 1; };
  }, [reloadClubs]);

  const ownMemberships = isDemo ? memberships.filter((member) => member.userId === demoUserId)
    : userId && liveClubs?.userId === userId ? liveClubs.memberships : [];
  const availableClubs = isDemo ? clubs.filter((club) => ownMemberships.some((member) => member.clubId === club.id))
    : userId && liveClubs?.userId === userId ? liveClubs.clubs : [];
  const selectedId = selection.scope === scope ? selection.id : null;
  const activeClub = availableClubs.find((club) => club.id === selectedId) ?? null;
  const clubId = activeClub?.id;
  const loadRoster = useCallback(async (): Promise<{ roster: RosterPlayer[]; callUp: CallUp | null }> => {
    if (!clubId) return { roster: [], callUp: null };
    const [playerRows, memberRows, callUpRows] = await Promise.all([listPlayers(clubId), listClubMembers(clubId), listCurrentCallUps(clubId, clubLocalDateTime(activeClub?.timezone ?? 'Europe/Madrid').date)]);
    const next = callUpRows.find((callUp) => callUp.status === 'open');
    const responses = next ? await listCallUpPlayers(next.id) : [];
    return {
      roster: playerRows.map((player) => ({ id: player.id, clubId: player.club_id, userId: player.user_id,
        displayName: player.ea_id, eaId: player.ea_id, jerseyNumber: player.jersey_number, position: player.position, category: player.category, sortOrder: player.sort_order,
        role: memberRows.find((member) => member.user_id === player.user_id)?.role ?? null })),
      callUp: next ? { id: next.id, clubId: next.club_id, title: t("Convocatoria del club"), startsAt: next.starts_at,
        timezone: next.timezone, opponent: t("Por confirmar"), slots: responses.length,
        responses: responses.map((entry) => ({ id: entry.id, displayName: entry.ea_id_snapshot, status: entry.availability, category: entry.category_snapshot, sortOrder: entry.sort_order_snapshot })) } : null,
    };
  }, [clubId, activeClub?.timezone]);
  const data = useResource(`roster:${userId}:${clubId}`, loadRoster, Boolean(userId && clubId && !isDemo && !isRecovery));

  function selectClub(id: string) {
    if (!ownMemberships.some((member) => member.clubId === id)) return;
    setNotice(null);
    const next = { scope, id };
    selectionRef.current = next;
    setSelection(next);
    if (userId && !isDemo) void AsyncStorage.setItem(`convosquad:club:${userId}`, id).catch(() => undefined);
  }
  function clearClub() {
    const next = { scope, id: null };
    selectionRef.current = next;
    setSelection(next);
  }
  const value: ClubContextValue = {
    accountEaId: !isDemo && userId && liveClubs?.userId === userId ? liveClubs.eaId : null,
    availableClubs, ownMemberships, activeClub,
    notice: notice?.scope === scope && notice.clubId === clubId ? notice.message : null,
    notifyClub: (clubId, message) => setNotice({ scope, clubId, message }),
    currentMembership: ownMemberships.find((member) => member.clubId === selectedId) ?? null,
    roster: isDemo ? players.filter((player) => player.clubId === selectedId) : data.data?.roster ?? [],
    upcomingCallUp: isDemo ? callUps.find((callUp) => callUp.clubId === selectedId) ?? null : data.data?.callUp ?? null,
    isLoading: authLoading || (!isDemo && Boolean(userId) && !isRecovery && liveClubs?.userId !== userId),
    error: !isDemo && userId && liveClubs?.userId === userId ? liveClubs.error : null,
    rosterLoading: data.isLoading, rosterVersion: data.version, rosterError: data.error, refreshRoster: data.reload,
    refresh: () => { void reloadClubs().catch(() => undefined); data.reload(); },
    reloadClubs, selectClub, clearClub,
  };
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}
export function useClub() {
  const context = useContext(ClubContext);
  if (!context) throw new Error(t("useClub requiere ClubProvider"));
  return context;
}
