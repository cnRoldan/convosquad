import { t, useLanguage } from '@/features/i18n/runtime';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { formatMatchDate } from '@/lib/format';
import { callUpStatusLabel } from '@/features/call-ups/lifecycle';
import { clubLocalDateTime } from '@/features/call-ups/local-time';
import { useCallUpSync } from '@/features/call-ups/use-call-up-sync';

export default function HomeScreen() {
  useLanguage();
  const { isDemo, session } = useAuth();
  const pathname = usePathname();
  const [clock, setClock] = useState(Date.now);
  const { activeClub, currentMembership, roster, upcomingCallUp, hasCurrentCallUp, rosterLoading, rosterError, refreshRoster, notice } = useClub();
  useFocusEffect(useCallback(() => { refreshRoster(); }, [refreshRoster]));
  useCallUpSync(`home:${session?.user.id}:${activeClub?.id}`, activeClub?.id, Boolean(session && activeClub && !isDemo && pathname === '/home'), refreshRoster);
  useEffect(() => {
    if (pathname !== '/home') return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pathname]);
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
          <Body>{t(callUpStatusLabel({ status: upcomingCallUp.status ?? 'open', closes_at: upcomingCallUp.closesAt ?? null, ends_at: upcomingCallUp.endsAt ?? null,
            local_date: clubLocalDateTime(upcomingCallUp.timezone, new Date(upcomingCallUp.startsAt)).date, timezone: upcomingCallUp.timezone }, clock))}</Body>
          <Button label={t("Ver convocatoria")} onPress={() => router.navigate({ pathname: '/call-up', params: { id: upcomingCallUp.id } })} />
        </> : !rosterLoading && !rosterError ? <Body>{t("Todavía no hay convocatorias.")}</Body> : null}
      </Card>
      {currentMembership?.role !== 'admin' && (activeClub?.ratingsVisibility === 'members' || activeClub?.ratingsVisibility === 'self') ? <Card title={t("Valoraciones y rendimiento")}><Button secondary label={t("Ver rendimiento del club")} onPress={() => router.navigate('/performance')} /></Card> : null}
      {currentMembership?.role === 'admin' ? <Card title={t("Administrar el club")}>
          <Button secondary label={t("Editar información")} onPress={() => router.push('/club-info')} />
        <Button secondary label={t("Capitanes")} onPress={() => router.push('/club-settings')} />
        <Button secondary label={t("Valoraciones y rendimiento")} onPress={() => router.navigate('/performance')} />
        <Button secondary label={t("Historial de convocatorias")} onPress={() => router.push('/call-up-history')} />
        {!hasCurrentCallUp && !rosterLoading && !rosterError ? <Button secondary label={t("Crear convocatoria")} onPress={() => router.push('/create-call-up')} /> : null}
        <Button secondary label={t("Solicitudes pendientes")} onPress={() => router.push('/join-requests')} />
        <Button secondary label={t("Invitar jugadores")} onPress={() => router.push('/invitations')} />
      </Card> : null}
      <Button secondary label={t("Cambiar de club")} onPress={() => router.replace('/clubs')} />
      {isDemo ? <Body>{t("Estás explorando un club de ejemplo.")}</Body> : null}
    </Screen>
  );
}
