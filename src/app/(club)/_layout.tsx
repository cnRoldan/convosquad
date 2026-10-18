import { t, useLanguage } from '@/features/i18n/runtime';
import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { ClubAccess } from '@/components/access';
import { colors } from '@/theme';

export default function ClubLayout() {
  useLanguage();
  return <ClubAccess>
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    }}>
      <Tabs.Screen name="performance" options={{ title: t("Valoraciones y rendimiento"), href: null }} />
      <Tabs.Screen name="home" options={{ title: t("Inicio"), tabBarAccessibilityLabel: t("Inicio"), tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⌂</Text> }} />
      <Tabs.Screen name="roster" options={{ title: t("Plantilla"), tabBarAccessibilityLabel: t("Plantilla"), tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>♟</Text> }} />
      <Tabs.Screen name="call-up" options={{ title: t("Convocatoria"), tabBarAccessibilityLabel: t("Convocatoria"), tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>▣</Text> }} />
    </Tabs>
  </ClubAccess>;
}
