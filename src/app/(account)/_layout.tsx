import { t, useLanguage } from '@/features/i18n/runtime';
import { Stack } from 'expo-router';
import { AuthAccess } from '@/components/access';

export default function AccountLayout() {
  useLanguage();
  return <AuthAccess><Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
    <Stack.Screen name="change-password" options={{ title: t("Cambiar mi contraseña") }} />
    <Stack.Screen name="notifications" options={{ title: t("Notificaciones") }} />
    <Stack.Screen name="create-club" options={{ title: t("Crear club") }} />
    <Stack.Screen name="search-clubs" options={{ title: t("Buscar clubes") }} />
    <Stack.Screen name="my-requests" options={{ title: t("Mis solicitudes") }} />
  </Stack></AuthAccess>;
}
