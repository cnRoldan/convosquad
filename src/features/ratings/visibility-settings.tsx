import { useState } from 'react';
import { Body, Button, Card, Message, Options } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { requireSupabase } from '@/lib/supabase';
import { backendErrorMessage } from '@/lib/backend-result';
import { ratingVisibility, type RatingVisibility } from './visibility';
export function RatingVisibilitySettings() {
  useLanguage();
  const { activeClub, currentMembership, reloadClubs } = useClub();
  const current = ratingVisibility(activeClub?.ratingsVisibility);
  const [choice, setChoice] = useState<{ clubId: string; value: RatingVisibility } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  if (!activeClub || currentMembership?.role !== 'admin') return null;
  const clubId = activeClub.id;
  const selected = choice?.clubId === clubId ? choice.value : current;
  async function save() {
    if (busy || selected === current) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await requireSupabase().rpc('set_rating_visibility', { p_club_id: clubId, p_visibility: selected });
      if (error) throw error;
      await reloadClubs(clubId);
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Card title={t('Visibilidad de las valoraciones')}>
    <Options value={selected} options={[{ value: 'captains', label: t('Solo capitanes') }, { value: 'self', label: t('Cada jugador, solo las suyas') }, { value: 'members', label: t('Todos los miembros del club') }]}
      disabled={busy} onChange={value => setChoice({ clubId, value })} />
    <Body>{t('La visibilidad se aplica también al historial. Solo los capitanes pueden puntuar y cambiar esta opción.')}</Body>
    {message ? <Message error>{message}</Message> : null}
    <Button secondary label={t('Guardar visibilidad')} disabled={busy || selected === current} onPress={() => { void save(); }} />
  </Card>;
}
