import { votingDeadlinePassed } from './closing-time.ts';
import { categories, compareRoster, isCategory } from '../players/categories.ts';
import type { RosterCategory } from '../players/categories.ts';
import { countAvailability } from './availability.ts';
import type { Tables } from '../../types/database.ts';

export type Availability = Tables<'call_up_players'>['availability'];
export type AvailabilityFilter = 'all' | Availability;
export type CallUpPlayer = { id: string; eaId: string; category: RosterCategory; sortOrder: number; availability: Availability; userId: string | null; jersey: number | null; decisionLocked?: boolean };
export const availabilityStates = ['available', 'unavailable', 'backup', 'unanswered'] as const;
export const availabilityIcons = { available: '✅', unavailable: '❌', backup: '🟡', unanswered: '⏳' } as const;
export const filterLabels = { all: 'Todos', available: 'Disponibles', unavailable: 'No disponibles', backup: 'Backup', unanswered: 'Pendientes' } as const;

export function callUpList(players: readonly CallUpPlayer[], filter: AvailabilityFilter) {
  const official = players.filter(player => isCategory(player.category));
  const visible = official.filter(player => filter === 'all' || player.availability === filter).sort(compareRoster);
  return {
    counts: countAvailability(official), total: official.length, visibleTotal: visible.length,
    groups: categories.map(category => ({ category, players: visible.filter(player => player.category === category),
      total: official.filter(player => player.category === category).length,
      counts: countAvailability(official.filter(player => player.category === category)),
    })).filter(group => filter === 'all' || group.players.length > 0),
  };
}

export function canRespondToPlayer(player: Pick<CallUpPlayer, 'userId'>, userId: string | undefined, call: Pick<Tables<'call_ups'>, 'status' | 'local_date'> & { closes_at?: string | null; ends_at?: string | null }, localDate: string, isDemo: boolean, now = Date.now()) {
  return !isDemo && Boolean(userId && player.userId && player.userId === userId) && call.status === 'open' && (call.ends_at ? Date.parse(call.ends_at) > now : call.local_date >= localDate) && !votingDeadlinePassed(call, now);
}
