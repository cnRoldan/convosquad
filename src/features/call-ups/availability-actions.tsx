import { t, useLanguage } from '@/features/i18n/runtime';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { availabilityLabels, responseOptions } from './availability';
import { availabilityIcons, type CallUpPlayer } from './list-model';

const statusColors = { available: colors.primary, unavailable: colors.danger, backup: '#F2D478' };

export function AvailabilityActions({ player, disabled, feedback, onRespond }: {
  player: CallUpPlayer;
  disabled: boolean;
  feedback: { text: string; error: boolean } | null;
  onRespond: (id: string, availability: typeof responseOptions[number]) => void;
}) {
  useLanguage();
  return <View pointerEvents="box-none" style={styles.position}>
    <View style={styles.card} testID="availability-actions">
      <Text accessibilityLiveRegion="polite" style={[styles.status, feedback?.error && { color: colors.danger }]}>
        {t(feedback?.text ?? t("Tu disponibilidad: {{v0}}", { v0: t(availabilityLabels[player.availability]) }))}
      </Text>
      <View style={styles.buttons}>
        {responseOptions.map(status => <Pressable key={status} accessibilityRole="button"
          accessibilityLabel={t("{{v0}} para {{v1}}", { v0: t(availabilityLabels[status]), v1: player.eaId })}
          {...(Platform.OS === 'web' ? { 'aria-pressed': player.availability === status } : {})}
          aria-disabled={disabled} accessibilityState={{ selected: player.availability === status, disabled }} disabled={disabled}
          onPress={() => { if (!disabled && player.availability !== status) onRespond(player.id, status); }}
          style={({ pressed }) => [styles.button, player.availability === status && { borderColor: statusColors[status], backgroundColor: '#243622' }, (pressed || disabled) && { opacity: 0.6 }]}>
          <Text style={styles.icon}>{availabilityIcons[status]}</Text>
          <Text style={[styles.label, { color: statusColors[status] }]}>{t(availabilityLabels[status])}</Text>
        </Pressable>)}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  position: { padding: 12 },
  card: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 8, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, boxShadow: '0 4px 16px rgba(0,0,0,0.35)' },
  status: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minWidth: 0, minHeight: 58, gap: 4, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 17 },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
