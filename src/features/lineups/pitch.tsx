import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { PlayerToken } from './player-token';
import { ClubCrest } from '@/features/clubs/club-crest';
import type { Candidate, Lineup, Slot } from './model';
import { moveSlot } from './model';

type Props = { lineup: Lineup; candidates: Candidate[]; editable: boolean; clubName: string; crestPath?: string | null | undefined; playerColor: string; onChange: (lineup: Lineup) => void; onSelect: (slot: Slot) => void; onDragging?: (dragging: boolean) => void };
const height = 520;

export const LineupPitch = forwardRef<View, Props>(function LineupPitch(props, imageRef) {
  const [width, setWidth] = useState(1);
  return <View ref={imageRef} collapsable={false} style={styles.pitch} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <PitchMarkings />
    <View pointerEvents="none" style={styles.teamIdentity}>
      <ClubCrest path={props.crestPath} name={props.clubName} size={25} />
      <Text numberOfLines={1} style={styles.teamName}>{props.clubName}</Text>
    </View>
    {props.lineup.slots.map(slot => <Position key={slot.id} {...props} slot={slot} width={width} />)}
    <View pointerEvents="none" style={styles.poweredBy}>
      <Text style={styles.poweredText}>Powered by</Text>
      <Image source={require('../../../assets/images/icon.png')} style={styles.poweredIcon} />
      <Text style={styles.poweredBrand}>ConvoSquad</Text>
    </View>
  </View>;
});

function PitchMarkings() {
  const line = '#E6F8D9';
  return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 160" preserveAspectRatio="none" style={StyleSheet.absoluteFill} accessible={false}>
    <Rect width="100" height="20" fill="#267A40" />
    <Rect y="20" width="100" height="20" fill="#216F3A" />
    <Rect y="40" width="100" height="20" fill="#267A40" />
    <Rect y="60" width="100" height="20" fill="#216F3A" />
    <Rect y="80" width="100" height="20" fill="#267A40" />
    <Rect y="100" width="100" height="20" fill="#216F3A" />
    <Rect y="120" width="100" height="20" fill="#267A40" />
    <Rect y="140" width="100" height="20" fill="#216F3A" />
    <Rect x="5" y="5" width="90" height="150" fill="none" stroke={line} strokeWidth="1.2" />
    <Path d="M5 80h90M36 5v10h28V5M18 5v27h64V5M5 14a9 9 0 0 0 9-9M95 14a9 9 0 0 1-9-9" fill="none" stroke={line} strokeWidth="1.2" />
    <Path d="M5 146a9 9 0 0 1 9 9M95 146a9 9 0 0 0-9 9M36 155v-10h28v10M18 155v-27h64v27" fill="none" stroke={line} strokeWidth="1.2" />
    <Rect x="38" y="1" width="24" height="4" fill="none" stroke={line} strokeWidth="1.2" />
    <Rect x="38" y="155" width="24" height="4" fill="none" stroke={line} strokeWidth="1.2" />
    <Circle cx="50" cy="80" r="14" fill="none" stroke={line} strokeWidth="1.2" />
    <Circle cx="50" cy="80" r="1" fill={line} />
    <Circle cx="50" cy="22" r="1" fill={line} />
    <Circle cx="50" cy="138" r="1" fill={line} />
    <Path d="M40 32a11 11 0 0 0 20 0M40 128a11 11 0 0 1 20 0" fill="none" stroke={line} strokeWidth="1.2" />
  </Svg>;
}

function Position(props: Props & { slot: Slot; width: number }) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const origin = useRef({ x: props.slot.x, y: props.slot.y });
  // PanResponder stores these callbacks; it never invokes them during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => latest.current.editable && latest.current.slot.id !== 0 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => {
      origin.current = { x: latest.current.slot.x, y: latest.current.slot.y };
      latest.current.onDragging?.(true);
    },
    onPanResponderMove: (_, gesture) => {
      const current = latest.current;
      current.onChange(moveSlot(current.lineup, current.slot.id, origin.current.x + gesture.dx / current.width, origin.current.y + gesture.dy / height));
    },
    onPanResponderRelease: () => latest.current.onDragging?.(false),
    onPanResponderTerminate: () => latest.current.onDragging?.(false),
    onPanResponderTerminationRequest: () => false,
  }));
  const player = props.candidates.find(p => p.id === props.slot.playerId);
  return <View {...responder.panHandlers} style={[styles.position, { left: props.slot.x * props.width - 40, top: props.slot.y * height - 24 }]}>
    <Pressable disabled={!props.editable} onPress={() => props.onSelect(props.slot)} accessibilityRole="button" accessibilityLabel={player ? `${player.name}, dorsal ${player.jerseyNumber ?? 'sin asignar'}` : 'Posición vacía'} style={styles.target}>
      <PlayerToken player={player} color={props.playerColor} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  pitch: { height, borderRadius: 20, backgroundColor: '#216F3A', overflow: 'hidden' },
  teamIdentity: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { color: '#F3F8F1', fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 4 },
  poweredBy: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 9, backgroundColor: 'rgba(5,18,10,0.62)' },
  poweredText: { color: '#D8E7D7', fontSize: 7, fontWeight: '700' },
  poweredIcon: { width: 13, height: 13, borderRadius: 3 },
  poweredBrand: { color: '#F3F8F1', fontSize: 8, fontWeight: '800' },
  position: { position: 'absolute', width: 80 },
  target: { alignItems: 'center', minHeight: 48 },
});
