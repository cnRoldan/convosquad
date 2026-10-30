import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { PlayerToken } from './player-token';
import type { Candidate, Lineup, Slot } from './model';
import { moveSlot } from './model';

type Props = { lineup: Lineup; candidates: Candidate[]; editable: boolean; onChange: (lineup: Lineup) => void; onSelect: (slot: Slot) => void; onDragging?: (dragging: boolean) => void };
const height = 520;

export function LineupPitch(props: Props) {
  const [width, setWidth] = useState(1);
  return <View style={styles.pitch} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View pointerEvents="none" style={styles.half} />
    <View pointerEvents="none" style={styles.circle} />
    <View pointerEvents="none" style={styles.goal} />
    {props.lineup.slots.map(slot => <Position key={slot.id} {...props} slot={slot} width={width} />)}
  </View>;
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
  pitch: { height, borderRadius: 20, borderWidth: 2, borderColor: '#DDF8D2', backgroundColor: '#286840', overflow: 'hidden' },
  half: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: '#DDF8D2' },
  circle: { position: 'absolute', top: '50%', left: '50%', marginLeft: -50, marginTop: -50, width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#DDF8D2' },
  goal: { position: 'absolute', bottom: 0, left: '25%', width: '50%', height: 72, borderWidth: 2, borderColor: '#DDF8D2' },
  position: { position: 'absolute', width: 80 },
  target: { alignItems: 'center', minHeight: 48 },
});
