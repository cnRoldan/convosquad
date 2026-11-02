import { goalkeeperNumberColor } from './kit-colors';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Image, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';
import type { Candidate, Lineup } from './model';
import { recognizeFormation } from './recognize-formation';

export function LineupShareCard(props: Parameters<typeof LineupPoster>[0]) {
  return <View style={styles.card}><LineupPoster {...props} /></View>;
}

// All artwork and text share one coordinate system on every platform. Exporting
// the SVG directly on web avoids CSS/layout differences in DOM screenshot tools.
export function LineupPoster({ clubName, crestUrl, lineup, candidates, shirtColor, numberColor, goalkeeperColor = '#F4A83A' }: { clubName: string; crestUrl: string | null; lineup: Lineup; candidates: Candidate[]; shirtColor: string; numberColor: string; goalkeeperColor?: string }) {
  return <Svg width="100%" height="100%" viewBox="0 0 1324 1190">
    <Defs>
      <LinearGradient id="headerShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000" stopOpacity="0.7" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
      <LinearGradient id="fabricShade" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#000" stopOpacity="0.5" /><Stop offset="0.4" stopColor="#FFF" stopOpacity="0.12" /><Stop offset="0.7" stopColor="#000" stopOpacity="0" /><Stop offset="1" stopColor="#000" stopOpacity="0.45" /></LinearGradient>
    </Defs>
    <Image href={require('../../../assets/images/lineup-share-template.png')} x={0} y={0} width={1324} height={1190} preserveAspectRatio="xMidYMid slice" />
    <Rect x={30} y={20} width={1264} height={180} fill="url(#headerShade)" />
    {crestUrl ? <G>
      <Rect x={56} y={49} width={124} height={124} rx={18} fill="#041007" fillOpacity={0.9} stroke="#BDFF43" strokeOpacity={0.35} />
      <Image href={{ uri: crestUrl }} x={65} y={58} width={106} height={106} preserveAspectRatio="xMidYMid meet" />
    </G> : null}
    <Text x={crestUrl ? 192 : 68} y={85} fill="#BDFF43" fontFamily="Arial" fontSize={19} fontWeight="bold" letterSpacing={3}>ONCE TITULAR</Text>
    <Text x={crestUrl ? 192 : 68} y={140} fill="#FFFFFF" fontFamily="Arial" fontSize={clubName.length > 25 ? 32 : 44} fontWeight="bold">{clubName.toUpperCase()}</Text>
    <Text x={1250} y={95} textAnchor="end" fill="#FFFFFF" fontFamily="Arial" fontSize={22} fontWeight="bold">{recognizeFormation(lineup.slots).formation}</Text>
    {lineup.slots.map(slot => {
      const player = candidates.find(candidate => candidate.id === slot.playerId);
      if (!player) return null;
      const depth = Math.max(0, Math.min(1, slot.y));
      const x = 662 + (slot.x - 0.5) * (850 + 300 * depth);
      const y = 340 + depth * 710 + (slot.id === 0 ? 24 : 0);
      const scale = 0.85 + depth * 0.22;
      const nameFontSize = player.name.length > 17 ? 14 : player.name.length > 12 ? 17 : 21;
      // Approximate Arial Bold glyph advances in SVG coordinates so short
      // names get a compact badge on both native and web exports.
      const nameWidth = 20 + Array.from(player.name).reduce((width, character) => {
        const advance = /[ilIjtfr.,' ]/.test(character) ? 0.32 : /[MW@%]/.test(character) ? 0.9 : /[A-Z0-9]/.test(character) ? 0.7 : 0.59;
        return width + advance * nameFontSize;
      }, 0);
      return <G key={slot.id} transform={`translate(${x} ${y}) scale(${scale})`}>
        <Path d="M-19-56-38-48-62-25-47 2-31-8-31 51h62V-8L47 2l15-27-24-23-19-8Z" fill={slot.id === 0 ? goalkeeperColor : shirtColor} stroke="#101A14" strokeWidth={3} />
        <Path d="M-19-56-38-48-62-25-47 2-31-8-31 51h62V-8L47 2l15-27-24-23-19-8Z" fill="url(#fabricShade)" />
        <Path d="M-19-56q19 24 38 0" fill="#09120C" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={2} />
        <Text x={0} y={19} textAnchor="middle" fill={slot.id === 0 ? goalkeeperNumberColor(goalkeeperColor) : numberColor} fontFamily="Arial" fontSize={43} fontWeight="bold">{player.jerseyNumber ?? '—'}</Text>
        <Rect x={-nameWidth / 2} y={60} width={nameWidth} height={34} rx={6} fill="#03100A" fillOpacity={0.85} />
        <Text x={0} y={84} textAnchor="middle" fill="#FFFFFF" fontFamily="Arial" fontSize={nameFontSize} fontWeight="bold">{player.name}</Text>
      </G>;
    })}
    <Rect x={896} y={1092} width={337} height={66} rx={14} fill="#041007" fillOpacity={0.97} stroke="#BDFF43" strokeOpacity={0.3} />
    <Text x={910} y={1133} fill="#FFFFFF" fontFamily="Arial" fontSize={14}>Powered by</Text>
    <Image href={require('../../../assets/images/icon.png')} x={987} y={1096} width={58} height={58} preserveAspectRatio="xMidYMid meet" />
    <Text x={1037} y={1136} fill="#FFFFFF" fontFamily="Arial" fontSize={28} fontWeight="bold">ConvoSquad</Text>
  </Svg>;
}

const styles = StyleSheet.create({ card: { width: '100%', aspectRatio: 1324 / 1190, backgroundColor: '#041007' } });
