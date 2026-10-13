import { Stack } from 'expo-router';
import { ClubAccess } from '@/components/access';

export default function ManageLayout() {
  return <ClubAccess admin><Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }}>
    <Stack.Screen name="players/new" options={{ title: 'Añadir jugador' }} />
    <Stack.Screen name="players/[id]" options={{ title: 'Editar jugador' }} />
    <Stack.Screen name="roster-import" options={{ title: 'Importar plantilla' }} />
    <Stack.Screen name="join-requests" options={{ title: 'Solicitudes pendientes' }} />
    <Stack.Screen name="invitations" options={{ title: 'Invitaciones' }} />
  </Stack></ClubAccess>;
}
