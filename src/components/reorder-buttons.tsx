import { View } from 'react-native';
import { IconButton } from './icon-button';
export function ReorderButtons({ label, first, last, disabled, move }: { label: string; first: boolean; last: boolean; disabled: boolean; move: (direction: -1 | 1) => void }) {
  return <View style={{ flexDirection: 'row', gap: 4 }}>
    <IconButton icon="up" label={`Subir ${label}`} disabled={disabled || first} onPress={() => move(-1)} />
    <IconButton icon="down" label={`Bajar ${label}`} disabled={disabled || last} onPress={() => move(1)} />
  </View>;
}
