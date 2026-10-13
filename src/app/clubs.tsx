import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Switch, View } from 'react-native';

import { Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { createClub } from '@/features/clubs/service';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';

export default function ClubsScreen() {
  const { availableClubs, ownMemberships, selectClub, clearClub, isLoading, error, refresh } = useClub();
  const { session, isDemo, signOut, exitDemo } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('Europe/Madrid');
  const [isPublic, setPublic] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Screen><Body>Cargando tus clubes…</Body></Screen>;
  if (!isDemo && !session) return <Redirect href="/login" />;

  async function submitClub() {
    if (name.trim().length < 2) return setMessage('El nombre del club debe tener al menos dos caracteres.');
    setBusy(true);
    setMessage('');
    try {
      await createClub({ name: name.trim(), description, timezone: timezone.trim(), isPublic });
      setName('');
      setDescription('');
      setPublic(false);
      setMessage('Club creado. Ya eres su primer administrador.');
      refresh();
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function leave() {
    try {
      if (isDemo) exitDemo(); else await signOut();
      clearClub();
      router.replace('/');
    }
    catch (error) { setMessage(backendErrorMessage(error)); }
  }

  return (
    <Screen>
      <Heading title="Elige tu club" subtitle={isDemo ? 'Hola, Álex. Estos son tus vestuarios en la demo.' : 'Una cuenta, varios vestuarios independientes.'} />
      {error ? <Card title="No se pudieron cargar los clubes"><Body>{error}</Body><Button label="Reintentar" onPress={refresh} /></Card> : null}
      {availableClubs.map((club) => {
        const membership = ownMemberships.find((member) => member.clubId === club.id);
        return <Card key={club.id} title={club.name}>
          {club.description ? <Body>{club.description}</Body> : null}
          <Body>{membership?.role === 'admin' ? 'Administrador' : 'Jugador'} · {club.timezone}</Body>
          <Button label="Entrar al club" onPress={() => { selectClub(club.id); router.replace('/home'); }} />
        </Card>;
      })}
      {!isDemo && !error ? <Card title="Crear un club">
        <Field label="Nombre del club" value={name} onChangeText={setName} maxLength={80} editable={!busy} />
        <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} maxLength={500} editable={!busy} />
        <Field label="Zona horaria" value={timezone} onChangeText={setTimezone} autoCapitalize="none" editable={!busy} />
        <View style={{ gap: 8 }}>
          <Body>Aparecer en la búsqueda pública (nombre y descripción)</Body>
          <Switch accessibilityLabel="Aparecer en la búsqueda pública" value={isPublic} onValueChange={setPublic} disabled={busy} trackColor={{ true: colors.primary }} />
        </View>
        <Button disabled={busy} label={busy ? 'Creando…' : 'Crear club'} onPress={() => { void submitClub(); }} />
      </Card> : null}
      {message ? <Body>{message}</Body> : null}
      <Body>La plantilla, el rol y las convocatorias dependen del club seleccionado.</Body>
      <Button secondary label={isDemo ? 'Volver a la bienvenida' : 'Cerrar sesión'} onPress={() => { void leave(); }} />
    </Screen>
  );
}
