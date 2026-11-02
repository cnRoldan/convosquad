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
  return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 360 620" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
    <Defs>
      <LinearGradient id="night" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#050C18" /><Stop offset="0.28" stopColor="#10233A" /><Stop offset="1" stopColor="#06130C" /></LinearGradient>
      <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2A874D" /><Stop offset="1" stopColor="#103B27" /></LinearGradient>
      <LinearGradient id="glow" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFB13A" stopOpacity="0" /><Stop offset="0.5" stopColor="#FFE09A" stopOpacity="0.85" /><Stop offset="1" stopColor="#FFB13A" stopOpacity="0" /></LinearGradient>
    </Defs>
    <Rect width="360" height="620" fill="url(#night)" />
    <Path d="M0 118 Q180 42 360 118 L360 212 Q180 160 0 212Z" fill="#0B1422" opacity="0.95" />
    <Path d="M0 130 Q180 68 360 130" stroke="url(#glow)" strokeWidth="5" fill="none" opacity="0.9" />
    <Path d="M0 160 L360 160 L334 560 L26 560Z" fill="url(#grass)" />
    {[205, 280, 355, 430, 505].map(y => <Path key={y} d={`M${(y - 160) * 0.09} ${y} L${360 - (y - 160) * 0.09} ${y}`} stroke="#55A36A" strokeWidth="34" opacity="0.16" />)}
    <Path d="M24 174 L336 174 L315 553 L45 553Z" fill="none" stroke="#EAF7D9" strokeOpacity="0.78" strokeWidth="2" />
    <Path d="M42 337 L318 337M82 174 L82 225 L278 225 L278 174M106 174 L106 199 L254 199 L254 174M82 553 L82 502 L278 502 L278 553M106 553 L106 528 L254 528 L254 553" fill="none" stroke="#EAF7D9" strokeOpacity="0.72" strokeWidth="2" />
    <Circle cx="180" cy="337" r="43" fill="none" stroke="#EAF7D9" strokeOpacity="0.72" strokeWidth="2" />
    <Circle cx="180" cy="337" r="2.5" fill="#EAF7D9" /><Circle cx="180" cy="211" r="2.5" fill="#EAF7D9" /><Circle cx="180" cy="518" r="2.5" fill="#EAF7D9" />
    <Path d="M0 620 L0 0" stroke="#FFB13A" strokeOpacity="0.48" strokeWidth="5" /><Path d="M360 620 L360 0" stroke="#FFB13A" strokeOpacity="0.48" strokeWidth="5" />
  </Svg>;
}

function SharePlayer({ slot, player, shirtColor, numberColor }: { slot: Slot; player?: Candidate | undefined; shirtColor: string; numberColor: string }) {
  const left = `${slot.x * 100}%` as `${number}%`;
  const top = `${14 + slot.y * 72}%` as `${number}%`;
  return <View style={[styles.player, { left, top }]}>
    <Svg width="42" height="46" viewBox="0 0 42 46">
      <Path d="M11 5 16 2h10l5 3 8 6-5 10-5-3v24H13V18l-5 3-5-10z" fill={player ? shirtColor : '#B1BDB3'} stroke="#F7FCEB" strokeOpacity="0.65" strokeWidth="1.2" />
      <Path d="M16 2h10l-2 7h-6z" fill="#FFFFFF" fillOpacity="0.22" />
    </Svg>
    {player ? <Text style={[styles.number, { color: numberColor }]}>{player.jerseyNumber ?? '—'}</Text> : null}
    {player ? <Text numberOfLines={1} style={styles.playerName}>{player.name}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { width: '100%', aspectRatio: 0.58, overflow: 'hidden', backgroundColor: '#07100D', borderRadius: 18 },
  header: { height: '18%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 9, gap: 10 },
  crest: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: 'rgba(2,8,14,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  heading: { flex: 1, minWidth: 0 },
  kicker: { color: '#FFD071', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  club: { color: '#F7FCEB', fontSize: 20, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', textShadowColor: '#000', textShadowRadius: 4 },
  formation: { minWidth: 54, alignItems: 'flex-end' },
  formationLabel: { color: '#B8C7C0', fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  formationValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  pitchArea: { position: 'absolute', top: '16%', left: 0, right: 0, bottom: '8%' },
  player: { position: 'absolute', width: 80, marginLeft: -40, marginTop: -25, alignItems: 'center' },
  number: { position: 'absolute', top: 16, fontSize: 12, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 1 },
  playerName: { marginTop: -1, maxWidth: 80, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(2,8,12,0.76)', color: '#FFFFFF', fontSize: 8, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 2 },
  footer: { position: 'absolute', height: '8%', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: 'rgba(2,8,13,0.8)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  footerBrand: { color: '#B4F16C', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  footerCopy: { color: '#B7C7B9', fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
});
