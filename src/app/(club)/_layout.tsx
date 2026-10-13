import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';

import { useClub } from '@/features/clubs/club-context';
import { colors } from '@/theme';

export default function ClubLayout() {
  const { activeClub } = useClub();
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
