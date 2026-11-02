import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Field, Heading, Message, Options, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { categories, categoryLabels, type RosterCategory } from '@/features/players/categories';
import { requireSupabase } from '@/lib/supabase';
import { unwrap, backendErrorMessage } from '@/lib/backend-result';
import { useResource } from '@/hooks/use-resource';

type State = { status: 'new' | 'linked' | 'pending' | 'blocked'; eaId?: string; usedNumbers?: number[]; suggestions?: {id:string;eaId:string;nickname:string|null;jerseyNumber:number|null;score:number}[] };
export default function CompletePlayer() {
 const { club }=useLocalSearchParams<{club:string}>();
 const { reloadClubs, refreshRoster }=useClub();
 const [jersey,setJersey]=useState(''); const [nickname,setNickname]=useState('');
 const [category,setCategory]=useState<RosterCategory>('midfielders'); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 const load=useCallback(async()=>unwrap(await requireSupabase().rpc('prepare_player_onboarding',{p_club_id:club})) as unknown as State,[club]);
 const result=useResource(`onboard:${club}`,load,Boolean(club)); const reload=result.reload;
 useFocusEffect(useCallback(()=>{reload();},[reload]));
 async function openClub(){await reloadClubs(club);refreshRoster();router.replace('/home');}
 async function save(playerId?:string){
  if(busy)return;
  if(!playerId && (!/^[0-9]{1,2}$/.test(jersey)||+jersey<1||+jersey>99||!nickname.trim()||nickname.trim().length>24))return setMessage('Escoge un dorsal entre 1 y 99 y un apodo de hasta 24 caracteres.');
  setBusy(true);setMessage('');
  try{
   if(playerId){unwrap(await requireSupabase().rpc('request_player_link',{p_club_id:club,p_player_id:playerId}));reload();}
   else{unwrap(await requireSupabase().rpc('complete_player_onboarding',{p_club_id:club,p_jersey:+jersey,p_category:category,p_nickname:nickname.trim()}));await openClub();}
  }catch(e){setMessage(backendErrorMessage(e));reload();}finally{setBusy(false);}
 }
 const data=result.data;
 return <Screen>
  <Heading title="Tu ficha en el club" />
  {result.isLoading ? <Body>Buscando tu ficha…</Body> : result.error ? <Message error>{result.error}</Message> : data?.status==='linked' ? <Card title="Ficha vinculada"><Body>Ya tienes tu ficha vinculada. Se conservan su dorsal, posición, apodo y estadísticas.</Body><Button label="Entrar al club" onPress={()=>void openClub()} /></Card> : data?.status==='blocked' ? <Body>La ficha con tu ID de EA ya está vinculada a otra cuenta. Pide al capitán que la revise.</Body> : data?.status==='pending' ? <Card title="Pendiente del capitán"><Body>El capitán debe confirmar que la ficha que has elegido te pertenece. No se creará un jugador duplicado.</Body><Button label="Comprobar vinculación" disabled={busy} onPress={reload} /></Card> : data ? <>
   <Body>ID de EA: {data.eaId}</Body>
   {data.suggestions?.length ? <Card title="¿Esta es tu ficha?">
    <Body>Hemos encontrado fichas parecidas. Si alguna es la tuya, solicita la vinculación para que el capitán la confirme.</Body>
    {data.suggestions.map(p=><Button key={p.id} secondary disabled={busy} label={`Solicitar vinculación: ${p.eaId}${p.jerseyNumber ? ` · #${p.jerseyNumber}` : ''}`} onPress={()=>void save(p.id)} />)}
   </Card> : null}
   <Card title="Crear mi ficha">
    <Body>Completa estos datos si ninguna ficha existente es la tuya.</Body>
    <Field label="Dorsal libre (1–99)" value={jersey} onChangeText={setJersey} maxLength={2} keyboardType="number-pad" editable={!busy}/>
    <Body>Dorsales ocupados: {data.usedNumbers?.length ? [...data.usedNumbers].sort((a,b)=>a-b).join(', ') : 'ninguno'}</Body>
    <Body>Posición</Body><Options value={category} options={categories.map(value=>({value,label:categoryLabels[value]}))} onChange={setCategory} disabled={busy}/>
    <Field label="Apodo" value={nickname} onChangeText={setNickname} maxLength={24} editable={!busy}/>
    <Button label={busy?'Guardando…':'Crear ficha y entrar'} disabled={busy || Boolean(data.usedNumbers?.includes(+jersey))} onPress={()=>void save()}/>
   </Card>
  </> : null}
  {message ? <Message error>{message}</Message> : null}
  <Button secondary label="Actualizar" disabled={busy||result.isLoading} onPress={reload}/>
 </Screen>;
}
