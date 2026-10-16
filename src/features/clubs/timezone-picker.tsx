import { t, useLanguage } from '@/features/i18n/runtime';
import { Picker } from '@react-native-picker/picker';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Body, styles as uiStyles } from '@/components/ui';
import { colors } from '@/theme';
import { clubTimezones, isClubTimezone, timezoneLabel } from './timezones';
export function TimezonePicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  useLanguage();
  const today = new Date();
  return <View style={uiStyles.field}>
    <Text style={uiStyles.fieldLabel}>{t("Zona horaria")}</Text>
    <View style={styles.container}>
      <Picker accessibilityLabel={t("Zona horaria")} selectedValue={value} enabled={!disabled} dropdownIconColor={colors.primary}
        style={styles.picker} itemStyle={styles.item} onValueChange={next => { if (typeof next === 'string' && isClubTimezone(next)) onChange(next); }}>
        {!isClubTimezone(value) ? <Picker.Item value={value} label={timezoneLabel({ value, label: t("Zona actual") }, today)} color={colors.text} /> : null}
        {clubTimezones.map(zone => <Picker.Item key={zone.value} value={zone.value} label={timezoneLabel(zone, today)} color={colors.text} style={styles.item} />)}
      </Picker>
    </View>
    <Body>{t("La hora se ajusta automáticamente en verano e invierno.")}</Body>
  </View>;
}
const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' },
  picker: { width: '100%', color: colors.text, backgroundColor: colors.surface, minHeight: 52, ...(Platform.OS === 'ios' ? { height: 180 } : {}) },
  item: { color: colors.text, backgroundColor: colors.surface, fontSize: 14 },
});
