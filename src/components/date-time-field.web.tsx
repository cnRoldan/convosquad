import { Text, View } from 'react-native';
import { styles } from './ui';
import { colors } from '@/theme';
import type { DateTimeFieldProps } from './date-time-field';

export function DateTimeField({ label, value, mode, onChange, disabled = false }: DateTimeFieldProps) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <input aria-label={label} type={mode} value={value} disabled={disabled} onChange={event => { if (event.target.value) onChange(event.target.value); }}
      style={{ colorScheme: 'dark', boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 52, padding: 16, borderRadius: 14, border: `1px solid ${colors.border}`, color: colors.text, backgroundColor: colors.surface, fontSize: 16, fontFamily: 'inherit' }} />
  </View>;
}
