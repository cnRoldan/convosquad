import { goalkeeperNumberColor } from './kit-colors';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';
import type { Candidate, Lineup } from './model';
import { recognizeFormation } from './recognize-formation';
import { posterPlayers } from './poster-layout';
import { posterGeometry } from './poster-geometry';
import type { PosterAsset } from './poster-readiness';

export function LineupShareCard(props: Parameters<typeof LineupPoster>[0]) {
  return <View style={styles.card} onLayout={event => { if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) props.onAssetLoad?.('layout'); }}><LineupPoster {...props} /></View>;
}

// All artwork and text share one coordinate system on every platform. Exporting
// the SVG directly on web avoids CSS/layout differences in DOM screenshot tools.
export function LineupPoster({ clubName, crestUrl, lineup, candidates, shirtColor, numberColor, goalkeeperColor = '#F4A83A', onAssetLoad }: { clubName: string; crestUrl: string | null; lineup: Lineup; candidates: Candidate[]; shirtColor: string; numberColor: string; goalkeeperColor?: string; onAssetLoad?: (asset: PosterAsset) => void }) {
  const g = posterGeometry;
  const backgroundScale = g.backgroundHeight / (g.sourceHeight - g.backgroundSourceTop);
  return <Svg width="100%" height="100%" viewBox={`0 0 ${g.width} ${g.height}`}>
    <Defs>
      <ClipPath id="stadiumCrop"><Rect x={12} y={180} width={1300} height={1350} /></ClipPath>
      <LinearGradient id="headerShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000" stopOpacity="0.7" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
      <LinearGradient id="fabricShade" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#000" stopOpacity="0.5" /><Stop offset="0.4" stopColor="#FFF" stopOpacity="0.12" /><Stop offset="0.7" stopColor="#000" stopOpacity="0" /><Stop offset="1" stopColor="#000" stopOpacity="0.45" /></LinearGradient>
    </Defs>
    <Rect width={g.width} height={g.height} fill="#041007" />
    <G clipPath="url(#stadiumCrop)">
      <Image href={require('../../../assets/images/lineup-share-template.png')} x={0} y={g.backgroundTop - g.backgroundSourceTop * backgroundScale} width={g.width} height={g.sourceHeight * backgroundScale} preserveAspectRatio="none" onLoad={() => onAssetLoad?.('background')} />
    </G>
    <Rect x={8} y={8} width={g.width - 16} height={g.height - 16} fill="none" stroke="#BDFF43" strokeWidth={2} />
    <Path d="M10 104 104 10h36L10 140ZM1314 104 1220 10h-36l130 130Z" fill="#BDFF43" />
    <Rect x={30} y={20} width={1264} height={180} fill="url(#headerShade)" />
    {crestUrl ? <G>
      <Rect x={56} y={49} width={124} height={124} rx={18} fill="#041007" fillOpacity={0.9} stroke="#BDFF43" strokeOpacity={0.35} />
      <Image href={crestUrl} x={65} y={58} width={106} height={106} preserveAspectRatio="xMidYMid meet" onLoad={() => onAssetLoad?.('crest')} />
    </G> : null}
    <Text x={crestUrl ? 192 : 68} y={85} fill="#BDFF43" fontFamily="Arial" fontSize={19} fontWeight="bold" letterSpacing={3}>ONCE TITULAR</Text>
    <Text x={crestUrl ? 192 : 68} y={140} fill="#FFFFFF" fontFamily="Arial" fontSize={clubName.length > 25 ? 32 : 44} fontWeight="bold">{clubName.toUpperCase()}</Text>
    <Text x={1250} y={95} textAnchor="end" fill="#FFFFFF" fontFamily="Arial" fontSize={22} fontWeight="bold">{recognizeFormation(lineup.slots).formation}</Text>
    {posterPlayers(lineup, candidates).map(({ slot, player, x, y, scale, fontSize: nameFontSize, nameWidth }) => {
      return <G key={slot.id} transform={`translate(${x} ${y}) scale(${scale})`}>
        <G scale={0.8}>
          <Path d="M-19-56-38-48-62-25-47 2-31-8-31 51h62V-8L47 2l15-27-24-23-19-8Z" fill={slot.id === 0 ? goalkeeperColor : shirtColor} stroke="#101A14" strokeWidth={3} />
          <Path d="M-19-56-38-48-62-25-47 2-31-8-31 51h62V-8L47 2l15-27-24-23-19-8Z" fill="url(#fabricShade)" />
          <Path d="M-19-56q19 24 38 0" fill="#09120C" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={2} />
          <Text x={0} y={19} textAnchor="middle" fill={slot.id === 0 ? goalkeeperNumberColor(goalkeeperColor) : numberColor} fontFamily="Arial" fontSize={43} fontWeight="bold">{player.jerseyNumber ?? '—'}</Text>
        </G>
        <Rect x={-nameWidth / 2} y={44} width={nameWidth} height={34} rx={6} fill="#03100A" fillOpacity={0.85} />
        <Text x={0} y={68} textAnchor="middle" fill="#FFFFFF" fontFamily="Arial" fontSize={nameFontSize} fontWeight="bold">{player.name}</Text>
      </G>;
    })}
    <Rect x={896} y={g.height - 98} width={337} height={66} rx={14} fill="#041007" fillOpacity={0.97} stroke="#BDFF43" strokeOpacity={0.3} />
    <Text x={910} y={g.height - 57} fill="#FFFFFF" fontFamily="Arial" fontSize={14}>Powered by</Text>
    <Image href={require('../../../assets/images/icon.png')} x={987} y={g.height - 94} width={58} height={58} preserveAspectRatio="xMidYMid meet" onLoad={() => onAssetLoad?.('brand')} />
    <Text x={1037} y={g.height - 54} fill="#FFFFFF" fontFamily="Arial" fontSize={28} fontWeight="bold">ConvoSquad</Text>
  </Svg>;
}

const styles = StyleSheet.create({ card: { width: '100%', aspectRatio: posterGeometry.width / posterGeometry.height, backgroundColor: '#041007' } });
