import { t, useLanguage } from '@/features/i18n/runtime';
import { headerBackOptions } from '@/components/header-back-options';
import { router, Stack } from 'expo-router';
import { AuthAccess } from '@/components/access';

export default function AccountLayout() {
  useLanguage();
  return <AuthAccess><Stack screenOptions={{ ...headerBackOptions(() => { if (router.canGoBack()) router.back(); else router.replace('/clubs'); }, t('Volver')), headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
    <Stack.Screen name="performance" options={{ title: t("Valoraciones y rendimiento"), ...headerBackOptions(() => router.dismissTo('/home'), t("Volver al club")) }} />
    <Stack.Screen name="change-password" options={{ title: t("Cambiar mi contraseña") }} />
    <Stack.Screen name="notifications" options={{ title: t("Notificaciones") }} />
    <Stack.Screen name="create-club" options={{ title: t("Crear club") }} />
    <Stack.Screen name="search-clubs" options={{ title: t("Buscar clubes") }} />
    <Stack.Screen name="my-requests" options={{ title: t("Mis solicitudes") }} />
  </Stack></AuthAccess>;
}
