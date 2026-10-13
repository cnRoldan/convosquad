import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { callUps, clubs, demoUserId, memberships, players } from './mock-data';
import { useAuth } from '@/features/auth/auth-context';
import { listClubMembers, listMyClubs, listMyMemberships } from './service';
import { listPlayers } from '@/features/players/service';
import { listCallUps, listCallUpPlayers } from '@/features/call-ups/service';
import { getMyProfile } from '@/features/profiles/service';
import { backendErrorMessage } from '@/lib/backend-result';
import type { CallUp, Club, Membership, RosterPlayer } from './types';

type ClubContextValue = {
  availableClubs: Club[];
  ownMemberships: Membership[];
  activeClub: Club | null;
  currentMembership: Membership | null;
  roster: RosterPlayer[];
  upcomingCallUp: CallUp | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  selectClub: (clubId: string) => void;
  clearClub: () => void;
};
type ClubsState = { userId: string; clubs: Club[]; memberships: Membership[]; error: string | null };
type RosterState = { userId: string; clubId: string; roster: RosterPlayer[]; callUp: CallUp | null; error: string | null };
const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: PropsWithChildren) {
  const { session, isDemo, isLoading: authLoading } = useAuth();
  const userId = session?.user.id;
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [liveClubs, setLiveClubs] = useState<ClubsState | null>(null);
  const [liveRoster, setLiveRoster] = useState<RosterState | null>(null);

  useEffect(() => {
    if (!userId || isDemo) return;
    let active = true;
    void Promise.all([listMyClubs(), listMyMemberships(userId), getMyProfile(userId)])
      .then(([clubRows, memberRows, profile]) => {
        if (active) setLiveClubs({ userId, clubs: clubRows.map((club) => ({ id: club.id, name: club.name, description: club.description, timezone: club.timezone })),
          memberships: memberRows.map((member) => ({ id: member.id, clubId: member.club_id, userId: member.user_id, role: member.role, displayName: profile.username })), error: null });
      }).catch((error: unknown) => {
        if (active) setLiveClubs({ userId, clubs: [], memberships: [], error: backendErrorMessage(error) });
      });
    return () => { active = false; };
  }, [userId, isDemo, revision]);

  const ownMemberships = isDemo
    ? memberships.filter((member) => member.userId === demoUserId)
    : userId && liveClubs?.userId === userId ? liveClubs.memberships : [];
  const availableClubs = isDemo
    ? clubs.filter((club) => ownMemberships.some((member) => member.clubId === club.id))
    : userId && liveClubs?.userId === userId ? liveClubs.clubs : [];
  const activeClub = availableClubs.find((club) => club.id === activeClubId) ?? null;
  const selectedClubId = activeClub?.id;

  useEffect(() => {
    if (!userId || !selectedClubId || isDemo) return;
    let active = true;
    void (async () => {
      try {
        const [playerRows, memberRows, callUpRows] = await Promise.all([listPlayers(selectedClubId), listClubMembers(selectedClubId), listCallUps(selectedClubId)]);
        const next = callUpRows.find((callUp) => callUp.status === 'open' && new Date(callUp.starts_at).getTime() >= Date.now());
        const responses = next ? await listCallUpPlayers(next.id) : [];
        if (active) setLiveRoster({ userId, clubId: selectedClubId,
          roster: playerRows.map((player) => ({ id: player.id, clubId: player.club_id, userId: player.user_id,
            displayName: player.ea_id, eaId: player.ea_id, jerseyNumber: player.jersey_number, position: player.position,
            role: memberRows.find((member) => member.user_id === player.user_id)?.role ?? null })),
          callUp: next ? { id: next.id, clubId: next.club_id, title: 'Convocatoria del club', startsAt: next.starts_at,
            timezone: next.timezone, opponent: 'Por confirmar', slots: responses.length,
            responses: responses.map((entry) => ({ id: entry.id, displayName: entry.ea_id_snapshot, status: entry.availability })) } : null,
          error: null });
      } catch (error) {
        if (active) setLiveRoster({ userId, clubId: selectedClubId, roster: [], callUp: null, error: backendErrorMessage(error) });
      }
    })();
    return () => { active = false; };
  }, [userId, selectedClubId, isDemo, revision]);

  const matchesRoster = Boolean(userId) && liveRoster?.userId === userId && liveRoster?.clubId === selectedClubId;
  const error = isDemo ? null : userId && liveClubs?.userId === userId && liveClubs.error ? liveClubs.error : matchesRoster ? liveRoster?.error ?? null : null;
  const isLoading = authLoading || (!isDemo && Boolean(userId) && (liveClubs?.userId !== userId || (Boolean(selectedClubId) && !matchesRoster)));
  const value: ClubContextValue = {
    availableClubs, ownMemberships, activeClub,
    currentMembership: ownMemberships.find((member) => member.clubId === activeClubId) ?? null,
    roster: isDemo ? players.filter((player) => player.clubId === activeClubId) : matchesRoster ? liveRoster?.roster ?? [] : [],
    upcomingCallUp: isDemo ? callUps.find((callUp) => callUp.clubId === activeClubId) ?? null : matchesRoster ? liveRoster?.callUp ?? null : null,
    isLoading, error,
    refresh: () => setRevision((current) => current + 1),
    selectClub: (clubId) => { if (ownMemberships.some((member) => member.clubId === clubId)) setActiveClubId(clubId); },
    clearClub: () => setActiveClubId(null),
  };
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) throw new Error('useClub requiere ClubProvider');
  return context;
}
