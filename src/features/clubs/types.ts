import type { Enums } from '@/types/database';

export type ClubRole = Enums<'club_role'>;
export type Club = { id: string; name: string; description: string | null; timezone: string };
export type Membership = { id: string; clubId: string; userId: string; displayName: string; role: ClubRole };
export type RosterPlayer = {
  id: string;
  clubId: string;
  userId: string | null;
  displayName: string;
  eaId: string;
  jerseyNumber: number | null;
  position: Enums<'player_position'>;
  category: Enums<'roster_category'>;
  sortOrder: number;
  role: ClubRole | null;
};
export type CallUp = {
  id: string;
  clubId: string;
  title: string;
  startsAt: string;
  timezone: string;
  opponent: string;
  slots: number;
  responses: { id: string; displayName: string; status: Enums<'availability_status'>; category: Enums<'roster_category'>; sortOrder: number }[];
};
