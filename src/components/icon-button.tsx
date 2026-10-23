import { Platform, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

const paths = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  restart: 'M3 4v7h7M3 11a9 9 0 119 10M12 7v5l3 2',
  back: 'M19 12H5M12 19l-7-7 7-7',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  edit: 'M16 3l5 5M4 16L16 4a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  play: 'M8 5l11 7-11 7V5z',
  lock: 'M6 10h12v11H6V10zM8 10V6a4 4 0 018 0v4',
  cancel: 'M6 6l12 12M6 18L18 6',
  history: 'M3 11a9 9 0 119 10M3 4v7h7M12 7v5l3 2',
  info: 'M12 17v-6M12 7h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  refresh: 'M3 11a9 9 0 0115-6l3 3M21 3v5h-5M21 13a9 9 0 01-15 6l-3-3M3 21v-5h5',
  save: 'M4 3h13l4 4v14H3V3h1zM7 3v6h10V3M7 21v-8h10v8',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
} as const;

export function IconButton({ icon, label, onPress, disabled = false, danger = false, variant = 'outlined' }: {
  icon: keyof typeof paths;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  variant?: 'outlined' | 'plain';
}) {
  const whatsapp = icon === 'whatsapp';
  const color = disabled ? colors.muted : whatsapp ? '#25D366' : danger ? colors.danger : colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, whatsapp && styles.whatsapp, variant === 'plain' && styles.plain, (pressed || disabled) && styles.dimmed]}>
    <Svg width={whatsapp ? 24 : 20} height={whatsapp ? 24 : 20} viewBox="0 0 24 24" fill={whatsapp ? color : 'none'} stroke={whatsapp ? 'none' : color}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false, accessibilityElementsHidden: true })}>
      <Path d={paths[icon]} />
    </Svg>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  whatsapp: { borderColor: '#28583b', backgroundColor: '#10291c' },
  plain: { borderWidth: 0, backgroundColor: 'transparent' },
  dimmed: { opacity: 0.45 },
});
