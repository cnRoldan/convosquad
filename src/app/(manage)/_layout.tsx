import { t, useLanguage } from '@/features/i18n/runtime';
import { headerBackOptions } from '@/components/header-back-options';
import { router, Stack } from 'expo-router';
import { ClubAccess } from '@/components/access';

export default function ManageLayout() {
  useLanguage();
  return <ClubAccess admin><Stack screenOptions={{ ...headerBackOptions(() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }, t('Volver')), headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
    <Stack.Screen name="club-info" options={{ title: t("Editar información") }} />
    <Stack.Screen name="club-settings" options={{ title: t("Capitanes") }} />
    <Stack.Screen name="call-up-history" options={{ title: t("Historial de convocatorias") }} />
    <Stack.Screen name="call-up-ratings" options={{ title: t("Valorar jugadores") }} />
    <Stack.Screen name="call-up-player-totals" options={{ title: t("Total por jugador") }} />
    <Stack.Screen name="trial-history" options={{ title: t("Historial de pruebas") }} />
    <Stack.Screen name="create-call-up" options={{ title: t("Crear convocatoria") }} />
    <Stack.Screen name="trials/[id]" options={{ title: t("Pruebas") }} />
    <Stack.Screen name="inactive-players" options={{ title: t("Jugadores inactivos") }} />
    <Stack.Screen name="players/new" options={{ title: t("Añadir jugador") }} />
    <Stack.Screen name="players/[id]" options={{ title: t("Editar jugador") }} />
    <Stack.Screen name="roster-import" options={{ title: t("Importar plantilla") }} />
    <Stack.Screen name="join-requests" options={{ title: t("Solicitudes pendientes") }} />
    <Stack.Screen name="invitations" options={{ title: t("Invitaciones") }} />
  </Stack></ClubAccess>;
}
