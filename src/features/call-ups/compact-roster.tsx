import { memo, useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '@/theme';
import { categoryLabels } from '@/features/players/categories';
import { jerseyAccessibilityLabel, jerseyLabel } from '@/features/players/jersey';
import { availabilityLabels } from './availability';
import { availabilityIcons, availabilityStates, callUpList, filterLabels } from './list-model';
import type { AvailabilityFilter, CallUpPlayer } from './list-model';
import { CompactPanel } from './compact-panel';
import type { Tables } from '@/types/database';

const statusColors = { available: colors.primary, unavailable: colors.danger, backup: '#F2D478', unanswered: colors.muted };
const shortLabels = { available: 'Disponibles', unavailable: 'No disp.', backup: 'Backup', unanswered: 'Pendientes' };

export function CompactRoster({ players, trials, aids, trialEditor, trialActions }: {
  players: readonly CallUpPlayer[];
  trials: readonly Tables<'call_up_trials'>[]; aids: ReactNode; trialEditor?: ReactNode; trialActions?: ((trial: Tables<'call_up_trials'>) => ReactNode) | undefined;
}) {
  const [filter, setFilter] = useState<AvailabilityFilter>('all');
  const [expandedPanels, setExpandedPanels] = useState<ReadonlySet<string>>(() => new Set());
  useFocusEffect(useCallback(() => { setExpandedPanels(new Set()); }, []));
  const model = useMemo(() => callUpList(players, filter), [players, filter]);
  const { width } = useWindowDimensions();
  function toggle(key: string) { setExpandedPanels(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  return <View style={styles.stack}>
    <View style={styles.counters}>
      {availabilityStates.map(status => <Pressable key={status} accessibilityRole="button"
        accessibilityLabel={`${filterLabels[status]}: ${model.counts[status]}. Filtrar convocatoria`}
        {...(Platform.OS === 'web' ? { 'aria-pressed': filter === status } : {})} accessibilityState={{ selected: filter === status }} onPress={() => setFilter(current => current === status ? 'all' : status)}
        style={({ pressed }) => [styles.counter, width < 360 && styles.halfCounter, filter === status && styles.selected, pressed && styles.pressed]}>
        <Text style={[styles.count, { color: statusColors[status] }]}>{availabilityIcons[status]} {model.counts[status]}</Text>
        <Text style={styles.counterLabel}>{shortLabels[status]}</Text>
      </Pressable>)}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Filtros de disponibilidad">
      {(['all', ...availabilityStates] as const).map(value => <Pressable key={value} accessibilityRole="button"
        accessibilityLabel={`${filterLabels[value]} (${value === 'all' ? model.total : model.counts[value]})`}
        {...(Platform.OS === 'web' ? { 'aria-pressed': filter === value } : {})} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)}
        style={({ pressed }) => [styles.chip, filter === value && styles.selected, pressed && styles.pressed]}>
        <Text style={[styles.chipText, filter === value && styles.selectedText]}>{filterLabels[value]} ({value === 'all' ? model.total : model.counts[value]})</Text>
      </Pressable>)}
    </ScrollView>
    <Text style={styles.help}>Disponible no significa seleccionado para el once.</Text>
    {model.groups.map(group => <CompactPanel key={group.category} title={`${categoryLabels[group.category]} (${group.total})`}
      summary={availabilityStates.map(status => `${availabilityIcons[status]} ${group.counts[status]}`).join(' · ')}
      expanded={expandedPanels.has(group.category)} onToggle={() => toggle(group.category)}>
      {group.players.map(player => <AvailabilityRow key={player.id} player={player} />)}
      {!group.players.length ? <Text style={styles.empty}>Sin jugadores.</Text> : null}
    </CompactPanel>)}
    {!model.visibleTotal ? <View style={styles.emptyResults}>
      <Text style={styles.empty}>{filter === 'all' ? 'Esta convocatoria no contiene jugadores de la plantilla oficial.' : `No hay jugadores en ${filterLabels[filter].toLowerCase()}.`}</Text>
      {filter !== 'all' ? <Pressable accessibilityRole="button" onPress={() => setFilter('all')} style={styles.chip}><Text style={styles.selectedText}>Mostrar todos</Text></Pressable> : null}
    </View> : null}
    <View style={filter !== 'all' ? styles.hidden : undefined}>
      <CompactPanel title={`PRUEBAS (${trials.length})`} expanded={expandedPanels.has('trials')} onToggle={() => toggle('trials')} subtle>
        {trials.map(trial => <View key={trial.id} style={styles.trial}>
          <Text style={styles.name}>{trial.ea_id_snapshot}</Text>
          {trial.notes_snapshot ? <Text style={styles.meta}>{trial.notes_snapshot}</Text> : null}
          {trialActions?.(trial)}
        </View>)}
        {!trials.length ? <Text style={styles.empty}>No se incluyeron pruebas.</Text> : null}
        {trialEditor}
      </CompactPanel>
      <View style={styles.aids}>{aids}</View>
    </View>
  </View>;
}

const AvailabilityRow = memo(function AvailabilityRow({ player }: { player: CallUpPlayer }) {
  return <View style={styles.row} testID={`call-up-player-${player.id}`}>
    <View style={styles.line}>
      <Text style={styles.name}>{player.eaId}</Text>
      {player.jersey !== null ? <Text accessibilityLabel={jerseyAccessibilityLabel(player.jersey)} style={styles.jersey}>{jerseyLabel(player.jersey)}</Text> : null}
      <Text style={[styles.status, { color: statusColors[player.availability] }]}>{availabilityIcons[player.availability]} {availabilityLabels[player.availability]}</Text>
    </View>
    {!player.userId ? <Text style={styles.meta}>Sin registrar</Text> : null}
  </View>;
});

const styles = StyleSheet.create({
  stack: { gap: 10 }, counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  counter: { flexGrow: 1, flexBasis: 0, minHeight: 64, paddingVertical: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 3 },
  halfCounter: { flexBasis: '45%' }, count: { fontSize: 20, fontWeight: '800' }, counterLabel: { fontSize: 12, color: colors.text, textAlign: 'center' },
  filters: { gap: 6 }, chip: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' }, selected: { borderColor: colors.primary, backgroundColor: '#243622' }, selectedText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  help: { fontSize: 12, color: colors.muted }, row: { paddingVertical: 8, gap: 3, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 }, name: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  jersey: { color: colors.muted, fontSize: 13, lineHeight: 20 }, status: { flexShrink: 0, fontSize: 12, lineHeight: 20 }, meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  trial: { paddingVertical: 6, gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, empty: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 6 },
  emptyResults: { gap: 4, alignItems: 'flex-start' }, aids: { marginTop: 10 }, hidden: { display: 'none' }, pressed: { opacity: 0.6 },
});
