import type { CallUp, Club, Membership, RosterPlayer } from './types';

export const demoUserId = 'demo-alex';
export const clubs: Club[] = [
  { id: 'squad-verde', name: 'Squad Verde FC', description: 'Juntos hasta el último minuto.', timezone: 'Europe/Madrid' },
  { id: 'norte-united', name: 'Norte United', description: 'Otra camiseta, la misma pasión.', timezone: 'Europe/Madrid' },
];
export const memberships: Membership[] = [
  { id: 'verde-alex', clubId: 'squad-verde', userId: demoUserId, displayName: 'Álex', role: 'admin' },
  { id: 'verde-dani', clubId: 'squad-verde', userId: 'demo-dani', displayName: 'Dani', role: 'player' },
  { id: 'verde-lucia', clubId: 'squad-verde', userId: 'demo-lucia', displayName: 'Lucía', role: 'player' },
  { id: 'verde-marcos', clubId: 'squad-verde', userId: 'demo-marcos', displayName: 'Marcos', role: 'player' },
  { id: 'norte-alex', clubId: 'norte-united', userId: demoUserId, displayName: 'Álex', role: 'player' },
  { id: 'norte-sara', clubId: 'norte-united', userId: 'demo-sara', displayName: 'Sara', role: 'admin' },
  { id: 'norte-ivan', clubId: 'norte-united', userId: 'demo-ivan', displayName: 'Iván', role: 'player' },
];
const positions = ['MC', 'DC', 'DFC', 'POR', 'MCO', 'DC', 'DFC'] as const;
export const players: RosterPlayer[] = memberships.map((member, index) => ({
  id: member.id, clubId: member.clubId, userId: member.userId, displayName: member.displayName,
  eaId: `FC_${member.userId}`, jerseyNumber: index + 1, position: positions[index] ?? 'MC', role: member.role,
}));
players.push({ id: 'verde-guest', clubId: 'squad-verde', userId: null, displayName: 'FC_Invitado', eaId: 'FC_Invitado', jerseyNumber: 12, position: 'EI', role: null });
export const callUps: CallUp[] = [
  {
    id: 'verde-jornada', clubId: 'squad-verde', title: 'Noche de liga', timezone: 'Europe/Madrid',
    startsAt: '2026-11-06T21:00:00+01:00', opponent: 'Rival por confirmar', slots: 11,
    responses: [
      { id: 'verde-alex', displayName: 'Álex', status: 'available' },
      { id: 'verde-dani', displayName: 'Dani', status: 'available' },
      { id: 'verde-lucia', displayName: 'Lucía', status: 'unanswered' },
      { id: 'verde-marcos', displayName: 'Marcos', status: 'unavailable' },
      { id: 'verde-guest', displayName: 'FC_Invitado', status: 'unanswered' },
    ],
  },
  {
    id: 'norte-amistoso', clubId: 'norte-united', title: 'Amistoso del club', timezone: 'Europe/Madrid',
    startsAt: '2026-11-07T20:30:00+01:00', opponent: 'Sur Athletic', slots: 11,
    responses: [
      { id: 'norte-alex', displayName: 'Álex', status: 'backup' },
      { id: 'norte-sara', displayName: 'Sara', status: 'available' },
      { id: 'norte-ivan', displayName: 'Iván', status: 'available' },
    ],
  },
];
