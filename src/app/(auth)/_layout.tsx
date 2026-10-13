import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="login" options={{ title: 'Iniciar sesión' }} />
    <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
    <Stack.Screen name="recover" options={{ title: "Recuperar acceso" }} />
    <Stack.Screen name="reset-password" options={{ title: "Nueva contraseña" }} />
  </Stack>;
}
