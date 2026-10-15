import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { Body, Button, Card, Message } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { getNotificationPreferences, setVoteNotifications } from './preferences';

export function VoteNotificationPreference({ userId }: { userId: string }) {
  const load = useCallback(() => getNotificationPreferences(), []);
  const preferences = useResource(`notification-preferences:${userId}`, load, true);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);
  async function save(enabled: boolean) {
    if (saving || preferences.isLoading || preferences.error) return;
    setSaving(true); setMessage('');
    try { await setVoteNotifications(enabled); preferences.reload(); setFailure(false); setMessage('Preferencia guardada para todos tus dispositivos y clubes.'); }
    catch { setFailure(true); setMessage('No se pudo guardar la preferencia. Comprueba tu conexión e inténtalo de nuevo.'); }
    finally { setSaving(false); }
  }
  return <Card title="Avisos de votos">
    <Body>Avísame cuando otro jugador vote o cambie su disponibilidad. No recibirás avisos de tus propios votos. Esta preferencia no desactiva el último aviso para votar.</Body>
    <Body>Los jugadores de la categoría BACKUPS solo reciben el aviso de cancelación si ya han respondido. PRUEBAS y AYUDAS no reciben avisos.</Body>
    <Switch accessibilityLabel="Avisarme cuando otro jugador vote" value={preferences.data?.vote_notifications ?? true} disabled={saving || preferences.isLoading || Boolean(preferences.error)} onValueChange={value => { void save(value); }} />
    {preferences.error ? <><Message error>No se pudo cargar tu preferencia de avisos.</Message><Button secondary label="Reintentar preferencias" onPress={preferences.reload} /></> : null}
    {message ? <Message error={failure}>{message}</Message> : null}
  </Card>;
}
