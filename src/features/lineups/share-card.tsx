import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ClubCrest } from '@/features/clubs/club-crest';
import type { Candidate, Lineup, Slot } from './model';

export function LineupShareCard({ clubName, crestPath, lineup, candidates, shirtColor, numberColor }: { clubName: string; crestPath?: string | null | undefined; lineup: Lineup; candidates: Candidate[]; shirtColor: string; numberColor: string }) {
  return <View style={styles.card}>
    <Stadium />
    <View style={styles.header}>
      <View style={styles.crest}><ClubCrest path={crestPath} name={clubName} size={42} /></View>
      <View style={styles.heading}><Text style={styles.kicker}>CONVOSQUAD · ONCE TITULAR</Text><Text numberOfLines={1} style={styles.club}>{clubName}</Text></View>
      <View style={styles.formation}><Text style={styles.formationLabel}>FORMACIÓN</Text><Text style={styles.formationValue}>{lineup.formation}</Text></View>
    </View>
    <View style={styles.pitchArea}>
      {lineup.slots.map(slot => <SharePlayer key={slot.id} slot={slot} player={candidates.find(candidate => candidate.id === slot.playerId)} shirtColor={shirtColor} numberColor={numberColor} />)}
    </View>
    <View style={styles.footer}><Text style={styles.footerBrand}>CONVOSQUAD</Text><Text style={styles.footerCopy}>TU EQUIPO · TU CONVOCATORIA</Text></View>
  </View>;
}

function Stadium() {
  return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 360 324" preserveAspectRatio="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
    <Defs>
      <LinearGradient id="night" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#020907" /><Stop offset="0.35" stopColor="#071A0F" /><Stop offset="1" stopColor="#123507" /></LinearGradient>
      <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#297C16" /><Stop offset="1" stopColor="#123F08" /></LinearGradient>
      <LinearGradient id="light" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#A8F835" stopOpacity="0" /><Stop offset="0.5" stopColor="#DBFF91" stopOpacity="0.9" /><Stop offset="1" stopColor="#A8F835" stopOpacity="0" /></LinearGradient>
    </Defs>
    <Rect width="360" height="620" fill="url(#night)" />
    <Path d="M0 0h360v89Q180 42 0 89Z" fill="#020B08" /><Path d="M0 70Q180 110 360 70" stroke="url(#light)" strokeWidth="1" fill="none" />
    <Path d="M0 82 360 82 338 306 22 306Z" fill="url(#grass)" />
    {[107, 140, 173, 206, 239, 272].map(y => <Path key={y} d={`M${(y - 82) * 0.1} ${y} L${360 - (y - 82) * 0.1} ${y}`} stroke="#78AB3A" strokeWidth="18" opacity="0.14" />)}
    <Path d="M39 89 321 89 342 304 18 304Z" fill="none" stroke="#F3FEEA" strokeWidth="1.4" />
    <Path d="M18 169h324M105 89v24h150V89M122 89v12h116V89M87 304v-35h186v35M106 304v-18h148v18" fill="none" stroke="#F3FEEA" strokeWidth="1.3" />
    <Circle cx="180" cy="169" r="35" fill="none" stroke="#F3FEEA" strokeWidth="1.3" /><Circle cx="180" cy="169" r="2" fill="#F3FEEA" />
    <Path d="M0 0 21 0 0 27M360 0 339 0 360 27M0 324 22 324 0 297M360 324 338 324 360 297" stroke="#B5FF3D" strokeWidth="7" fill="none" />
    <Path d="M14 0 44 0 14 30M346 0 316 0 346 30M14 324 44 324 14 294M346 324 316 324 346 294" stroke="#B5FF3D" strokeWidth="1" fill="none" />
  </Svg>;
}

function SharePlayer({ slot, player, shirtColor, numberColor }: { slot: Slot; player?: Candidate | undefined; shirtColor: string; numberColor: string }) {
  const depth = 0.72 + slot.y * 0.3;
  const perspectiveX = 0.5 + (slot.x - 0.5) * (0.77 + slot.y * 0.23);
  const left = `${perspectiveX * 100}%` as `${number}%`;
  const top = `${slot.y * 100}%` as `${number}%`;
  return <View style={[styles.player, { left, top, transform: [{ scale: depth }] }]}>
    <Svg width="42" height="46" viewBox="0 0 42 46">
      <Path d="M11 5 16 2h10l5 3 8 6-5 10-5-3v24H13V18l-5 3-5-10z" fill={player ? shirtColor : '#B1BDB3'} stroke="#F7FCEB" strokeOpacity="0.65" strokeWidth="1.2" />
      <Path d="M16 2h10l-2 7h-6z" fill="#FFFFFF" fillOpacity="0.22" />
    </Svg>
    {player ? <Text style={[styles.number, { color: numberColor }]}>{player.jerseyNumber ?? '—'}</Text> : null}
    {player ? <Text numberOfLines={1} style={styles.playerName}>{player.name}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { width: '100%', aspectRatio: 1.113, overflow: 'hidden', backgroundColor: '#07100D', borderRadius: 0 },
  header: { zIndex: 1, height: '23%', flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 17, paddingTop: 16, gap: 9 },
  crest: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(2,8,14,0.62)', borderWidth: 1, borderColor: '#B5FF3D' },
  heading: { flex: 1, minWidth: 0 },
  kicker: { color: '#B5FF3D', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  club: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase', textShadowColor: '#000', textShadowRadius: 4 },
  formation: { minWidth: 45, alignItems: 'flex-end', paddingTop: 3 },
  formationLabel: { color: '#E5EEE8', fontSize: 6, fontWeight: '800', letterSpacing: 0.4 },
  formationValue: { color: '#B5FF3D', fontSize: 13, fontWeight: '900' },
  pitchArea: { zIndex: 1, position: 'absolute', top: '24%', left: '5%', right: '5%', bottom: '8%' },
  player: { position: 'absolute', width: 80, marginLeft: -40, marginTop: -25, alignItems: 'center' },
  number: { position: 'absolute', top: 16, fontSize: 12, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 1 },
  playerName: { marginTop: -1, maxWidth: 80, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(2,8,12,0.88)', color: '#FFFFFF', fontSize: 8, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 2 },
  footer: { zIndex: 1, position: 'absolute', height: '7%', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  footerBrand: { color: '#B5FF3D', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  footerCopy: { color: '#FFFFFF', fontSize: 5, fontWeight: '800', letterSpacing: 0.4 },
});
