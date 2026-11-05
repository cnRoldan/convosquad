import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { historicalRatingColor } from './historical-rating';
import { intlLocale, t } from '@/features/i18n/runtime';
import type { Candidate } from './model';

export function PlayerToken({ player, averageScore, warning = false, emptyLabel = '+', compact = false, color = '#B4F16C', jerseyColor = '#0B1210' }: { player?: Candidate | undefined; averageScore?: number | null | undefined; warning?: boolean; emptyLabel?: string; compact?: boolean; color?: string; jerseyColor?: string }) {
  return <View style={[styles.container, compact && styles.compact]}>
    <View style={[styles.circle, player ? { backgroundColor: color } : styles.empty]}>
      <Text style={[styles.number, { color: jerseyColor }]}>{player ? player.jerseyNumber ?? '—' : emptyLabel}</Text>
      {player && averageScore !== undefined ? <View accessible accessibilityLabel={averageScore === null ? t('Sin valoraciones históricas para {{v0}}', { v0: player.name }) : t('Media histórica de {{v0}}: {{v1}} de 10', { v0: player.name, v1: new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 }).format(averageScore) })} style={[styles.rating, { backgroundColor: historicalRatingColor(averageScore) }]}>
        <Text style={styles.ratingText}>{averageScore === null ? '—' : new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 }).format(averageScore)}</Text>
      </View> : null}
      {player && warning ? <View accessible accessibilityRole="image" accessibilityLabel={t('Incidencias vigentes')} style={styles.warning}>
        <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}><Path d="M12 2 23 22H1Z" fill="#FFD15C" stroke="#151B12" strokeWidth={1.5} /><Path d="M12 8v6m0 3v1" stroke="#151B12" strokeWidth={2.5} strokeLinecap="round" /></Svg>
      </View> : null}
    </View>
    {player ? <View style={styles.nameBadge}><Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>{player.name}</Text></View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: 80, alignItems: 'center', gap: 3 },
  compact: { width: 64 },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#B4F16C', justifyContent: 'center', alignItems: 'center' },
  empty: { backgroundColor: '#A5AEA8' },
  rating: { position: 'absolute', top: -7, right: -11, minWidth: 28, height: 18, paddingHorizontal: 3, borderRadius: 7, borderWidth: 1, borderColor: '#0B1210', alignItems: 'center', justifyContent: 'center' },
  ratingText: { color: '#0B1210', fontWeight: '800', fontSize: 10 },
  warning: { position: 'absolute', top: -7, left: -7, width: 20, height: 20 },
  number: { fontWeight: '700', color: '#0B1210', fontSize: 16 },
  nameBadge: { width: '100%', overflow: 'hidden', backgroundColor: 'rgba(6, 18, 12, 0.84)', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 },
  name: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', textShadowColor: '#06120C', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
});
