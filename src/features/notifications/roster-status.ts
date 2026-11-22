import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';

export type NotificationStatus = 'enabled' | 'disabled' | 'denied' | 'no_device' | 'unknown' | 'unlinked' | 'no_membership';
export type RosterNotificationStatus = { player_id: string; status: NotificationStatus; checked_at: string | null; vote_notifications: boolean };
export async function listRosterNotificationStatus(clubId: string): Promise<RosterNotificationStatus[]> {
  const rows = unwrap(await requireSupabase().rpc('list_roster_notification_status', { p_club_id: clubId }));
  return rows.map(row => ({ ...row, status: ['enabled', 'disabled', 'denied', 'no_device', 'unlinked', 'no_membership'].includes(row.status) ? row.status as NotificationStatus : 'unknown' }));
}
export function notificationStatusCopy(status: NotificationStatus): { title: string; detail: string } {
  switch (status) {
    case 'enabled': return { title: 'Dispositivo habilitado', detail: 'Al menos un dispositivo tiene los avisos habilitados según una comprobación de los últimos siete días. Esto no confirma la entrega de cada notificación.' };
    case 'disabled': return { title: 'Avisos desactivados en la app', detail: 'Los avisos están desactivados dentro de ConvoSquad en los dispositivos comprobados recientemente.' };
    case 'denied': return { title: 'Permisos de notificaciones bloqueados', detail: 'Los permisos están bloqueados en un dispositivo comprobado recientemente y no consta otro dispositivo habilitado.' };
    case 'no_device': return { title: 'Sin dispositivo habilitado', detail: 'No consta ningún dispositivo registrado y habilitado para enviar avisos a esta cuenta.' };
    case 'unlinked': return { title: 'Jugador sin cuenta vinculada', detail: 'Esta ficha no está vinculada a una cuenta. No puede recibir notificaciones de ConvoSquad.' };
    case 'no_membership': return { title: 'Cuenta fuera del club', detail: 'La cuenta vinculada no es miembro activo del club y no recibe sus notificaciones.' };
    default: return { title: 'Estado de notificaciones desconocido', detail: 'No hay una comprobación reciente suficiente. No podemos confirmar si este jugador tiene un dispositivo habilitado. El estado se actualiza al abrir la app móvil.' };
  }
}
