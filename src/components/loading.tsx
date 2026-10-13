import { ActivityIndicator } from 'react-native';
import { Body, Screen } from './ui';
import { colors } from '@/theme';

export function LoadingScreen({ label = 'Cargando…' }: { label?: string }) {
  return <Screen><ActivityIndicator accessibilityLabel={label} color={colors.primary} /><Body>{label}</Body></Screen>;
}
