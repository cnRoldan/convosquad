import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, Message } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { requireSupabase } from '@/lib/supabase';
import { unwrap, backendErrorMessage } from '@/lib/backend-result';
import { useClub } from '@/features/clubs/club-context';
type Request={userId:string;eaId:string;playerEaId:string;playerId:string};
export function PlayerLinkRequests({clubId}:{clubId:string}){
 const {refreshRoster,rosterVersion}=useClub();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const load=useCallback(async()=>unwrap(await requireSupabase().rpc('list_player_link_requests',{p_club_id:clubId})) as unknown as Request[],[clubId]);
 const result=useResource(`player-links:${clubId}:${rosterVersion}`,load);const reload=result.reload;
 useFocusEffect(useCallback(()=>{reload();},[reload]));
 async function review(userId:string,approve:boolean){setBusy(true);setMessage('');try{unwrap(await requireSupabase().rpc('review_player_link',{p_club_id:clubId,p_user_id:userId,p_approve:approve}));refreshRoster();reload();}catch(e){setMessage(backendErrorMessage(e));}finally{setBusy(false);}}
 return <>
  {result.error ? <Message error>{result.error}</Message> : null}
  {message ? <Message error>{message}</Message> : null}
  {result.data?.map(r=><Card key={r.userId} title="Confirmar ficha de jugador"><Body>La cuenta {r.eaId} solicita vincularse a la ficha {r.playerEaId}. Comprueba que sea la misma persona.</Body><Button label="Confirmar vinculación" disabled={busy} onPress={()=>void review(r.userId,true)}/><Button secondary label="Rechazar vinculación" disabled={busy} onPress={()=>void review(r.userId,false)}/></Card>)}
  <Button secondary label="Actualizar vinculaciones de fichas" disabled={busy||result.isLoading} onPress={reload}/>
 </>;
}
