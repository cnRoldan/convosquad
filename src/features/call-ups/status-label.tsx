import { Text } from 'react-native';
import { t } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import type { callUpStatusLabel } from './lifecycle';

export function CallUpStatusLabel({ label }: { label: ReturnType<typeof callUpStatusLabel> }) {
  const [state, voting] = t(label).split(' · ');
  const active = label.startsWith('Activa');
  const color = label === 'Cancelada' ? colors.danger : label === 'Finalizada' ? '#F4A83A' : active ? '#69D68B' : undefined;
  return <Text><Text style={{ color }}>{state}</Text>{voting ? <Text>{' · '}<Text style={label === 'Activa · Votación cerrada' ? { color: '#F4A83A' } : undefined}>{voting}</Text></Text> : null}</Text>;
}
