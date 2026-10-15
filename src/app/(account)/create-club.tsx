import { useState } from 'react';
import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { Body, Button, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { createClub } from '@/features/clubs/service';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';

export default function CreateClubScreen() {
  const { isDemo } = useAuth();
  const { reloadClubs, notifyClub } = useClub();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('Europe/Madrid');
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  async function submit() {
    if (isDemo || busy) return;
    if (name.trim().length < 2) return setMessage('El nombre debe tener entre 2 y 80 caracteres.');
    try { new Intl.DateTimeFormat('es-ES', { timeZone: timezone.trim() }).format(); }
    catch { return setMessage('Utiliza una zona horaria válida, por ejemplo Europe/Madrid.'); }
    setBusy(true);
    setMessage('');
    let confirmedClubId = createdClubId;
    try {
      if (!confirmedClubId) {
        const club = await createClub({ name: name.trim(), description: description.trim(), timezone: timezone.trim(), isPublic });
        confirmedClubId = club.id;
        setCreatedClubId(club.id);
      }
      await reloadClubs(confirmedClubId);
      notifyClub(confirmedClubId, 'Club creado. Ya eres su creador y primer capitán.');
      router.replace('/home');
    } catch (error) {
      setMessage(confirmedClubId ? 'El club se ha creado, pero no se pudieron cargar sus datos. Reintenta entrar al club.' : backendErrorMessage(error));
    }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Tu propio vestuario" subtitle="Serás el creador y primer capitán del club." />
    {isDemo ? <DemoNotice /> : null}
    <Field label="Nombre del club" value={name} onChangeText={setName} maxLength={80} editable={!busy && !createdClubId} />
    <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} maxLength={500} multiline editable={!busy && !createdClubId} />
    <Field label="Zona horaria" value={timezone} onChangeText={setTimezone} autoCapitalize="none" editable={!busy && !createdClubId} />
    <View style={{ gap: 8 }}><Body>Mostrar nombre y descripción en el buscador público</Body>
      <Switch accessibilityLabel="Mostrar el club en el buscador público" value={isPublic} onValueChange={setPublic} disabled={busy || Boolean(createdClubId)} trackColor={{ true: colors.primary }} />
    </View>
    {message ? <Message error>{message}</Message> : null}
    <Button label={busy ? createdClubId ? 'Cargando el club…' : 'Creando el club…' : createdClubId ? 'Entrar al club creado' : 'Crear club'} disabled={busy || isDemo} onPress={() => { void submit(); }} />
    <Button secondary label="Volver a mis clubes" disabled={busy} onPress={() => router.replace('/clubs')} />
  </Screen>;
}
