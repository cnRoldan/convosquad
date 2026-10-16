import { Platform, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

const paths = {
  whatsapp: 'M21 11.5a8.5 8.5 0 01-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1121 11.5zM8 7c-.8 0-1 1.2-.7 2.4.7 2.6 2.7 4.6 5.3 5.3 1.2.3 2.4.1 2.4-.7v-1l-2-1-1 1c-1.6-.6-2.7-1.7-3.3-3.3l1-1-1-2H8z',
  restart: 'M3 4v7h7M3 11a9 9 0 119 10M12 7v5l3 2',
  back: 'M19 12H5M12 19l-7-7 7-7',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  edit: 'M16 3l5 5M4 16L16 4a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  play: 'M8 5l11 7-11 7V5z',
  lock: 'M6 10h12v11H6V10zM8 10V6a4 4 0 018 0v4',
  cancel: 'M6 6l12 12M6 18L18 6',
  history: 'M3 11a9 9 0 119 10M3 4v7h7M12 7v5l3 2',
  refresh: 'M3 11a9 9 0 0115-6l3 3M21 3v5h-5M21 13a9 9 0 01-15 6l-3-3M3 21v-5h5',
  save: 'M4 3h13l4 4v14H3V3h1zM7 3v6h10V3M7 21v-8h10v8',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
} as const;

export function IconButton({ icon, label, onPress, disabled = false, danger = false }: {
  icon: keyof typeof paths;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}>
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={disabled ? colors.muted : danger ? colors.danger : colors.primary}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false, accessibilityElementsHidden: true })}>
      <Path d={paths[icon]} />
    </Svg>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dimmed: { opacity: 0.45 },
});
