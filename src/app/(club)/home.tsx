import { t, useLanguage } from '@/features/i18n/runtime';
import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { formatMatchDate } from '@/lib/format';

export default function HomeScreen() {
  useLanguage();
  const { isDemo } = useAuth();
  const { activeClub, currentMembership, roster, upcomingCallUp, rosterLoading, rosterError, refreshRoster, notice } = useClub();
  return (
    <Screen>
      <Heading title={activeClub?.name ?? t("Tu club")} subtitle={t("Tu rol: {{v0}}.", { v0: currentMembership?.role === 'admin' ? t("capitán") : t("jugador") })} />
      {notice ? <Body>{notice}</Body> : null}
      {rosterLoading ? <Body>{t("Cargando datos del vestuario…")}</Body> : null}
      {rosterError ? <Card title={t("No se pudieron cargar los datos")}><Body>{rosterError}</Body><Button label={t("Reintentar")} onPress={refreshRoster} /></Card> : null}
      <Card title={t("El vestuario")}>
        {!rosterLoading && !rosterError ? <Body>{t("{{v0}} jugadores en plantilla", { v0: roster.length })}</Body> : null}
        <Button secondary label={t("Ver plantilla")} onPress={() => router.navigate('/roster')} />
      </Card>
      <Card title={t("Próxima convocatoria")}>
        {upcomingCallUp ? <>
          <Body>{upcomingCallUp.title}</Body>
          <Body>{formatMatchDate(upcomingCallUp.startsAt, upcomingCallUp.timezone)} · {upcomingCallUp.timezone}</Body>
          <Button label={t("Ver convocatoria")} onPress={() => router.navigate('/call-up')} />
        </> : !rosterLoading && !rosterError ? <Body>{t("Todavía no hay convocatorias.")}</Body> : null}
      </Card>
      {currentMembership?.role === 'admin' ? <Card title={t("Administrar el club")}>
          <Button secondary label={t("Editar información")} onPress={() => router.push('/club-info')} />
        <Button secondary label={t("Capitanes")} onPress={() => router.push('/club-settings')} />
        <Button secondary label={t("Historial de convocatorias")} onPress={() => router.push('/call-up-history')} />
        <Button secondary label={t("Crear convocatoria")} onPress={() => router.push('/create-call-up')} />
        <Button secondary label={t("Solicitudes pendientes")} onPress={() => router.push('/join-requests')} />
        <Button secondary label={t("Invitar jugadores")} onPress={() => router.push('/invitations')} />
      </Card> : null}
      <Button secondary label={t("Cambiar de club")} onPress={() => router.replace('/clubs')} />
      {isDemo ? <Body>{t("Estás explorando un club de ejemplo.")}</Body> : null}
    </Screen>
  );
}
