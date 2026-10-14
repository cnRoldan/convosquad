import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { ReorderButtons } from '@/components/reorder-buttons';
import { colors } from '@/theme';

export function PlayerCard({ player, actions }: {
  player: { eaId: string; jerseyNumber: number | null; userId: string | null };
  actions?: { first: boolean; last: boolean; orderingDisabled: boolean; disabled: boolean; move: (direction: -1 | 1) => void; edit: () => void; remove: () => void };
}) {
  return <View style={styles.card}>
    <View style={styles.details}>
      <Text style={styles.name}>{player.eaId}</Text>
      <Text style={styles.meta}>{player.jerseyNumber === null ? 'Sin dorsal' : `Dorsal ${player.jerseyNumber}`} · {player.userId ? 'Registrado' : 'Sin registrar'}</Text>
    </View>
    {actions ? <View style={styles.actions}>
      <ReorderButtons label={player.eaId} first={actions.first} last={actions.last} disabled={actions.orderingDisabled || actions.disabled} move={actions.move} />
      <IconButton icon="edit" label={`Editar ${player.eaId}`} disabled={actions.disabled} onPress={actions.edit} />
      <IconButton icon="trash" label={`Quitar de la plantilla a ${player.eaId}`} danger disabled={actions.disabled} onPress={actions.remove} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  details: { flexBasis: 140, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
