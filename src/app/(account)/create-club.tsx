import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { Body, Button, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { CrestPicker } from '@/features/clubs/crest-picker';
import { uploadClubCrest, type ClubCrestImage } from '@/features/clubs/crest';
import { TimezonePicker } from '@/features/clubs/timezone-picker';
import { defaultClubTimezone, isClubTimezone } from '@/features/clubs/timezones';
import { createClub } from '@/features/clubs/service';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';

export default function CreateClubScreen() {
  useLanguage();
  const { isDemo } = useAuth();
  const { reloadClubs, notifyClub } = useClub();
  const [crest, setCrest] = useState<ClubCrestImage | null>(null);
  const [crestUploaded, setCrestUploaded] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState(defaultClubTimezone);
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  async function submit() {
    if (isDemo || busy) return;
    if (name.trim().length < 2) return setMessage(t("El nombre debe tener entre 2 y 80 caracteres."));
    if (!isClubTimezone(timezone)) return setMessage(t("Selecciona la zona horaria del club."));
    setBusy(true);
    setMessage('');
    let confirmedClubId = createdClubId;
    try {
      if (!confirmedClubId) {
        const club = await createClub({ name: name.trim(), description: description.trim(), timezone: timezone.trim(), isPublic });
        confirmedClubId = club.id;
        setCreatedClubId(club.id);
      }
      if (crest && !crestUploaded) { await uploadClubCrest(confirmedClubId, crest); setCrestUploaded(true); }
      await reloadClubs(confirmedClubId);
      notifyClub(confirmedClubId, t("Club creado. Ya eres su creador y primer capitán."));
      router.replace('/home');
    } catch (error) {
      setMessage(confirmedClubId ? t("El club ya está creado, pero falta completar el escudo o cargar sus datos. Reintenta para continuar sin crear otro club.") : backendErrorMessage(error));
    }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title={t("Tu propio vestuario")} subtitle={t("Serás el creador y primer capitán del club.")} />
    {isDemo ? <DemoNotice /> : null}
    <CrestPicker image={crest} onChange={image => { setCrest(image); setCrestUploaded(false); }} disabled={busy || isDemo} />
    <Field label={t("Nombre del club")} value={name} onChangeText={setName} maxLength={80} editable={!busy && !createdClubId} />
    <Field label={t("Descripción (opcional)")} value={description} onChangeText={setDescription} maxLength={500} multiline editable={!busy && !createdClubId} />
    <TimezonePicker value={timezone} onChange={setTimezone} disabled={busy || Boolean(createdClubId)} />
    <View style={{ gap: 8 }}><Body>{t("Mostrar nombre y descripción en el buscador público")}</Body>
      <Switch accessibilityLabel={t("Mostrar el club en el buscador público")} value={isPublic} onValueChange={setPublic} disabled={busy || Boolean(createdClubId)} trackColor={{ true: colors.primary }} />
    </View>
    {message ? <Message error>{message}</Message> : null}
    <Button label={busy ? createdClubId ? t("Cargando el club…") : t("Creando el club…") : createdClubId ? t("Entrar al club creado") : t("Crear club")} disabled={busy || isDemo} onPress={() => { void submit(); }} />
    <Button secondary label={t("Volver a mis clubes")} disabled={busy} onPress={() => router.replace('/clubs')} />
  </Screen>;
}
