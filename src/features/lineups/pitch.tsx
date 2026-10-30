import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { PlayerToken } from './player-token';
import type { Candidate, Lineup, Slot } from './model';
import { moveSlot } from './model';

type Props = { lineup: Lineup; candidates: Candidate[]; editable: boolean; onChange: (lineup: Lineup) => void; onSelect: (slot: Slot) => void; onDragging?: (dragging: boolean) => void };
const height = 520;

export function LineupPitch(props: Props) {
  const [width, setWidth] = useState(1);
  return <View style={styles.pitch} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <PitchMarkings />
    {props.lineup.slots.map(slot => <Position key={slot.id} {...props} slot={slot} width={width} />)}
  </View>;
}

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
      <PlayerToken player={player} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  pitch: { height, borderRadius: 20, backgroundColor: '#216F3A', overflow: 'hidden' },
  position: { position: 'absolute', width: 80 },
  target: { alignItems: 'center', minHeight: 48 },
});
