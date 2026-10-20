import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, styles } from './ui';
import { intlLocale, t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';

export type DateTimeFieldProps = { label: string; value: string; mode: 'date' | 'time'; onChange: (value: string) => void; disabled?: boolean };
const pad = (value: number) => String(value).padStart(2, '0');
// Calendar values are wall-clock components in the club's timezone, not instants in the device timezone.
export function DateTimeField({ label, value, mode, onChange, disabled = false }: DateTimeFieldProps) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [first = 2000, second = 1, third = 1] = value.split(mode === 'date' ? '-' : ':').map(Number);
  const selected = mode === 'date' ? new Date(first, second - 1, third, 12) : new Date(2000, 0, 1, first, second);
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: open }} disabled={disabled}
      style={[styles.input, { justifyContent: 'center' }]} onPress={() => setOpen(true)}>
      <Text style={{ color: colors.text, fontSize: 16 }}>{mode === 'date' ? selected.toLocaleDateString(intlLocale()) : value}</Text>
    </Pressable>
    {open && !disabled ? <>
      <DateTimePicker value={selected} mode={mode} display={Platform.OS === 'ios' ? mode === 'date' ? 'inline' : 'spinner' : 'default'}
        is24Hour locale={intlLocale()} themeVariant="dark" onChange={(event, date) => {
          if (Platform.OS === 'android') setOpen(false);
          if (event.type === 'dismissed' || !date) return;
          onChange(mode === 'date' ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : `${pad(date.getHours())}:${pad(date.getMinutes())}`);
        }} />
      {Platform.OS === 'ios' ? <Button secondary label={t('Cerrar')} onPress={() => setOpen(false)} /> : null}
    </> : null}
  </View>;
}
