import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

const paths = {
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  edit: 'M16 3l5 5M4 16L16 4a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
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
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false} aria-hidden>
      <Path d={paths[icon]} />
    </Svg>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dimmed: { opacity: 0.45 },
});
