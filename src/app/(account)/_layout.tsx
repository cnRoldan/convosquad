import { Stack } from 'expo-router';
import { AuthAccess } from '@/components/access';

export default function AccountLayout() {
  return <AuthAccess><Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
    <Stack.Screen name="create-club" options={{ title: 'Crear club' }} />
    <Stack.Screen name="search-clubs" options={{ title: 'Buscar clubes' }} />
    <Stack.Screen name="my-requests" options={{ title: 'Mis solicitudes' }} />
  </Stack></AuthAccess>;
}
