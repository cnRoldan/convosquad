import { useCallback } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Message, Screen } from '@/components/ui';
import { LineupShareCard } from '@/features/lineups/share-card';
import { useResource } from '@/hooks/use-resource';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { getClubCrestUrl } from '@/features/clubs/crest';
import { useClub } from '@/features/clubs/club-context';
import type { Candidate, Lineup } from '@/features/lineups/model';

type Snapshot = { clubName: string; crestPath: string | null; lineup: Lineup; candidates: Candidate[]; shirtColor: string; numberColor: string; goalkeeperColor: string };
export default function HistoricalLineup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeClub } = useClub();
  const load = useCallback(async () => {
    const data = unwrap(await requireSupabase().rpc('read_historical_lineup', { p_call_id: id })) as unknown as { allowed: boolean; snapshot?: Snapshot | null };
    const crestUrl = data.snapshot?.crestPath ? await getClubCrestUrl(data.snapshot.crestPath) : null;
    return { ...data, crestUrl };
  }, [id]);
  const result = useResource(`historical-lineup:${activeClub?.id}:${id}`, load, Boolean(id));
  const reload = result.reload;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const data = result.data;
  return <Screen>
    {result.isLoading ? <Body>Cargando alineación…</Body> : result.error ? <><Message error>{result.error}</Message><Button label="Reintentar" onPress={result.reload} /></> : data?.allowed === false ? <Card title="⭐ Funcionalidad Prémium">
      <Body>Consultar alineaciones históricas requiere que el club tenga Prémium activo en este momento.</Body>
      <Button label="Activar Prémium" onPress={() => router.push('/premium')} />
    </Card> : data?.snapshot ? <LineupShareCard {...data.snapshot} crestUrl={data.crestUrl} /> : <Body>No se publicó ninguna alineación para esta convocatoria.</Body>}
  </Screen>;
}
