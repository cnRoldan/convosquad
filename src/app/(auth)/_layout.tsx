import { t, useLanguage } from '@/features/i18n/runtime';
import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AuthLayout() {
  useLanguage();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="login" options={{ title: t("Iniciar sesión") }} />
    <Stack.Screen name="register" options={{ title: t("Crear cuenta") }} />
    <Stack.Screen name="recover" options={{ title: t("Recuperar acceso") }} />
    <Stack.Screen name="reset-password" options={{ title: t("Nueva contraseña") }} />
  </Stack>;
}
