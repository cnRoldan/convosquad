import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { callUps, clubs, demoUserId, memberships } from './mock-data';
import type { CallUp, Club, Membership } from './types';

type ClubContextValue = {
  availableClubs: Club[];
  activeClub: Club | null;
  currentMembership: Membership | null;
  roster: Membership[];
  upcomingCallUp: CallUp | null;
  selectClub: (clubId: string) => void;
  clearClub: () => void;
};

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: PropsWithChildren) {
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const value = useMemo<ClubContextValue>(() => {
    const ownMemberships = memberships.filter((member) => member.userId === demoUserId);
    return {
      availableClubs: clubs.filter((club) => ownMemberships.some((member) => member.clubId === club.id)),
      activeClub: clubs.find((club) => club.id === activeClubId) ?? null,
      currentMembership: ownMemberships.find((member) => member.clubId === activeClubId) ?? null,
      roster: memberships.filter((member) => member.clubId === activeClubId),
      upcomingCallUp: callUps.find((callUp) => callUp.clubId === activeClubId) ?? null,
      selectClub: (clubId) => {
        if (ownMemberships.some((member) => member.clubId === clubId)) setActiveClubId(clubId);
      },
      clearClub: () => setActiveClubId(null),
    };
  }, [activeClubId]);

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) throw new Error('useClub requiere ClubProvider');
  return context;
}
