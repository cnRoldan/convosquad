import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { Body, Button, Card, Message } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { getNotificationPreferences, setVoteNotifications } from './preferences';

export function VoteNotificationPreference({ userId }: { userId: string }) {
  useLanguage();
  const load = useCallback(() => getNotificationPreferences(), []);
  const preferences = useResource(`notification-preferences:${userId}`, load, true);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);
  async function save(enabled: boolean) {
    if (saving || preferences.isLoading || preferences.error) return;
    setSaving(true); setMessage('');
    try { await setVoteNotifications(enabled); preferences.reload(); setFailure(false); setMessage(t("Preferencia guardada para todos tus dispositivos y clubes.")); }
    catch { setFailure(true); setMessage(t("No se pudo guardar la preferencia. Comprueba tu conexión e inténtalo de nuevo.")); }
    finally { setSaving(false); }
  }
  return <Card title={t("Avisos de votos")}>
    <Body>{t("Avísame cuando otro jugador vote o cambie su disponibilidad. No recibirás avisos de tus propios votos. Esta preferencia no desactiva el último aviso para votar.")}</Body>
    <Body>{t("Los jugadores de la categoría BACKUPS solo reciben el aviso de cancelación si ya han respondido. PRUEBAS y AYUDAS no reciben avisos.")}</Body>
    <Switch accessibilityLabel={t("Avisarme cuando otro jugador vote")} value={preferences.data?.vote_notifications ?? true} disabled={saving || preferences.isLoading || Boolean(preferences.error)} onValueChange={value => { void save(value); }} />
    {preferences.error ? <><Message error>{t("No se pudo cargar tu preferencia de avisos.")}</Message><Button secondary label={t("Reintentar preferencias")} onPress={preferences.reload} /></> : null}
    {message ? <Message error={failure}>{message}</Message> : null}
  </Card>;
}
