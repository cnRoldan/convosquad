import { View } from 'react-native';
import { Button } from './ui';
export function ReorderButtons({ label, first, last, disabled, move }: { label: string; first: boolean; last: boolean; disabled: boolean; move: (direction: -1 | 1) => void }) {
  return <View style={{ gap: 8 }}>
    <Button secondary label={`Subir ${label}`} disabled={disabled || first} onPress={() => move(-1)} />
    <Button secondary label={`Bajar ${label}`} disabled={disabled || last} onPress={() => move(1)} />
  </View>;
}
