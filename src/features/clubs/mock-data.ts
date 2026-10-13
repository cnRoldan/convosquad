import type { CallUp, Club, Membership } from './types';

export const demoUserId = 'demo-alex';

export const clubs: Club[] = [
  { id: 'squad-verde', name: 'Squad Verde FC', description: 'Juntos hasta el último minuto.' },
  { id: 'norte-united', name: 'Norte United', description: 'Otra camiseta, la misma pasión.' },
];

export const memberships: Membership[] = [
  { id: 'verde-alex', clubId: 'squad-verde', userId: demoUserId, displayName: 'Álex', role: 'admin', position: 'MC' },
  { id: 'verde-dani', clubId: 'squad-verde', userId: 'demo-dani', displayName: 'Dani', role: 'player', position: 'DC' },
  { id: 'verde-lucia', clubId: 'squad-verde', userId: 'demo-lucia', displayName: 'Lucía', role: 'player', position: 'DFC' },
  { id: 'verde-marcos', clubId: 'squad-verde', userId: 'demo-marcos', displayName: 'Marcos', role: 'player', position: 'POR' },
  { id: 'norte-alex', clubId: 'norte-united', userId: demoUserId, displayName: 'Álex', role: 'player', position: 'MCO' },
  { id: 'norte-sara', clubId: 'norte-united', userId: 'demo-sara', displayName: 'Sara', role: 'admin', position: 'DC' },
  { id: 'norte-ivan', clubId: 'norte-united', userId: 'demo-ivan', displayName: 'Iván', role: 'player', position: 'DFC' },
];

export const callUps: CallUp[] = [
  {
    id: 'verde-jornada', clubId: 'squad-verde', title: 'Noche de liga',
    startsAt: '2026-11-06T21:00:00+01:00', opponent: 'Rival por confirmar', slots: 11,
    responses: [
      { membershipId: 'verde-alex', status: 'confirmed' },
      { membershipId: 'verde-dani', status: 'confirmed' },
      { membershipId: 'verde-lucia', status: 'pending' },
      { membershipId: 'verde-marcos', status: 'declined' },
    ],
  },
  {
    id: 'norte-amistoso', clubId: 'norte-united', title: 'Amistoso del club',
    startsAt: '2026-11-07T20:30:00+01:00', opponent: 'Sur Athletic', slots: 11,
    responses: [
      { membershipId: 'norte-alex', status: 'pending' },
      { membershipId: 'norte-sara', status: 'confirmed' },
      { membershipId: 'norte-ivan', status: 'confirmed' },
    ],
  },
];
