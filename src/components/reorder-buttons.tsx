import { t, useLanguage } from '@/features/i18n/runtime';
import { View } from 'react-native';
import { IconButton } from './icon-button';
export function ReorderButtons({ label, first, last, disabled, move }: { label: string; first: boolean; last: boolean; disabled: boolean; move: (direction: -1 | 1) => void }) {
  useLanguage();
  return <View style={{ flexDirection: 'row', gap: 4 }}>
    <IconButton icon="up" label={t("Subir {{v0}}", { v0: label })} disabled={disabled || first} onPress={() => move(-1)} />
    <IconButton icon="down" label={t("Bajar {{v0}}", { v0: label })} disabled={disabled || last} onPress={() => move(1)} />
  </View>;
}
