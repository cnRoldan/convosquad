import { goalkeeperNumberColor } from './kit-colors';
import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { PlayerToken } from './player-token';
import { IconButton } from '@/components/icon-button';
import type { Candidate, Lineup, Slot } from './model';
import { moveSlot } from './model';

type Props = { lineup: Lineup; candidates: Candidate[]; incidentPlayerIds?: ReadonlySet<string>; editable: boolean; playerColor: string; goalkeeperColor?: string; jerseyColor: string; positionLocked: boolean; onTogglePositionLock?: (() => void) | undefined; onChange: (lineup: Lineup) => void; onSelect: (slot: Slot) => void; onDragStart?: (() => void) | undefined; onDragging?: (dragging: boolean) => void };

export const LineupPitch = forwardRef<View, Props>(function LineupPitch(props, imageRef) {
  const [width, setWidth] = useState(1);
  const height = Math.max(520, Math.min(960, Math.round(width * 1.35)));
  return <View testID="lineup-pitch" ref={imageRef} collapsable={false} style={[styles.pitch, { height }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <PitchMarkings />
    {props.lineup.slots.map(slot => <Position key={slot.id} {...props} slot={slot} width={width} height={height} />)}
    {props.onTogglePositionLock ? <View style={styles.lock}><IconButton icon={props.positionLocked ? 'lock' : 'unlock'} label={props.positionLocked ? 'Desbloquear posiciones' : 'Bloquear posiciones'} onPress={props.onTogglePositionLock} /></View> : null}
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

function Position(props: Props & { slot: Slot; width: number; height: number }) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const origin = useRef({ x: props.slot.x, y: props.slot.y });
  const didDrag = useRef(false);
  // PanResponder stores these callbacks; it never invokes them during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => latest.current.editable && !latest.current.positionLocked && latest.current.slot.id !== 0 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => {
      didDrag.current = true;
      origin.current = { x: latest.current.slot.x, y: latest.current.slot.y };
      latest.current.onDragStart?.();
      latest.current.onDragging?.(true);
    },
    onPanResponderMove: (_, gesture) => {
      const current = latest.current;
      current.onChange(moveSlot(current.lineup, current.slot.id, origin.current.x + gesture.dx / current.width, origin.current.y + gesture.dy / current.height));
    },
    onPanResponderRelease: () => latest.current.onDragging?.(false),
    onPanResponderTerminate: () => latest.current.onDragging?.(false),
    onPanResponderTerminationRequest: () => false,
  }));
  const player = props.candidates.find(p => p.id === props.slot.playerId);
  return <View {...responder.panHandlers} style={[styles.position, { left: props.slot.x * props.width - 40, top: props.slot.y * props.height - 24 }]}>
    <Pressable disabled={!props.editable} onPressIn={() => { didDrag.current = false; }} onPress={() => { if (!didDrag.current) props.onSelect(props.slot); }} accessibilityRole="button" accessibilityLabel={player ? `${player.name}, dorsal ${player.jerseyNumber ?? 'sin asignar'}` : 'Posición vacía'} style={styles.target}>
      <PlayerToken player={player} warning={Boolean(player && props.incidentPlayerIds?.has(player.id))} color={props.slot.id === 0 ? props.goalkeeperColor ?? '#F4A83A' : props.playerColor} jerseyColor={props.slot.id === 0 ? goalkeeperNumberColor(props.goalkeeperColor ?? '#F4A83A') : props.jerseyColor} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  pitch: { borderRadius: 20, backgroundColor: '#216F3A', overflow: 'hidden' },
  position: { position: 'absolute', width: 80 },
  target: { alignItems: 'center', minHeight: 48 },
  lock: { position: 'absolute', right: 8, bottom: 8 },
});
