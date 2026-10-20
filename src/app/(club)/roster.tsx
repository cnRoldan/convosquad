import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
import { PlayerCard } from '@/features/players/player-card';
import { PlayerActivityDialog } from '@/features/players/player-activity-dialog';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { listPlayers, reorderPlayers } from '@/features/players/service';
import { categories, categoryLabels, compareRoster, moveItem } from '@/features/players/categories';
import type { RosterCategory } from '@/features/players/categories';
import { TrialSection } from '@/features/trials/trial-section';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
export default function RosterScreen() {
  useLanguage();
  const { activeClub, currentMembership, roster, rosterVersion, rosterLoading, notice, refreshRoster } = useClub();
  const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const admin = currentMembership?.role === 'admin';
  const [filter, setFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const { activity } = useLocalSearchParams<{ activity?: string }>();
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; eaId: string; isActive: boolean; scope: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const scope = `${session?.user.id}:${clubId}:${isDemo}`;
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = useCallback(() => clubId ? listPlayers(clubId) : Promise.resolve([]), [clubId]);
  const result = useResource(`players:${session?.user.id}:${clubId}:${admin}:${rosterVersion}`, load, Boolean(session && clubId) && !isDemo);
  const players = (isDemo ? roster.map(player => ({ ...player, isActive: true })) : result.data?.map(player => ({
    id: player.id, eaId: player.ea_id, displayName: player.ea_id, jerseyNumber: player.jersey_number,
    category: player.category, sortOrder: player.sort_order, userId: player.user_id, isActive: player.is_active,
  })) ?? []).sort(compareRoster);
  const displayed = players.filter(player => player.isActive && (filter === 'all' || (filter === 'registered' ? Boolean(player.userId) : !player.userId)));
  async function move(category: RosterCategory, id: string, direction: -1 | 1) {
    if (!clubId || !admin || filter !== 'all' || isDemo || busy) return;
    const ids = moveItem(players.filter(player => player.category === category && player.isActive).map(player => player.id), id, direction); if (!ids) return;
    setBusy(true); setMessage('');
    try { await reorderPlayers(clubId, category, ids); refreshRoster(); }
    catch (error) { setMessage(backendErrorMessage(error)); result.reload(); }
    finally { setBusy(false); }
  }
  function refresh() { result.reload(); refreshRoster(); }
  return <Screen onRefresh={!isDemo && clubId ? refresh : undefined} refreshing={result.isLoading || rosterLoading}>
    <Heading title={t("La plantilla")} subtitle={activeClub?.name ?? t("Tu club")} />
    {notice ? <Message>{notice}</Message> : null}
    {activity === 'removed' || removed ? <Message>{t("Jugador quitado de la plantilla. Su cuenta y convocatorias anteriores se conservan.")}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    <Options value={filter} onChange={setFilter} options={[{ value: 'all', label: t("Todos") }, { value: 'registered', label: t("Registrados") }, { value: 'unregistered', label: t("Sin registrar") }]} />
    {admin ? <>
      <Button secondary label={t("Jugadores inactivos")} onPress={() => router.push('/inactive-players')} />
      <Button label={t("Añadir jugador")} onPress={() => router.push('/players/new')} />
      <Button secondary label={t("Importar desde WhatsApp")} onPress={() => router.push('/roster-import')} />
      {filter !== 'all' ? <Body>{t("Para ordenar, muestra todos los jugadores activos.")}</Body> : null}
    </> : null}
    {result.isLoading ? <Body>{t("Cargando plantilla…")}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label={t("Reintentar")} onPress={result.reload} /></> : null}
    {categories.map(category => {
      const group = displayed.filter(player => player.category === category);
      return <Card key={category} title={t(categoryLabels[category])}>
        {category === 'backups' ? <Body>{t("Miembros habituales de la plantilla. Su categoría no determina su respuesta a una convocatoria.")}</Body> : null}
        {group.map((player, index) => <PlayerCard key={player.id} player={player}
          {...(admin ? { actions: {
            first: index === 0, last: index === group.length - 1,
            disabled: busy || result.isLoading,
            orderingDisabled: isDemo || filter !== 'all',
            move: (direction: -1 | 1) => { void move(category, player.id, direction); },
            edit: () => router.push({ pathname: '/players/[id]', params: { id: player.id } }),
            remove: () => setPendingRemoval({ id: player.id, eaId: player.eaId, isActive: true, scope }),
          } } : {})} />)}
        {!group.length && !result.isLoading && !result.error ? <Body>{t("Sin jugadores con este filtro.")}</Body> : null}
      </Card>;
    })}
    {pendingRemoval && pendingRemoval.scope === scope && admin ? <PlayerActivityDialog key={`${scope}:${pendingRemoval.id}`} player={pendingRemoval}
      onCancel={() => setPendingRemoval(null)} onSuccess={() => { setPendingRemoval(null); setRemoved(true); }} /> : null}
    <TrialSection />
    {!isDemo ? <Button secondary label={t("Actualizar plantilla")} disabled={result.isLoading} onPress={refresh} /> : <Body>{t("Datos simulados · los cambios de la demo no se guardan.")}</Body>}
  </Screen>;
}
