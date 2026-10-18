import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { deleteOwnAccount, accountDeletionError } from '../src/features/auth/account-deletion.ts';
const userId='00000000-0000-4000-8000-000000000901';
async function fixture({otherUser=false,deleteError=null,logoutError=false}={}) {
 const requests=[]; const storage=new Map();
 const user={id:userId,email:'ea.player@accounts.convosquad.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const token=id=>`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.${id}`;
 const session=id=>({user:otherUser&&id==='verification'?{...user,id:'other-user'}:user,access_token:token(id),refresh_token:`fixture-${id}`,expires_in:3600,token_type:'bearer'});
 const fetch=async(url,init)=>{
  const path=new URL(url).pathname;const body=JSON.parse(init.body??'{}');
  requests.push({path,body,authorization:new Headers(init.headers).get('authorization')});
  if(path==='/auth/v1/user')return Response.json(user);
  if(path==='/auth/v1/token')return body.password==='test-password'?Response.json(session('verification')):Response.json({code:'invalid_credentials',msg:'Private details'},{status:400,headers:{'X-Supabase-Api-Version':'2024-01-01'}});
  if(path==='/rest/v1/rpc/delete_my_account')return deleteError?Response.json({code:deleteError,message:'Private details'},{status:400}):new Response(null,{status:204});
  if(path==='/auth/v1/logout')return logoutError?Response.json({message:'Failed'},{status:400}):Response.json({});
  throw Error('Unexpected endpoint');
 };
 const client=createClient('https://auth.example.test','fixture-key',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage:{getItem:key=>storage.get(key)??null,setItem:(key,v)=>storage.set(key,v),removeItem:key=>storage.delete(key)}},global:{fetch}});
 const verifier=createClient('https://auth.example.test','fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'deletion-check'},global:{fetch}});
 await client.auth.setSession(session('original'));requests.length=0;
 return {client,verifier,requests,storage};
}
test('SDK: elimina con sesión recién autenticada, sin contraseña en RPC ni almacenamiento',async()=>{
 const f=await fixture();await deleteOwnAccount(f.client,f.verifier,userId,'test-password',' Player ');
 const request=f.requests.find(r=>r.path.includes('/rpc/'));
 assert.match(request.authorization,/verification$/);assert.deepEqual(request.body,{p_confirmation:'Player'});
 assert.equal((await f.verifier.auth.getSession()).data.session,null);
 assert.equal(JSON.stringify([...f.storage]).includes('test-password'),false);
});
test('SDK: contraseña incorrecta, identidad distinta o confirmación vacía no eliminan',async()=>{
 for(const options of [{password:'wrong'},{otherUser:true},{confirmation:''},{userId:'another-user'}]) {
  const f=await fixture(options);
  await assert.rejects(deleteOwnAccount(f.client,f.verifier,options.userId??userId,options.password??'test-password',options.confirmation??'Player'));
  assert.equal(f.requests.some(r=>r.path.includes('/rpc/')),false);
  assert.equal((await f.verifier.auth.getSession()).data.session,null);
 }
});
test('SDK: propaga fallo de eliminación, pero fallo del logout no cambia un éxito en error',async()=>{
 const failed=await fixture({deleteError:'P4002'});
 await assert.rejects(deleteOwnAccount(failed.client,failed.verifier,userId,'test-password','Player'),{code:'P4002'});
 const deleted=await fixture({logoutError:true});await deleteOwnAccount(deleted.client,deleted.verifier,userId,'test-password','Player');
 for(const code of ['P4001','P4002','P4003','invalid_credentials','session_expired','unexpected']) assert.equal(accountDeletionError({code,message:'Private details'}).includes('Private details'),false);
});
