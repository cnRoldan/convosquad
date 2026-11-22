import { t, useLanguage } from '@/features/i18n/runtime';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { ReorderButtons } from '@/components/reorder-buttons';
import { jerseyAccessibilityLabel, jerseyLabel } from './jersey';
import type { ReactNode } from 'react';
import { colors } from '@/theme';

export function PlayerCard({ player, actions, notificationBadge }: {
  player: { eaId: string; jerseyNumber: number | null; userId: string | null };
  notificationBadge?: ReactNode;
  actions?: { first: boolean; last: boolean; orderingDisabled: boolean; disabled: boolean; move: (direction: -1 | 1) => void; edit: () => void; remove: () => void };
}) {
  useLanguage();
  return <View style={styles.card}>
    <View style={styles.details}>
      <View style={styles.nameRow}><Text style={styles.name}>{player.eaId}</Text>{notificationBadge}</View>
      <Text style={styles.meta}><Text accessibilityLabel={jerseyAccessibilityLabel(player.jerseyNumber)}>{jerseyLabel(player.jerseyNumber)}</Text> · {player.userId ? t("Registrado") : t("Sin registrar")}</Text>
    </View>
    {actions ? <View style={styles.actions}>
      <ReorderButtons label={player.eaId} first={actions.first} last={actions.last} disabled={actions.orderingDisabled || actions.disabled} move={actions.move} />
      <IconButton icon="edit" label={t("Editar {{v0}}", { v0: player.eaId })} disabled={actions.disabled} onPress={actions.edit} />
      <IconButton icon="trash" label={t("Quitar de la plantilla a {{v0}}", { v0: player.eaId })} danger disabled={actions.disabled} onPress={actions.remove} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'column', alignItems: 'stretch', gap: 12, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  details: { minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
