import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { searchPublicClubs } from '@/features/clubs/service';
import { listMyJoinRequests, requestToJoin } from '@/features/join-requests/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { ClubCrest } from '@/features/clubs/club-crest';
import { colors } from '@/theme';

export default function SearchClubsScreen() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { availableClubs } = useClub();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!session) return { clubs: [], requests: [] };
    const [clubs, requests] = await Promise.all([searchPublicClubs(searched ?? ''), listMyJoinRequests(session.user.id)]);
    return { clubs, requests };
  }, [session, searched]);
  const result = useResource(`search:${session?.user.id}:${searched}`, load, !isDemo && Boolean(session) && searched !== null);
  function search() { Keyboard.dismiss(); setMessage(''); setSearched(query.trim()); result.reload(); }
  async function request(clubId: string) {
    if (isDemo || busyId) return;
    setBusyId(clubId);
    setMessage('');
    try { await requestToJoin(clubId); setMessage(t("Solicitud enviada. El administrador decidirá tu incorporación.")); result.reload(); }
    catch (error) {
      setMessage(typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' ? t("Ya tienes una solicitud pendiente para ese club.") : backendErrorMessage(error));
      result.reload();
    } finally { setBusyId(null); }
  }
  return <Screen>
    <Heading title={t("Encuentra tu equipo")} subtitle={t("Solo se muestran los clubes que han elegido aparecer en el buscador.")} />
    {isDemo ? <DemoNotice /> : null}
    <Field label={t("Nombre del club")} value={query} onChangeText={setQuery} maxLength={80} returnKeyType="search" onSubmitEditing={search} />
    <Button label={t("Buscar")} disabled={isDemo || result.isLoading} onPress={search} />
    {result.isLoading ? <Body>{t("Buscando clubes…")}</Body> : null}
    {result.error ? <Message error>{result.error}</Message> : null}
    {message ? <Message>{message}</Message> : null}
    {result.data?.clubs.map((club) => {
      const belongs = availableClubs.some((own) => own.id === club.club_id);
      const pending = result.data?.requests.some((request) => request.club_id === club.club_id && request.status === 'pending');
      return <Card key={club.club_id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: '700' }}>{club.name}</Text>
          <ClubCrest path={club.crest_path} name={club.name} />
        </View>
        {club.description ? <Body>{club.description}</Body> : null}
        <Button label={belongs ? t("Ya perteneces al club") : pending ? t("Solicitud pendiente") : busyId === club.club_id ? t("Enviando…") : t("Solicitar unirme")}
          disabled={belongs || pending || Boolean(busyId)} onPress={() => { void request(club.club_id); }} />
      </Card>;
    })}
    {searched !== null && result.data?.clubs.length === 0 && !result.isLoading ? <Body>{t("No se han encontrado clubes públicos con ese nombre.")}</Body> : null}
    <Button secondary label={t("Ver mis solicitudes")} onPress={() => router.push('/my-requests')} />
  </Screen>;
}
