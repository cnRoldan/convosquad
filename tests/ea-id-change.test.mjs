import assert from'node:assert/strict';import{test}from'node:test';import{Buffer}from'node:buffer';import{createClient}from'@supabase/supabase-js';import{changeOwnEaId}from'../src/features/auth/ea-id-change.ts';import{authErrorMessage}from'../src/features/auth/errors.ts';
const uid='98000000-0000-4000-8000-000000000001';const input={currentEaId:'Typo_Player',newEaId:' Correct_Player ',currentPassword:'fixture-password'};
function fixture(options={}){
 const requests=[],storage=new Map();let user={id:uid,email:'ea.typo_player@accounts.convosquad.invalid',aud:'authenticated',role:'authenticated',user_metadata:{username:'Typo_Player',login_type:'ea_id'},app_metadata:{},created_at:new Date().toISOString()};
 const token=name=>`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Date.now()/1000+3600})).toString('base64url')}.${name}`;
 const session=name=>({user:options.otherVerified&&name==='fresh'?{...user,id:'other-user'}:user,access_token:token(name),refresh_token:'fixture-'+name,token_type:'bearer',expires_in:3600});
 const fetch=async(url,init)=>{const u=new URL(url),body=JSON.parse(init.body||'{}'),authorization=new Headers(init.headers).get('authorization');requests.push({path:u.pathname,grant:u.searchParams.get('grant_type'),body,authorization});
  if(u.pathname==='/auth/v1/user')return Response.json(user);
  if(u.pathname==='/auth/v1/token'){
   if(u.searchParams.get('grant_type')==='refresh_token'){if(options.refreshFailure)return new Response(JSON.stringify({code:'refresh_token_not_found',msg:'private-detail'}),{status:400,headers:{'X-Supabase-Api-Version':'2024-01-01'}});return Response.json(session('refreshed'));}
   if(body.password!==input.currentPassword||body.email!==user.email)return new Response(JSON.stringify({code:'invalid_credentials',msg:'private-detail'}),{status:400,headers:{'X-Supabase-Api-Version':'2024-01-01'}});
   return Response.json(session('fresh'));
  }
  if(u.pathname==='/rest/v1/rpc/change_my_ea_id'){
   assert.match(authorization,/fresh$/);assert.deepEqual(body,{p_current_ea_id:'Typo_Player',p_new_ea_id:'Correct_Player'});
   if(options.rpcCode)return new Response(JSON.stringify({code:options.rpcCode,message:'private-detail'}),{status:409});
   user={...user,email:'ea.correct_player@accounts.convosquad.invalid',user_metadata:{...user.user_metadata,username:'Correct_Player'}};
   if(options.connectionLostAfterCommit)throw new TypeError('fixture connection lost');return Response.json('Correct_Player');
  }
  if(u.pathname==='/auth/v1/logout')return Response.json({});throw Error('Unexpected fixture request');
 };
 const client=createClient('https://auth.example.test','fixture-key',{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}},global:{fetch}});
 const verifier=createClient('https://auth.example.test','fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'rename-verifier'},global:{fetch}});
 return{client,verifier,requests,storage,getUser:()=>user,async login(){await client.auth.setSession(session('original'));requests.length=0;}};
}
test('SDK: verifies current password in an isolated session, calls RPC with fresh JWT and refreshes the original account',async()=>{
 const f=fixture();await f.login();const result=await changeOwnEaId(f.client,f.verifier,uid,input);assert.deepEqual(result,{eaId:'Correct_Player',sessionRefreshed:true});
 assert.equal(f.requests.find(r=>r.grant==='password').body.email,'ea.typo_player@accounts.convosquad.invalid');assert.equal((await f.client.auth.getSession()).data.session.user.user_metadata.username,'Correct_Player');assert.equal((await f.client.auth.getSession()).data.session.user.id,uid);assert.equal((await f.verifier.auth.getSession()).data.session,null);assert.equal(JSON.stringify([...f.storage]).includes(input.currentPassword),false);
 assert.equal(f.requests.filter(r=>r.path.endsWith('/change_my_ea_id')).length,1);assert.equal(f.requests.some(r=>r.body.email==='ea.correct_player@accounts.convosquad.invalid'&&r.grant==='password'),false);
});
test('wrong password, wrong account or invalid ID never reach the rename RPC',async()=>{
 for(const[options,patch,code]of[[{}, {currentPassword:'wrong'},'current_password_incorrect'],[{otherVerified:true},{},'session_expired'],[{}, {newEaId:'ab'},'invalid_ea_id'],[{}, {currentPassword:''},'current_password_required']]){const f=fixture(options);await f.login();await assert.rejects(changeOwnEaId(f.client,f.verifier,uid,{...input,...patch}),{code});assert.equal(f.requests.some(r=>r.path.endsWith('change_my_ea_id')),false);assert.equal(f.getUser().user_metadata.username,'Typo_Player');}
});
test('taken ID is rejected without replacing the app session and backend error text stays private',async()=>{
 const f=fixture({rpcCode:'P4102'});await f.login();await assert.rejects(changeOwnEaId(f.client,f.verifier,uid,input),{code:'P4102'});assert.equal((await f.client.auth.getSession()).data.session.user.user_metadata.username,'Typo_Player');assert.equal((await f.verifier.auth.getSession()).data.session,null);
 for(const code of['P4101','P4102','P4103','P4104','P4105','ea_id_change_uncertain','unknown'])assert.equal(authErrorMessage({code,message:'private-detail'},'ea-id').includes('private-detail'),false);
});
test('rename committed before connection loss is reconciled, and a refresh failure reports a saved ID rather than a failed rename',async()=>{
 for(const options of[{connectionLostAfterCommit:true},{refreshFailure:true}]){const f=fixture(options);await f.login();const result=await changeOwnEaId(f.client,f.verifier,uid,input);assert.equal(result.eaId,'Correct_Player');assert.equal(result.sessionRefreshed,!options.refreshFailure);assert.equal(f.getUser().user_metadata.username,'Correct_Player');assert.equal(f.requests.filter(r=>r.path.endsWith('change_my_ea_id')).length,1);}
});
