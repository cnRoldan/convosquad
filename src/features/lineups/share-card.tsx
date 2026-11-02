import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Image, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';
import { useAuth } from '@/features/auth/auth-context';
import { clubCrestCache } from '@/features/clubs/crest';
import { useResource } from '@/hooks/use-resource';
import type { Candidate, Lineup } from './model';

export function LineupShareCard({ clubName, crestPath, lineup, candidates, shirtColor, numberColor }: { clubName: string; crestPath?: string | null | undefined; lineup: Lineup; candidates: Candidate[]; shirtColor: string; numberColor: string }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const load = useCallback(() => crestPath && userId ? clubCrestCache.get(userId, crestPath) : Promise.resolve(null), [crestPath, userId]);
  const crest = useResource(`share-crest:${userId}:${crestPath}`, load, Boolean(crestPath && userId));
  return <View style={styles.card}>
    <LineupPoster clubName={clubName} crestUrl={crest.data ?? null} lineup={lineup} candidates={candidates} shirtColor={shirtColor} numberColor={numberColor} />
  </View>;
}

// All artwork and text share one coordinate system on every platform. Exporting
// the SVG directly on web avoids CSS/layout differences in DOM screenshot tools.
export function LineupPoster({ clubName, crestUrl, lineup, candidates, shirtColor, numberColor }: { clubName: string; crestUrl: string | null; lineup: Lineup; candidates: Candidate[]; shirtColor: string; numberColor: string }) {
  return <Svg width="100%" height="100%" viewBox="0 0 1324 1190">
    <Defs>
      <LinearGradient id="headerShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000" stopOpacity="0.7" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
      <LinearGradient id="fabricShade" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#000" stopOpacity="0.5" /><Stop offset="0.4" stopColor="#FFF" stopOpacity="0.12" /><Stop offset="0.7" stopColor="#000" stopOpacity="0" /><Stop offset="1" stopColor="#000" stopOpacity="0.45" /></LinearGradient>
    </Defs>
    <Image href={require('../../../assets/images/lineup-share-template.png')} x={0} y={0} width={1324} height={1190} preserveAspectRatio="xMidYMid slice" />
    <Rect x={30} y={20} width={1264} height={180} fill="url(#headerShade)" />
    {crestUrl ? <Image href={{ uri: crestUrl }} x={65} y={58} width={106} height={106} preserveAspectRatio="xMidYMid meet" /> : null}
    <Text x={crestUrl ? 192 : 68} y={85} fill="#BDFF43" fontFamily="Arial" fontSize={19} fontWeight="bold" letterSpacing={3}>ONCE TITULAR</Text>
    <Text x={crestUrl ? 192 : 68} y={140} fill="#FFFFFF" fontFamily="Arial" fontSize={clubName.length > 25 ? 32 : 44} fontWeight="bold">{clubName.toUpperCase()}</Text>
    <Text x={1250} y={95} textAnchor="end" fill="#FFFFFF" fontFamily="Arial" fontSize={22} fontWeight="bold">{lineup.formation}</Text>
    {lineup.slots.map(slot => {
      const player = candidates.find(candidate => candidate.id === slot.playerId);
      if (!player) return null;
      const depth = Math.max(0, Math.min(1, slot.y));
      const x = 662 + (slot.x - 0.5) * (850 + 300 * depth);
      const y = 340 + depth * 710;
      const scale = 0.85 + depth * 0.22;
      return <G key={slot.id} transform={`translate(${x} ${y}) scale(${scale})`}>
        <Path d="M-19-56-38-48-62-25-47 2-31-8-31 51h62V-8L47 2l15-27-24-23-19-8Z" fill={shirtColor} stroke="#101A14" strokeWidth={3} />
        <Path d="M-19-56-38-48-62-25-47 2-31-8-31 51h62V-8L47 2l15-27-24-23-19-8Z" fill="url(#fabricShade)" />
        <Path d="M-19-56q19 24 38 0" fill="#09120C" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={2} />
        <Text x={0} y={26} textAnchor="middle" fill={numberColor} fontFamily="Arial" fontSize={43} fontWeight="bold">{player.jerseyNumber ?? '—'}</Text>
        <Rect x={-93} y={60} width={186} height={34} rx={6} fill="#03100A" fillOpacity={0.85} />
        <Text x={0} y={84} textAnchor="middle" fill="#FFFFFF" fontFamily="Arial" fontSize={player.name.length > 17 ? 14 : player.name.length > 12 ? 17 : 21} fontWeight="bold">{player.name}</Text>
      </G>;
    })}
    <Text x={1245} y={1142} textAnchor="end" fill="#FFFFFF" fontFamily="Arial" fontSize={21} fontWeight="bold">Powered by ConvoSquad</Text>
  </Svg>;
}

const styles = StyleSheet.create({ card: { width: '100%', aspectRatio: 1324 / 1190, backgroundColor: '#041007' } });
