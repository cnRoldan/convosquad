import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import type { RatingChoice } from './service';

export function RatingSelector({ playerName, value, disabled, onChange }: {
  playerName: string; value: RatingChoice; disabled: boolean; onChange: (value: RatingChoice) => void;
}) {
  useLanguage();
  const { width } = useWindowDimensions();
  const unselected = value === 'not_selected';
  return <View accessibilityLabel={t('Valoración de {{v0}}', { v0: playerName })} style={{ gap: 10 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 6, paddingBottom: 6 }}>
      {Array.from({ length: 11 }, (_, score) => {
        const selected = value === String(score);
        return <Pressable key={score} accessibilityRole="radio" accessibilityLabel={t('Nota {{v0}} para {{v1}}', { v0: String(score), v1: playerName })}
          aria-checked={selected} aria-disabled={disabled} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => onChange(String(score) as RatingChoice)}
          style={({ pressed }) => [styles.score, selected && styles.selected, (disabled || pressed) && styles.dimmed]}>
          <Text style={[styles.text, selected && styles.selectedText]}>{score}</Text>
        </Pressable>;
      })}
    </ScrollView>
    {width < 640 ? <Text style={{ color: colors.muted, fontSize: 12 }}>{t('Desliza para ver todas las notas.')}</Text> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="radio" accessibilityLabel={t('Sin valorar: {{v0}}', { v0: playerName })}
        aria-checked={value === ''} aria-disabled={disabled} accessibilityState={{ checked: value === '', disabled }} disabled={disabled} onPress={() => onChange('')}
        style={({ pressed }) => [styles.clear, value === '' && styles.selected, (disabled || pressed) && styles.dimmed]}>
        <Text style={[styles.text, value === '' && styles.selectedText]}>{t('Sin valorar')}</Text>
      </Pressable>
      <View style={[styles.excluded, unselected && { borderColor: colors.danger }]}>
        <IconButton icon="trash" danger variant="plain" label={t('No alineado: {{v0}}', { v0: playerName })} disabled={disabled} onPress={() => onChange('not_selected')} />
      </View>
    </View>
    {unselected ? <Text style={{ color: colors.danger }}>{t('No alineado')}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  score: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  clear: { flex: 1, minHeight: 44, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { color: colors.text, fontSize: 16, fontWeight: '700' },
  selectedText: { color: colors.background },
  excluded: { borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  dimmed: { opacity: 0.5 },
});
