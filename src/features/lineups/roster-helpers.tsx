import { useCallback } from 'react';
import { Body, Card } from '@/components/ui';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { useResource } from '@/hooks/use-resource';
export function RosterHelpers({clubId,version}:{clubId:string;version:number}) {
  const load=useCallback(async()=>unwrap(await requireSupabase().rpc('list_roster_helpers',{p_club_id:clubId})),[clubId]);
  const result=useResource(`helpers:${clubId}:${version}`,load,true);
  return result.data?.length ? <Card title="Ayudas">{result.data.map(p=><Body key={p.id}>{p.name}</Body>)}</Card> : null;
}
