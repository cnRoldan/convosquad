import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function CompactPanel({ title, summary, expanded, onToggle, children, subtle = false }: PropsWithChildren<{
  title: string; summary?: string; expanded: boolean; onToggle: () => void; subtle?: boolean;
}>) {
  return <View style={[styles.panel, subtle && styles.subtle]}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={summary}
      aria-expanded={expanded} accessibilityState={{ expanded }} onPress={onToggle} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
      <View style={styles.titles}>
        <Text style={[styles.title, subtle && styles.muted]}>{title}</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      </View>
      <Text accessible={false} style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    <View style={[styles.body, !expanded && styles.hidden]} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>{children}</View>
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' },
  subtle: { backgroundColor: colors.background },
  header: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  titles: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  summary: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  muted: { color: colors.muted }, chevron: { color: colors.primary, fontSize: 22 },
  body: { paddingHorizontal: 12, paddingBottom: 6 }, hidden: { display: 'none' }, pressed: { opacity: 0.7 },
});
