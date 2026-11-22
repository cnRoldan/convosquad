import { Pressable, StyleSheet, Text, View } from 'react-native';
import { weeklyDays } from './recurrence';
import { intlLocale, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';

export function WeekdaySelector({ value, onChange, disabled = false }: { value: number[]; onChange: (days: number[]) => void; disabled?: boolean }) {
  useLanguage();
  return <View style={styles.days}>
    {weeklyDays(intlLocale()).map(day => <Pressable key={day.value} accessibilityRole="checkbox" aria-checked={value.includes(day.value)} accessibilityLabel={day.name}
      accessibilityState={{ checked: value.includes(day.value), disabled }} disabled={disabled}
      onPress={() => onChange(value.includes(day.value) ? value.filter(item => item !== day.value) : [...value, day.value].sort((a, b) => a - b))}
      style={[styles.day, value.includes(day.value) && styles.selected, disabled && { opacity: 0.5 }]}>
      <Text style={[styles.label, value.includes(day.value) && styles.selectedLabel]}>{day.label}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  days: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, minWidth: 30, minHeight: 44, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontSize: 12, fontWeight: '700' },
  selectedLabel: { color: colors.background },
});
