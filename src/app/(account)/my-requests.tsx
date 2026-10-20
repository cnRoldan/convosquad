import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { useRequests } from '@/features/join-requests/requests-context';
import { IncomingRequests } from '@/features/join-requests/incoming-requests';
import { backendErrorMessage } from '@/lib/backend-result';

const statuses = { pending: 'Pendiente de revisión', approved: 'Aprobada', rejected: 'Rechazada' } as const;
export default function MyRequestsScreen() {
  useLanguage();
  const { isDemo } = useAuth();
  const { reloadClubs, ownMemberships } = useClub();
  const captain = !isDemo && ownMemberships.some(member => member.role === 'admin');
  const [message, setMessage] = useState('');
  const requests = useRequests();
  async function openClub(clubId: string) {
    try { await reloadClubs(clubId); router.replace('/home'); }
    catch (error) { setMessage(backendErrorMessage(error)); }
  }
  return <Screen onRefresh={!isDemo ? requests.refresh : undefined} refreshing={requests.isLoading}>
    <Heading title={t("Mis solicitudes")} subtitle={captain ? t('Gestiona las solicitudes de tus clubes y consulta las que has enviado.') : t("Comprueba si tu club ha aprobado tu incorporación.")} />
    {isDemo ? <DemoNotice /> : null}
    {requests.isLoading ? <Body>{t("Cargando solicitudes…")}</Body> : null}
    {requests.error ? <Message error>{requests.error}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    {captain ? <Card title={t('Solicitudes para mis clubes')}><IncomingRequests /></Card> : null}
    {captain ? <Body>{t('Solicitudes que he enviado')}</Body> : null}
    {requests.outgoing.map((request) => <Card key={request.id} title={request.club_name_snapshot}>
      <Body>{statuses[request.status]}</Body>
      {request.status === 'approved' ? <Button label={t("Entrar al club")} onPress={() => { void openClub(request.club_id); }} /> : null}
    </Card>)}
    {!requests.isLoading && !requests.error && !requests.outgoing.length ? <Body>{t("No tienes solicitudes.")}</Body> : null}
    <Button secondary label={t("Actualizar solicitudes")} disabled={isDemo || requests.isLoading} onPress={requests.refresh} />
    <Button secondary label={t("Buscar clubes")} onPress={() => router.push('/search-clubs')} />
  </Screen>;
}
