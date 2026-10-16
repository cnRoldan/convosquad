import { t, useLanguage } from '@/features/i18n/runtime';
import { ActivityIndicator } from 'react-native';
import { Body, Screen } from './ui';
import { colors } from '@/theme';

export function LoadingScreen({ label = t("Cargando…") }: { label?: string }) {
  useLanguage();
  return <Screen><ActivityIndicator accessibilityLabel={label} color={colors.primary} /><Body>{label}</Body></Screen>;
}
