export type ClubRole = 'admin' | 'player';

export type Club = {
  id: string;
  name: string;
  description: string;
};

export type Membership = {
  id: string;
  clubId: string;
  userId: string;
  displayName: string;
  role: ClubRole;
  position: string;
};

export type CallUp = {
  id: string;
  clubId: string;
  title: string;
  startsAt: string;
  opponent: string;
  slots: number;
  responses: { membershipId: string; status: 'confirmed' | 'pending' | 'declined' }[];
};
