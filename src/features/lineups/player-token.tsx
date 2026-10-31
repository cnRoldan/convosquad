import { StyleSheet, Text, View } from 'react-native';
import type { Candidate } from './model';

export function PlayerToken({ player, emptyLabel = '+', compact = false, color = '#B4F16C', jerseyColor = '#0B1210' }: { player?: Candidate | undefined; emptyLabel?: string; compact?: boolean; color?: string; jerseyColor?: string }) {
  return <View style={[styles.container, compact && styles.compact]}>
    <View style={[styles.circle, player ? { backgroundColor: color } : styles.empty]}>
      <Text style={[styles.number, { color: jerseyColor }]}>{player ? player.jerseyNumber ?? '—' : emptyLabel}</Text>
    </View>
    {player ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>{player.name}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: 80, alignItems: 'center', gap: 3 },
  compact: { width: 64 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#B4F16C', justifyContent: 'center', alignItems: 'center' },
  empty: { backgroundColor: '#A5AEA8' },
  number: { fontWeight: '700', color: '#0B1210', fontSize: 16 },
  name: { width: '100%', fontSize: 11, fontWeight: '700', color: '#0B1210', textAlign: 'center', backgroundColor: '#F1F8EC', borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1 },
});
