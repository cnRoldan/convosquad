import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { CrestSettings } from '@/features/clubs/crest-settings';
import { TimezonePicker } from '@/features/clubs/timezone-picker';
import { deleteClub, getClubSettings, updateClub } from '@/features/clubs/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';

export default function ClubInfoScreen() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub } = useClub();
  const clubId = activeClub?.id;
  const load = useCallback(() => getClubSettings(clubId!), [clubId]);
  const result = useResource(`club-info:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  return <Screen>
    <Heading title={t("Editar información")} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>{t("Cargando información…")}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label={t("Reintentar")} onPress={result.reload} /></> : null}
    {result.data ? <ClubInfoForm key={`${session?.user.id}:${clubId}`} club={result.data} /> : null}
  </Screen>;
}

function ClubInfoForm({ club }: { club: Tables<'clubs'> }) {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { currentMembership, reloadClubs } = useClub();
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? '');
  const [timezone, setTimezone] = useState(club.timezone);
  const [isPublic, setPublic] = useState(club.is_public);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const admin = currentMembership?.role === 'admin' && !isDemo;
  const owner = club.created_by === session?.user.id;
  async function save() {
    if (!admin || busy) return;
    setError(true); setMessage('');
    if (name.trim().length < 2 || name.trim().length > 80) return setMessage(t("El nombre debe tener entre 2 y 80 caracteres."));
    if (description.trim().length > 500) return setMessage(t("La descripción no puede superar los 500 caracteres."));
    setBusy(true);
    try {
      await updateClub(club.id, { name: name.trim(), description: description.trim() || null, timezone, is_public: isPublic });
      await reloadClubs(club.id);
      setError(false); setMessage(t("Información del club actualizada."));
    } catch (cause) { setMessage(backendErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!admin || !owner || busy) return;
    setBusy(true); setMessage('');
    try { await deleteClub(club.id); await reloadClubs(); router.replace('/clubs'); }
    catch (cause) { setError(true); setMessage(backendErrorMessage(cause)); }
    finally { setBusy(false); setDeleting(false); }
  }
  return <>
    <Card title={t("Información del club")}>
      <Field label={t("Nombre del club")} value={name} onChangeText={setName} maxLength={80} editable={admin && !busy} />
      <Field label={t("Descripción (opcional)")} value={description} onChangeText={setDescription} maxLength={500} multiline editable={admin && !busy} />
      <TimezonePicker value={timezone} onChange={setTimezone} disabled={!admin || busy} />
      <Body>{t("Las convocatorias ya creadas conservarán su horario. Las nuevas usarán la zona elegida.")}</Body>
      <View style={{ gap: 8 }}><Body>{t("Mostrar nombre y descripción en el buscador público")}</Body>
        <Switch accessibilityLabel={t("Mostrar el club en el buscador público")} value={isPublic} onValueChange={setPublic} disabled={!admin || busy} trackColor={{ true: colors.primary }} />
      </View>
      <Button label={busy ? t("Guardando…") : t("Guardar información")} disabled={!admin || busy} onPress={() => { void save(); }} />
    </Card>
    <CrestSettings />
    {message ? <Message error={error}>{message}</Message> : null}
    {owner ? <Card title={t("Eliminar club")}>
      <Body>{t("Se eliminarán la plantilla, las convocatorias y el historial de este club. Las cuentas de los jugadores se conservarán.")}</Body>
      <Button secondary label={t("Eliminar club")} disabled={!admin || busy} onPress={() => setDeleting(true)} />
    </Card> : null}
    <ConfirmDialog visible={deleting} title={t("Eliminar el club definitivamente")} description={t("Esta acción eliminará la plantilla, las convocatorias y su historial. No se puede deshacer. Las cuentas no se eliminarán.")} confirmLabel={t("Eliminar definitivamente")} busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => { void remove(); }} />
  </>;
}
