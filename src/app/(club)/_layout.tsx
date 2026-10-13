import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';

import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { Body, Button, Heading, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function ClubLayout() {
  const { activeClub, isLoading, error, refresh } = useClub();
  const { session, isDemo } = useAuth();
  if (isLoading) return <Screen><Body>Cargando el club…</Body></Screen>;
  if (!session && !isDemo) return <Redirect href="/login" />;
  if (error) return <Screen>
    <Heading title="No se pudieron cargar los datos" />
    <Body>{error}</Body>
    <Button label="Reintentar" onPress={refresh} />
    <Button secondary label="Volver a mis clubes" onPress={() => router.replace('/clubs')} />
  </Screen>;
  if (!activeClub) return <Redirect href="/clubs" />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Inicio', tabBarAccessibilityLabel: 'Inicio', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⌂</Text> }} />
      <Tabs.Screen name="roster" options={{ title: 'Plantilla', tabBarAccessibilityLabel: 'Plantilla', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>♟</Text> }} />
      <Tabs.Screen name="call-up" options={{ title: 'Convocatoria', tabBarAccessibilityLabel: 'Convocatoria', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>▣</Text> }} />
    </Tabs>
  );
}
