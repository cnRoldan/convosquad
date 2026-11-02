import { t, useLanguage } from '@/features/i18n/runtime';
import { Tabs } from 'expo-router/js-tabs';
import { NavigationIcon } from '@/components/navigation-icon';
import { ClubAccess } from '@/components/access';
import { headerBackOptions } from '@/components/header-back-options';
import { router } from 'expo-router';
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
      <Tabs.Screen name="home" options={{ title: t("Inicio"), tabBarAccessibilityLabel: t("Inicio"), tabBarIcon: ({ color }) => <NavigationIcon name="house" color={color} /> }} />
      <Tabs.Screen name="roster" options={{ title: t("Plantilla"), tabBarAccessibilityLabel: t("Plantilla"), tabBarIcon: ({ color }) => <NavigationIcon name="shirt" color={color} /> }} />
      <Tabs.Screen name="call-up" options={{ title: t("Convocatoria"), tabBarAccessibilityLabel: t("Convocatoria"), tabBarIcon: ({ color }) => <NavigationIcon name="user-round-check" color={color} /> }} />
      <Tabs.Screen name="lineup" options={{
        href: null,
        title: t('Elige la formación'),
        headerShown: true,
        headerShadowVisible: false,
        ...headerBackOptions(() => {
          if (router.canGoBack()) router.back();
          else router.replace('/call-up');
        }, t('Convocatoria actual')),
      }} />
      <Tabs.Screen name="premium" options={{ href: null }} />
    </Tabs>
  </ClubAccess>;
}
