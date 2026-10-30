import { StyleSheet, Text, View } from 'react-native';
import type { Candidate } from './model';

export function PlayerToken({ player, emptyLabel = '+', compact = false }: { player?: Candidate | undefined; emptyLabel?: string; compact?: boolean }) {
  return <View style={[styles.container, compact && styles.compact]}>
    <View style={[styles.circle, !player && styles.empty]}>
      <Text style={styles.number}>{player ? player.jerseyNumber ?? '—' : emptyLabel}</Text>
    </View>
    {player ? <Text numberOfLines={2} style={styles.name}>{player.name}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: 80, alignItems: 'center', gap: 3 },
  compact: { width: 64 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#B4F16C', justifyContent: 'center', alignItems: 'center' },
  empty: { backgroundColor: '#A5AEA8' },
  number: { fontWeight: '700', color: '#0B1210', fontSize: 16 },
  name: { fontSize: 11, color: '#FFFFFF', textAlign: 'center', backgroundColor: '#14241C', borderRadius: 4, paddingHorizontal: 3 },
});
