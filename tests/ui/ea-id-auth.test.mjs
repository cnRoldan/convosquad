import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

let browser, server, origin;
before(async () => {
  const root = path.resolve('dist-ui');
  server = createServer((req, res) => {
    let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) file = path.join(root, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(file + '.html') ? file + '.html' : path.join(root, 'index.html');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function fixture({ logoutFailure = false, deletionBlocked = false, deletionRace = false, confirmed = true, available = true, clubRole = null, creator = false, wrongPassword = false, failCrestUploadOnce = false, rosterTrials = false, failTrialContacts = false, performance = false, ratingFuture = false, ratingAgeHours = 1, multipleRatingCalls = false, ratingConflict = false, ratingsVisibility = 'captains', seedRatings = false, pendingJoinRequests = false, ratingAvailability = ['available', 'available'], browserLanguage = 'es-ES' } = {}) {
  const context = await browser.newContext({ locale: browserLanguage, viewport: { width: 390, height: 844 } });
  const userId = '00000000-0000-4000-8000-000000000901';
  const candidateId = '00000000-0000-4000-8000-000000000902';
  const club = { id: '00000000-0000-4000-8000-000000000903', name: 'Club de prueba', timezone: 'UTC', ratings_visibility: ratingsVisibility, created_by: creator ? userId : '00000000-0000-4000-8000-000000000904', reminder_minutes: null };
  const accounts = [
    { id: 'own', club_id: club.id, user_id: userId, role: clubRole, is_active: true, profiles: { username: 'EA-Player_9' } },
    { id: 'candidate', club_id: club.id, user_id: candidateId, role: 'player', is_active: true, profiles: { username: 'Candidate' } },
    { id: 'unlinked', club_id: club.id, user_id: '00000000-0000-4000-8000-000000000905', role: 'player', is_active: true, profiles: { username: 'SinFicha' } },
  ];
  const players = [userId, candidateId].map((user_id, i) => ({ id: `player-${i}`, club_id: club.id, user_id, ea_id: i ? 'Candidate' : 'EA-Player_9', category: 'backups', sort_order: i, jersey_number: i + 1, is_active: true }));
  if (clubRole) await context.addInitScript(({ userId }) => {
    if (sessionStorage.getItem('fixture-session-initialized')) return;
    sessionStorage.setItem('fixture-session-initialized','1');
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'ea.player@accounts.convosquad.invalid', user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() };
    const expires_at = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa('{}')}.${btoa(JSON.stringify({ sub: userId, exp: expires_at }))}.fixture`;
    localStorage.setItem('sb-auth-auth-token', JSON.stringify({ user, access_token: token, refresh_token: 'fixture', expires_at, expires_in: 3600, token_type: 'bearer' }));
  }, { userId });
  const trials = rosterTrials ? [
    {id: 'trial-one', club_id: club.id, ea_id: 'Prueba primera', status: 'active', sort_order: 0, created_at: '2026-10-16T12:00:00Z', notes: null, player_id: null},
    {id: 'trial-two', club_id: club.id, ea_id: 'Prueba segunda', status: 'active', sort_order: 1, created_at: '2026-10-16T12:00:00Z', notes: null, player_id: null},
    {id: 'trial-retired', club_id: club.id, ea_id: 'Prueba retirada', status: 'withdrawn', sort_order: 2, created_at: '2026-10-16T12:00:00Z', notes: null, player_id: null},
  ] : [];
  const channels = [];
  const joinRequests = pendingJoinRequests ? [{id:'00000000-0000-4000-8000-000000000921',club_id:club.id,user_id:candidateId,club_name_snapshot:club.name,status:'pending',profiles:{username:'Solicitante'},created_at:new Date().toISOString()}] : [];
  await context.routeWebSocket('**/realtime/v1/websocket*',socket=>{
    socket.onMessage(message=>{
      const raw=JSON.parse(String(message));
      const frame=Array.isArray(raw)?{join_ref:raw[0],ref:raw[1],topic:raw[2],event:raw[3],payload:raw[4]}:raw;
      function send(event,payload){const reply={join_ref:frame.join_ref,ref:frame.ref,topic:frame.topic,event,payload};socket.send(JSON.stringify(Array.isArray(raw)?[reply.join_ref,reply.ref,reply.topic,reply.event,reply.payload]:reply));}
      if(frame.event==='phx_join'){
        const bindings=frame.payload.config.postgres_changes.map((binding,index)=>({...binding,id:index+1}));channels.push({send,bindings});
        send('phx_reply',{status:'ok',response:{postgres_changes:bindings}});
      }else if(['heartbeat','phx_leave'].includes(frame.event))send('phx_reply',{status:'ok',response:{}});
    });
  });
  function emitRequest(event,record){
    for(const channel of channels){
      const binding=channel.bindings.find(binding=>binding.table==='join_requests'&&binding.event===event);
      if(binding)channel.send('postgres_changes',{ids:[binding.id],data:{schema:'public',table:'join_requests',type:event,columns:[],record,old_record:{},commit_timestamp:new Date().toISOString()}});
    }
  }
  const trialContacts = rosterTrials ? [{trial_id: 'trial-one', phone: '+34600000000'}] : [];
  const trialNotes = rosterTrials ? [{trial_id: 'trial-one', notes: 'Valoración privada del capitán'}] : [];
  let createdCall = null;
  const matchAt = new Date(Date.now() - 86400000).toISOString();
  const ratingCall = {id: '00000000-0000-4000-8000-000000000906', club_id: club.id, starts_at: matchAt, local_date: matchAt.slice(0,10),
    timezone: 'UTC', status: 'closed', ends_at: new Date(Date.now() + (ratingFuture ? 3600000 : -ratingAgeHours*3600000)).toISOString(), evaluation_at: new Date(Date.now() + (ratingFuture ? 3600000 : -ratingAgeHours*3600000)).toISOString(), closes_at: null};
  const ratingPlayers = players.map((player,index) => ({id: `rated-${index}`, club_id: club.id, call_up_id: ratingCall.id, source_player_id: player.id,
    user_id: player.user_id, ea_id_snapshot: player.ea_id, category_snapshot: player.category, sort_order_snapshot: index,
    availability: ratingAvailability[index], responded_at: matchAt, auto_response: false}));
  const ratings = seedRatings ? ratingPlayers.map((entry,index)=>({call_up_player_id:entry.id,call_up_id:ratingCall.id,club_id:club.id,player_id:entry.source_player_id,player_name:entry.ea_id_snapshot,score:index?4:8,not_selected:false,updated_at:matchAt})) : [];
  let preferredLanguage = null;
  let voteNotifications = true;
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAC0lEQVQImWNgQAcAABIAAW/6Y7cAAAAASUVORK5CYII=', 'base64');
  const page = await context.newPage(); const requests = []; const errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== 'auth.example.test') throw new Error('External request blocked');
    if (url.pathname.includes('/storage/v1/object/')) {
      if (req.method() === 'GET') return route.fulfill({contentType: 'image/png', body: transparentPng});
      if (url.pathname.includes('/object/sign/')) { requests.push({endpoint:'crest-sign',body:null}); return route.fulfill({json: {signedURL: `/object/sign/club-crests/${club.id}/crest.png?token=fixture`}}); }
      const bytes = req.postDataBuffer();
      requests.push({endpoint: 'crest-upload', body: {contentType: req.headers()['content-type'], pngSignature: bytes?.subarray(0,8).toString('hex'), bytes: bytes?.toString('base64')}});
      if (failCrestUploadOnce) { failCrestUploadOnce = false; return route.fulfill({status: 500, json: {message: 'Fixture upload failure'}}); }
      return route.fulfill({json: {Key: `club-crests/${club.id}/crest.png`}});
    }
    const endpoint = url.pathname.split('/').at(-1); const body = req.postData() ? req.postDataJSON() : null;
    requests.push({ endpoint, body, ...(endpoint === 'logout' ? { scope: url.searchParams.get('scope') } : {}) });
    if (endpoint === 'join_requests') {
      const rows=url.searchParams.has('user_id')?joinRequests.filter(row=>row.user_id===userId):clubRole==='admin'?joinRequests.filter(row=>row.status==='pending'&&row.club_id===club.id):[];
      return route.fulfill({json:rows});
    }
    if (endpoint === 'review_join_request') {
      assert.equal(clubRole,'admin');const row=joinRequests.find(row=>row.id===body.p_request_id);assert.equal(row.status,'pending');row.status=body.p_approve?'approved':'rejected';return route.fulfill({json:row});
    }
    if (endpoint === 'club_decision_locks') return route.fulfill({json: []});
    if (endpoint === 'create_club') { club.name = body.p_name; club.timezone = body.p_timezone; return route.fulfill({json: club}); }
    if (endpoint === 'set_club_crest') { club.crest_path = body.p_has_crest ? `${club.id}/crest.png` : null; return route.fulfill({json: club}); }
    if (endpoint === 'notification_preferences') return route.fulfill({ json: [{ vote_notifications: voteNotifications }] });
    if (endpoint === 'set_notification_preferences') { voteNotifications = body.p_vote_notifications; return route.fulfill({ json: { user_id: userId, vote_notifications: voteNotifications } }); }
    if (endpoint === 'create_call_up_with_end') {
      createdCall = {id: 'new-call', club_id: club.id, starts_at: body.p_starts_at, local_date: body.p_starts_at.slice(0,10), timezone: club.timezone,
        status: body.p_status, last_notice_at: body.p_last_notice_at ?? null, closes_at: body.p_closes_at ?? null, ends_at: body.p_ends_at, evaluation_at: body.p_ratings_enabled ? body.p_ends_at : null};
      return route.fulfill({json: createdCall});
    }
    if (endpoint === 'set_rating_visibility') { assert.equal(clubRole,'admin'); club.ratings_visibility=body.p_visibility; return route.fulfill({json:null}); }
    if (['list_rating_call_ups','get_player_performance','get_player_rating_history','save_player_ratings','player_ratings'].includes(endpoint)) {
      const visibleRatings = clubRole === 'admin' || club.ratings_visibility === 'members' ? ratings : club.ratings_visibility === 'self' ? ratings.filter(rating=>rating.player_id==='player-0') : [];
      if (['list_rating_call_ups','save_player_ratings'].includes(endpoint)) assert.equal(clubRole,'admin');
      else assert.ok(clubRole === 'admin' || club.ratings_visibility !== 'captains');
      if (endpoint === 'list_rating_call_ups') return route.fulfill({json: performance ? [...(multipleRatingCalls?[{...ratingCall,id:'older-call',ends_at:new Date(Date.parse(ratingCall.ends_at)-3600000).toISOString()}]:[]),ratingCall] : []});
      if (endpoint === 'player_ratings') return route.fulfill({json: visibleRatings});
      if (endpoint === 'save_player_ratings') {
        if (ratingConflict) return route.fulfill({status:409,json:{code:'40001',message:'Changed'}});
        for (const value of body.p_ratings) {
          const entry=ratingPlayers.find(player=>player.id===value.entry_id);
          const existing=ratings.findIndex(rating=>rating.call_up_player_id===entry.id);
          if (existing>=0) ratings.splice(existing,1);
          if (!value.clear) ratings.push({call_up_player_id:entry.id,call_up_id:ratingCall.id,club_id:club.id,player_id:entry.source_player_id,
            player_name:entry.ea_id_snapshot,score:value.not_selected?null:value.score,not_selected:Boolean(value.not_selected),updated_at:new Date().toISOString()});
        }
        return route.fulfill({json:body.p_ratings.length});
      }
      if (endpoint === 'get_player_performance') return route.fulfill({json: visibleRatings.map(rating=>({player_id:rating.player_id,player_name:rating.player_name,
        average_score:rating.score,rated_matches:rating.not_selected?0:1,not_selected_matches:rating.not_selected?1:0,last_match_at:ratingCall.starts_at}))});
      if (endpoint === 'get_player_rating_history') return route.fulfill({json:visibleRatings.filter(rating=>rating.player_id===body.p_player_id).map(rating=>({
        call_up_id:ratingCall.id,starts_at:ratingCall.starts_at,timezone:ratingCall.timezone,score:rating.score,not_selected:rating.not_selected,updated_at:rating.updated_at}))});
    }
    if (clubRole) {
      if (endpoint === 'club_trials') return route.fulfill({json: trials.filter(trial => url.searchParams.get('status') !== 'eq.active' || trial.status === 'active').sort((a,b) => a.sort_order - b.sort_order)});
      if (endpoint === 'club_trial_notes') {
        assert.equal(clubRole, 'admin');
        return route.fulfill({json: trialNotes});
      }
      if (endpoint === 'club_trial_contacts') {
        assert.equal(clubRole, 'admin');
        if (failTrialContacts) return route.fulfill({status: 400, json: {message: 'Contacts unavailable'}});
        return route.fulfill({json: trialContacts});
      }
      if (endpoint === 'save_club_trial_with_contact') {
        assert.equal(clubRole, 'admin');
        let trial = trials.find(row => row.id === body.p_trial_id);
        if (!trial) { trial = {id: 'trial-new', club_id: club.id, status: 'active', sort_order: trials.length, created_at: '2026-10-16T12:00:00Z'}; trials.push(trial); }
        Object.assign(trial, {ea_id: body.p_name, notes: null});
        const previousNote = trialNotes.findIndex(row => row.trial_id === trial.id);
        if (previousNote >= 0) trialNotes.splice(previousNote, 1);
        if (body.p_notes) trialNotes.push({trial_id: trial.id, notes: body.p_notes});
        const previous = trialContacts.findIndex(row => row.trial_id === trial.id);
        if (previous >= 0) trialContacts.splice(previous, 1);
        if (body.p_phone) trialContacts.push({trial_id: trial.id, phone: body.p_phone});
        return route.fulfill({json: trial});
      }
      if (endpoint === 'withdraw_trial') {
        assert.equal(clubRole, 'admin');
        const trial = trials.find(row => row.id === body.p_trial_id); trial.status = 'withdrawn';
        return route.fulfill({json: trial});
      }
      if (endpoint === 'reorder_trials') {
        body.p_ids.forEach((id, index) => { trials.find(row => row.id === id).sort_order = index; });
        return route.fulfill({json: null});
      }
      if (endpoint === 'clubs') {
        if (req.method() === 'PATCH') Object.assign(club, body);
        return route.fulfill({ json: req.headers().accept?.includes('object') ? club : [club] });
      }
      if (endpoint === 'club_members') return route.fulfill({ json: accounts });
      if (endpoint === 'players') return route.fulfill({ json: players });
      if (endpoint === 'call_ups') {
        const current = createdCall ?? (performance ? ratingCall : null);
        return route.fulfill({json:req.headers().accept?.includes('object') ? current : current ? [current] : []});
      }
      if (endpoint === 'call_up_players') return route.fulfill({json:performance ? ratingPlayers : []});
      if (['call_up_trials','call_up_aids'].includes(endpoint)) return route.fulfill({json:[]});
      if (['call_up_trial_notes','call_up_contacts'].includes(endpoint)) { assert.equal(clubRole,'admin'); return route.fulfill({json:[]}); }
      if (endpoint === 'set_club_member') {
        const account = accounts.find(row => row.user_id === body.p_user_id);
        account.role = body.p_role;
        return route.fulfill({ json: account });
      }
    }
    if (endpoint === 'account_deletion_blockers') return route.fulfill({json: deletionBlocked ? [{club_id:club.id,club_name:club.name}] : []});
    if (endpoint === 'delete_my_account') return route.fulfill(deletionRace
      ? {status:400,json:{code:'P4002',message:'Private server details'}} : {status:204});
    if (endpoint === 'settings') return route.fulfill({ json: { mailer_autoconfirm: confirmed, disable_signup: false } });
    if (endpoint === 'is_ea_id_available') return route.fulfill({ json: available });
    if (endpoint === 'user') return route.fulfill({ json: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'ea.player@accounts.convosquad.invalid', user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() } });
    if (endpoint === 'logout') return route.fulfill(logoutFailure ? { status: 503, json: { msg: 'Private server detail' } } : { json: {} });
    if (endpoint === 'token' && wrongPassword) return route.fulfill({ status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version' }, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } });
    if (endpoint === 'signup' || endpoint === 'token') {
      const user = { id: '00000000-0000-4000-8000-000000000901', aud: 'authenticated', role: 'authenticated', email: body.email, user_metadata: body.data ?? {}, app_metadata: {}, created_at: new Date().toISOString() };
      const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
      return route.fulfill({ json: { user, access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer' } });
    }
    if (endpoint === 'set_preferred_language') { preferredLanguage = body.p_language; return route.fulfill({json: null}); }
    if (endpoint === 'profiles') return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000901', username: 'EA-Player_9', preferred_language: preferredLanguage } });
    if (['clubs', 'club_members', 'search_clubs', 'join_requests', 'club_directory'].includes(endpoint)) return route.fulfill({ json: [] });
    throw new Error(`Unexpected fixture endpoint: ${endpoint}`);
  });
  return { page, requests, joinRequests, emitRequest, crestFixture: transparentPng, async close() { assert.deepEqual(errors, []); await context.close(); } };
}

test('registro móvil: dos campos, sesión inmediata y navegación a clubes sin confirmar correo', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/register`);
    assert.equal(await f.page.getByText('ID: EA-Player_9', { exact: true }).count(), 0);
    await f.page.getByLabel('ID de EA', { exact: true }).fill('EA-Player_9');
    await f.page.getByLabel('Contraseña', { exact: true }).fill('test-only-password');
    assert.equal(await f.page.getByLabel('Correo electrónico', { exact: true }).count(), 0);
    await f.page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await f.page.waitForURL('**/clubs*');
    await f.page.getByText('ID: EA-Player_9', { exact: true }).waitFor();
    assert.equal(f.requests.find(r => r.endpoint === 'signup').body.email, 'ea.ea-player_9@accounts.convosquad.invalid');
    assert.equal(f.requests.some(r => r.endpoint === 'recover'), false);
  } finally { await f.close(); }
});
test('registro muestra duplicados y configuración pendiente sin crear usuarios', async () => {
  for (const [options, message] of [[{ available: false }, 'Este ID de EA ya está registrado.'], [{ confirmed: false }, 'El registro por ID de EA todavía no está habilitado.']]) {
    const f = await fixture(options);
    try {
      await f.page.goto(`${origin}/register`);
      await f.page.getByLabel('ID de EA', { exact: true }).fill('EA-Player_9');
      await f.page.getByLabel('Contraseña', { exact: true }).fill('test-only-password');
      await f.page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
      await f.page.getByText(message, { exact: false }).waitFor();
      assert.equal(f.requests.some(r => r.endpoint === 'signup'), false);
    } finally { await f.close(); }
  }
});
test('login solo por ID de EA y ayuda manual sin formularios de correo', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/login`);
    await f.page.getByLabel('ID de EA', { exact: true }).waitFor();
    assert.equal(await f.page.getByRole('button', { name: 'He olvidado mi contraseña', exact: true }).count(), 0);
    assert.equal(await f.page.getByLabel('Correo electrónico', { exact: true }).count(), 0);
    assert.equal(await f.page.getByRole('button', { name: 'Tengo una cuenta anterior con correo', exact: true }).count(), 0);
    await f.page.getByLabel('ID de EA', { exact: true }).fill('EA-Player_9');
    await f.page.getByLabel('Contraseña', { exact: true }).fill('test-only-password');
    await f.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await f.page.waitForURL('**/clubs*');
    assert.equal(f.requests.find(r => r.endpoint === 'token').body.email, 'ea.ea-player_9@accounts.convosquad.invalid');
    await f.page.goto(`${origin}/recover`);
    await f.page.getByText('La recuperación se gestiona de forma manual.', { exact: false }).waitFor();
    assert.equal(await f.page.getByLabel('Correo electrónico', { exact: true }).count(), 0);
  } finally { await f.close(); }
});

test('capitán designa un jugador registrado, sin avisos globales ni eliminación de club', async () => {
  const f = await fixture({ clubRole: 'admin' });
  try {
    await f.page.goto(`${origin}/club-settings`);
    await f.page.getByText('ID: EA-Player_9', { exact: true }).waitFor();
    await f.page.getByRole('button', { name: 'Designar capitán a Candidate', exact: true }).waitFor();
    assert.equal(await f.page.getByRole('button', { name: 'Designar capitán a SinFicha', exact: true }).count(), 0);
    assert.equal(await f.page.getByRole('button', { name: 'Eliminar club', exact: true }).count(), 0);
    assert.equal(await f.page.getByRole('button', { name: 'Guardar avisos', exact: true }).count(), 0);
    await f.page.getByRole('button', { name: 'Designar capitán a Candidate', exact: true }).click();
    assert.equal(f.requests.some(r => r.endpoint === 'set_club_member'), false);
    await f.page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await f.page.getByRole('button', { name: 'Quitar capitanía a Candidate', exact: true }).waitFor();
    assert.equal(f.requests.find(r => r.endpoint === 'set_club_member').body.p_role, 'admin');
  } finally { await f.close(); }
});
test('solo el creador ve eliminación y un jugador no accede a la administración', async () => {
  const owner = await fixture({ clubRole: 'admin', creator: true });
  try {
    await owner.page.goto(`${origin}/club-settings`);
    await owner.page.getByRole('button', { name: 'Designar capitán a Candidate', exact: true }).waitFor();
    assert.equal(await owner.page.getByRole('button', { name: 'Eliminar club', exact: true }).count(), 0);
    await owner.page.goto(`${origin}/club-info`);
    await owner.page.getByRole('button', { name: 'Eliminar club', exact: true }).click();
    await owner.page.getByRole('button', { name: 'Eliminar definitivamente', exact: true }).waitFor();
    assert.equal(owner.requests.some(r => r.endpoint === 'delete_club'), false);
  } finally { await owner.close(); }
  const player = await fixture({ clubRole: 'player' });
  try {
    await player.page.goto(`${origin}/club-info`);
    await player.page.waitForURL('**/home');
    assert.equal(await player.page.getByRole('button', { name: 'Guardar avisos', exact: true }).count(), 0);
  } finally { await player.close(); }
});

test('cambiar contraseña desde clubes: validación, guardado y sesión original conservada', async () => {
  const f = await fixture({ clubRole: 'player' });
  try {
    await f.page.goto(`${origin}/clubs`);
    await f.page.getByRole('button', { name: 'Cambiar mi contraseña', exact: true }).click();
    const current = f.page.getByLabel('Contraseña actual', { exact: true });
    const next = f.page.getByLabel('Nueva contraseña', { exact: true });
    const confirmation = f.page.getByLabel('Confirmar nueva contraseña', { exact: true });
    assert.equal(await current.getAttribute('type'), 'password');
    await current.fill('old-fixture-password'); await next.fill('new-fixture-password'); await confirmation.fill('does-not-match');
    await f.page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
    await f.page.getByText('Las contraseñas nuevas no coinciden.', { exact: true }).waitFor();
    assert.equal(f.requests.some(r => r.endpoint === 'token'), false);
    await current.fill('old-fixture-password'); await next.fill('new-fixture-password'); await confirmation.fill('new-fixture-password');
    await f.page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
    await f.page.getByText('Contraseña actualizada.', { exact: false }).waitFor();
    const update = f.requests.find(r => r.endpoint === 'user' && r.body?.password);
    assert.equal(update.body.password, 'new-fixture-password');
    assert.equal(update.body.current_password, 'old-fixture-password');
    const session = await f.page.evaluate(() => JSON.parse(localStorage.getItem('sb-auth-auth-token')));
    assert.equal(session.user.id, '00000000-0000-4000-8000-000000000901');
    assert.equal(session.refresh_token, 'fixture');
    assert.equal(JSON.stringify(session).includes('new-fixture-password'), false);
    await f.page.getByRole('button', { name: 'Volver a mis clubes', exact: true }).click();
    await f.page.waitForURL('**/clubs');
  } finally { await f.close(); }
});
test('contraseña anterior incorrecta: error español, campos vacíos y ninguna actualización', async () => {
  const f = await fixture({ clubRole: 'player', wrongPassword: true });
  try {
    await f.page.goto(`${origin}/change-password`);
    await f.page.getByLabel('Contraseña actual', { exact: true }).fill('incorrect');
    await f.page.getByLabel('Nueva contraseña', { exact: true }).fill('new-fixture-password');
    await f.page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('new-fixture-password');
    await f.page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
    await f.page.getByText('La contraseña actual no es correcta.', { exact: true }).waitFor();
    assert.equal(await f.page.getByLabel('Contraseña actual', { exact: true }).inputValue(), '');
    assert.equal(f.requests.some(r => r.endpoint === 'user' && r.body?.password), false);
  } finally { await f.close(); }
});
test('cambiar contraseña exige iniciar sesión', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/change-password`);
    await f.page.waitForURL('**/login');
    assert.equal(f.requests.some(r => r.endpoint === 'token' || r.endpoint === 'user'), false);
  } finally { await f.close(); }
});

test('convocatoria mantiene inicio y cierre independientes, valida el último aviso y guarda cada hora', async () => {
  const f=await fixture({clubRole:'admin'});
  try {
    await f.page.goto(`${origin}/create-call-up`);
    const notice=f.page.getByLabel('Último aviso para votar (HH:mm)',{exact:true});
    assert.equal(await notice.inputValue(),'18:45');
    await f.page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).fill('2035-06-01');
    const start=f.page.getByLabel('Hora de convocatoria (HH:mm)',{exact:true});
    const closing=f.page.getByLabel('Hora de cierre de votación (HH:mm)',{exact:true});
    await start.fill('18:00');
    assert.equal(await closing.inputValue(),'19:00');
    await f.page.getByRole('button',{name:'Revisar convocatoria',exact:true}).click();
    await f.page.getByText('El último aviso debe ser anterior a la hora de la convocatoria.',{exact:true}).waitFor();
    assert.equal(f.requests.some(r=>r.endpoint==='create_call_up_with_end'),false);
    await closing.fill('20:45');
    await start.fill('22:15');
    assert.equal(await closing.inputValue(),'20:45');
    await closing.fill('21:00');
    assert.equal(await start.inputValue(),'22:15');
    await f.page.getByRole('button',{name:'Revisar convocatoria',exact:true}).click();
    await f.page.getByRole('button',{name:'Crear convocatoria',exact:true}).click();
    await f.page.waitForURL('**/call-up*');
    const request=f.requests.find(r=>r.endpoint==='create_call_up_with_end');
    assert.equal(request.body.p_last_notice_at,'2035-06-01T18:45:00.000Z');
    assert.equal(request.body.p_status,'open');
    assert.equal(request.body.p_starts_at,'2035-06-01T22:15:00.000Z');
    assert.equal(request.body.p_closes_at,'2035-06-01T21:00:00.000Z');
  }finally{await f.close();}
});
test('preferencia personal de votos se guarda sin pedir datos de otras cuentas',async()=>{
  const f=await fixture({clubRole:'player'});
  try{
    await f.page.goto(`${origin}/notifications`);
    const toggle=f.page.getByRole('switch',{name:'Avisarme cuando otro jugador vote',exact:true});
    await toggle.waitFor();
    await f.page.waitForFunction(()=>!document.querySelector('[role="switch"]').disabled);
    await toggle.click();
    await f.page.getByText('Preferencia guardada para todos tus dispositivos y clubes.',{exact:true}).waitFor();
    assert.deepEqual(f.requests.find(r=>r.endpoint==='set_notification_preferences').body,{p_vote_notifications:false});
    await f.page.reload();
    await f.page.getByRole('switch',{name:'Avisarme cuando otro jugador vote',exact:true,checked:false}).waitFor();
  }finally{await f.close();}
});

test('escudo PNG se selecciona, se convierte sin perder alfa y aparece junto al club y en cabecera', async () => {
  const f = await fixture({clubRole: 'admin'});
  try {
    const {page} = f;
    await page.goto(`${origin}/club-info`);
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', {name: 'Añadir escudo (opcional)', exact: true}).click();
    const chooser = await chooserPromise;
    // PNG transparente de dos píxeles por lado, sin datos externos.
    await chooser.setFiles({name: 'escudo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAC0lEQVQImWNgQAcAABIAAW/6Y7cAAAAASUVORK5CYII=','base64')});
    await page.getByRole('img', {name: 'Vista previa del escudo', exact: true}).waitFor();
    await page.getByRole('button', {name: 'Guardar escudo', exact: true}).click();
    await page.getByText('Escudo actualizado.', {exact: true}).waitFor();
    const upload = f.requests.find(request => request.endpoint === 'crest-upload');
    assert.equal(upload.body.contentType, 'image/png');
    assert.equal(upload.body.pngSignature, '89504e470d0a1a0a');
    const alpha = await page.evaluate(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, 1, 1).data[3];
    }, upload.body.bytes);
    assert.equal(alpha, 0, 'PNG transparency must survive conversion and upload');
    const crestCard = page.getByText('Escudo del club', {exact: true}).locator('..');
    const currentCrest = crestCard.getByRole('img', {name: 'Escudo de Club de prueba', exact: true});
    await currentCrest.waitFor();
    const crestBox = await currentCrest.boundingBox();
    const cardBox = await crestCard.boundingBox();
    assert.equal(crestBox.width, 160); assert.equal(crestBox.height, 160);
    assert.ok(Math.abs(crestBox.x + crestBox.width / 2 - cardBox.x - cardBox.width / 2) < 1);
    assert.equal(await crestCard.getByRole('button', {name: 'Añadir escudo (opcional)', exact: true}).count(), 0);
    const replacementChooser = page.waitForEvent('filechooser');
    await crestCard.getByRole('button', {name: 'Cambiar escudo', exact: true}).click();
    await (await replacementChooser).setFiles({name: 'nuevo-escudo.png', mimeType: 'image/png', buffer: f.crestFixture});
    await crestCard.getByRole('img', {name: 'Vista previa del escudo', exact: true}).waitFor();
    assert.equal(await crestCard.getByRole('img').count(), 1, 'La vista previa sustituye al escudo actual');
    const previewBox = await crestCard.getByRole('img').boundingBox();
    assert.equal(previewBox.width, 160);
    assert.ok(Math.abs(previewBox.x + previewBox.width / 2 - cardBox.x - cardBox.width / 2) < 1);
    await page.getByRole('button', {name: 'Guardar escudo', exact: true}).click();
    await currentCrest.waitFor();
    assert.equal(await crestCard.getByRole('img').count(), 1);
    assert.equal(f.requests.filter(request => request.endpoint === 'crest-upload').length, 2);
    await crestCard.getByRole('button', {name: 'Cambiar escudo', exact: true}).waitFor();

    await page.goto(`${origin}/clubs`);
    const cardImage = page.getByRole('img', {name: 'Escudo de Club de prueba', exact: true});
    await cardImage.waitFor();
    const imageBox = await cardImage.boundingBox(); const nameBox = await page.getByText('Club de prueba', {exact: true}).boundingBox();
    assert.ok(imageBox.x > nameBox.x);
    await page.getByRole('button', {name: 'Entrar al club', exact: true}).click();
    const headerImage = page.getByRole('img', {name: 'Escudo de Club de prueba', exact: true}); await headerImage.waitFor();
    const headerBox = await headerImage.boundingBox(); assert.equal(headerBox.width, 32); assert.ok(headerBox.x < 60);
  } finally { await f.close(); }
});

test('crear club con escudo permite reintentar una subida fallida sin duplicar el club', async () => {
  const f = await fixture({clubRole: 'admin', failCrestUploadOnce: true});
  try {
    const {page} = f;
    await page.goto(`${origin}/create-club`);
    await page.getByRole('textbox', {name: 'Nombre del club', exact: true}).fill('Club con escudo');
    const choosing = page.waitForEvent('filechooser');
    await page.getByRole('button', {name: 'Añadir escudo (opcional)', exact: true}).click();
    await (await choosing).setFiles({name: 'escudo.png', mimeType: 'image/png', buffer: f.crestFixture});
    await page.getByRole('img', {name: 'Vista previa del escudo', exact: true}).waitFor();
    await page.getByRole('button', {name: 'Crear club', exact: true}).click();
    await page.getByText(/El club ya está creado, pero falta completar el escudo/).waitFor();
    assert.equal(f.requests.filter(request => request.endpoint === 'create_club').length, 1);
    await page.getByRole('button', {name: 'Entrar al club creado', exact: true}).click();
    await page.waitForURL('**/home');
    assert.equal(f.requests.filter(request => request.endpoint === 'create_club').length, 1);
    assert.equal(f.requests.filter(request => request.endpoint === 'crest-upload').length, 2);
    await page.getByRole('img', {name: 'Escudo de Club con escudo', exact: true}).waitFor();
  } finally { await f.close(); }
});

test('crear club usa selector con GMT y Madrid por defecto, admite Canarias y Reino Unido', async () => {
  for (const timezone of ['Europe/Madrid', 'Atlantic/Canary', 'Europe/London']) {
    const f = await fixture({clubRole: 'admin'});
    try {
      const {page} = f;
      await page.goto(`${origin}/create-club`);
      const picker = page.getByRole('combobox', {name: 'Zona horaria', exact: true});
      await picker.waitFor();
      assert.equal(await picker.inputValue(), 'Europe/Madrid');
      assert.equal(await page.getByRole('textbox', {name: 'Zona horaria', exact: true}).count(), 0);
      assert.match(await picker.locator('option:checked').textContent(), /Madrid.*GMT/);
      await picker.selectOption(timezone);
      await page.getByRole('textbox', {name: 'Nombre del club', exact: true}).fill('Club horario');
      await page.getByRole('button', {name: 'Crear club', exact: true}).click();
      await page.waitForURL('**/home');
      assert.equal(f.requests.find(request => request.endpoint === 'create_club').body.p_timezone, timezone);
    } finally { await f.close(); }
  }
});


test('editar información desde inicio: nombre, descripción, visibilidad y zona; capitán sin eliminación', async () => {
  const f = await fixture({ clubRole: 'admin' });
  try {
    await f.page.goto(`${origin}/home`);
    await f.page.getByRole('button', { name: 'Editar información', exact: true }).click();
    await f.page.getByLabel('Nombre del club', { exact: true }).fill('Nuevo nombre');
    await f.page.getByLabel('Descripción (opcional)', { exact: true }).fill('Nueva descripción');
    await f.page.getByLabel('Zona horaria', { exact: true }).selectOption('Atlantic/Canary');
    await f.page.getByRole('switch', { name: 'Mostrar el club en el buscador público', exact: true }).click();
    await f.page.getByRole('button', { name: 'Guardar información', exact: true }).click();
    await f.page.getByText('Información del club actualizada.', { exact: true }).waitFor();
    assert.deepEqual(f.requests.find(r => r.endpoint === 'clubs' && r.body).body, {
      name: 'Nuevo nombre', description: 'Nueva descripción', timezone: 'Atlantic/Canary', is_public: true,
    });
    assert.equal(await f.page.getByRole('button', { name: 'Eliminar club', exact: true }).count(), 0);
    await f.page.getByLabel('Nombre del club', { exact: true }).fill(' ');
    await f.page.getByRole('button', { name: 'Guardar información', exact: true }).click();
    await f.page.getByText('El nombre debe tener entre 2 y 80 caracteres.', { exact: true }).waitFor();
    assert.equal(f.requests.filter(r => r.endpoint === 'clubs' && r.body).length, 1);
  } finally { await f.close(); }
});


test('plantilla: capitanes ordenan, abren WhatsApp y retiran pruebas con confirmación', async () => {
  const f = await fixture({clubRole: 'admin', rosterTrials: true});
  try {
    const {page} = f;
    await page.goto(`${origin}/roster`);
    const edit = page.getByRole('button', {name: 'Editar prueba de Prueba primera', exact: true});
    await edit.waitFor();
    const actions = edit.locator('..');
    assert.equal(await actions.getByRole('button').count(), 5);
    for (const action of await actions.getByRole('button').all()) {
      const box = await action.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
      const editBox = await edit.boundingBox(); assert.equal(box.y, editBox.y);
    }
    assert.equal(await page.getByText('Prueba retirada', {exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Subir prueba de Prueba primera', exact: true}).getAttribute('aria-disabled'), 'true');
    assert.equal(await page.getByRole('button', {name: 'Bajar prueba de Prueba segunda', exact: true}).getAttribute('aria-disabled'), 'true');
    await page.getByRole('button', {name: 'Bajar prueba de Prueba primera', exact: true}).click();
    await page.getByRole('button', {name: 'Bajar prueba de Prueba primera', exact: true, disabled: true}).waitFor();
    assert.deepEqual(f.requests.find(r => r.endpoint === 'reorder_trials').body.p_ids, ['trial-two', 'trial-one']);
    await page.evaluate(() => { window.open = url => { window.__trialWhatsapp = String(url); return null; }; });
    await page.getByRole('button', {name: 'WhatsApp de Prueba primera', exact: true, disabled: false}).click();
    await page.waitForFunction(() => window.__trialWhatsapp === 'https://wa.me/34600000000');
    assert.equal(await page.getByRole('button', {name: 'WhatsApp de Prueba segunda', exact: true}).getAttribute('aria-disabled'), 'true');
    await page.getByRole('button', {name: 'Quitar prueba de Prueba primera', exact: true}).click();
    assert.equal(f.requests.some(r => r.endpoint === 'withdraw_trial'), false);
    await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
    assert.equal(f.requests.some(r => r.endpoint === 'withdraw_trial'), false);
    await page.getByRole('button', {name: 'Quitar prueba de Prueba primera', exact: true}).click();
    await page.getByRole('button', {name: 'Quitar prueba', exact: true}).click();
    await page.getByText('Prueba retirada de la plantilla. Las convocatorias anteriores conservan sus datos.', {exact: true}).waitFor();
    await page.getByText('Prueba primera', {exact: true}).waitFor({state: 'detached'});
    assert.equal(f.requests.filter(r => r.endpoint === 'withdraw_trial').length, 1);
  } finally { await f.close(); }
});

test('plantilla: jugadores no reciben teléfonos ni acciones de gestión de pruebas', async () => {
  const f = await fixture({clubRole: 'player', rosterTrials: true});
  try {
    await f.page.goto(`${origin}/roster`);
    await f.page.getByText('Prueba primera', {exact: true}).waitFor();
    assert.equal(f.requests.some(r => r.endpoint === 'club_trial_contacts' || r.endpoint === 'club_trial_notes'), false);
    assert.equal(await f.page.getByText('Valoración privada del capitán', {exact: true}).count(), 0);
    assert.equal(await f.page.getByRole('button', {name: /WhatsApp de Prueba|Quitar prueba de|Editar prueba de|Subir prueba de/}).count(), 0);
    assert.equal(await f.page.getByText('Prueba retirada', {exact: true}).count(), 0);
  } finally { await f.close(); }
});


test('idioma junto al ID cambia en modal, se conserva al recargar y no cambia nombres del club', async () => {
 const f=await fixture({clubRole:'admin'});
 try {
  const {page}=f;await page.goto(`${origin}/home`);
  const languageButton = page.getByRole('button',{name:'Cambiar idioma',exact:true});
  await languageButton.waitFor();
  assert.equal(await languageButton.locator('svg').count(), 1);
  assert.equal((await languageButton.textContent()).trim(), '');
  await languageButton.click();
  for (const name of ['Español', 'English', 'Deutsch', 'Français']) {
    assert.equal(await page.getByRole('radio',{name,exact:true}).locator('svg').count(), 1);
  }
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
  await page.screenshot({path: 'test-results/language-flags.png'});
  await page.getByRole('radio',{name:'English',exact:true}).click();
  await page.getByRole('button',{name:'Edit information',exact:true}).waitFor();
  await page.getByText('Club de prueba',{exact:true}).waitFor();
  assert.equal(f.requests.filter(r=>r.endpoint==='set_preferred_language').at(-1).body.p_language,'en');
  await page.reload();await page.getByRole('button',{name:'Change language',exact:true}).click();
  await page.getByRole('radio',{name:'Deutsch',exact:true}).click();
  await page.getByRole('button',{name:'Sprache ändern',exact:true}).click();
  await page.getByRole('radio',{name:'Français',exact:true}).click();
  await page.getByRole('button',{name:'Changer de langue',exact:true}).waitFor();
  await page.getByText('Club de prueba',{exact:true}).waitFor();
 }finally{await f.close();}
});

test('escudos reutilizan URL al navegar y se invalidan al guardar una sustitución', async () => {
 const f=await fixture({clubRole:'admin'});
 try {
  const {page}=f;await page.goto(`${origin}/home`);await page.getByRole('button',{name:'Editar información',exact:true}).click();
  const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Añadir escudo (opcional)',exact:true}).click();
  await (await choosing).setFiles({name:'escudo.png',mimeType:'image/png',buffer:f.crestFixture});
  await page.getByRole('button',{name:'Guardar escudo',exact:true}).click();await page.getByText('Escudo actualizado.',{exact:true}).waitFor();
  await page.getByRole('img',{name:/Club de prueba/}).last().waitFor();
  const signedBefore=f.requests.filter(r=>r.endpoint==='crest-sign').length;
  await page.goBack();await page.getByRole('img',{name:/Club de prueba/}).waitFor();
  await page.getByRole('button',{name:'Cambiar idioma',exact:true}).click();
  await page.getByRole('radio',{name:'English',exact:true}).click();
  await page.getByRole('tab',{name:'Roster',exact:true}).click();await page.getByRole('img',{name:/Club de prueba/}).waitFor();
  assert.equal(f.requests.filter(r=>r.endpoint==='crest-sign').length,signedBefore);
 }finally{await f.close();}
});


test('gestionar prueba: carga teléfono privado y guarda con prefijo normalizado para WhatsApp', async () => {
  const f = await fixture({clubRole: 'admin', rosterTrials: true});
  try {
    const {page} = f;
    await page.goto(`${origin}/roster`);
    await page.getByRole('button', {name: 'Editar prueba de Prueba primera', exact: true}).click();
    const phone = page.getByLabel('Teléfono de la prueba (solo capitanes, opcional)', {exact: true});
    await phone.waitFor(); assert.equal(await phone.inputValue(), '+34600000000');
    assert.equal(await page.getByLabel('Observaciones', {exact: true}).inputValue(), 'Valoración privada del capitán');
    await page.getByText('Solo los capitanes pueden ver estas observaciones.', {exact: true}).waitFor();
    await page.getByLabel('Observaciones', {exact: true}).fill('Seguir observando');
    await page.getByText('Solo los capitanes pueden ver este número.', {exact: true}).waitFor();
    await phone.fill('666666666');
    await page.getByRole('button', {name: 'Guardar prueba', exact: true}).click();
    await page.getByText('Introduce el teléfono con prefijo internacional, por ejemplo +34 612 345 678.', {exact: true}).waitFor();
    assert.equal(f.requests.some(r => r.endpoint === 'save_club_trial_with_contact'), false);
    await phone.fill('+34 612 345 678');
    await page.getByRole('button', {name: 'Guardar prueba', exact: true}).click();
    await page.getByRole('button', {name: 'WhatsApp de Prueba primera', exact: true, disabled: false}).waitFor();
    assert.equal(f.requests.find(r => r.endpoint === 'save_club_trial_with_contact').body.p_phone, '+34612345678');
    assert.equal(f.requests.find(r => r.endpoint === 'save_club_trial_with_contact').body.p_notes, 'Seguir observando');
    await page.getByText('Seguir observando', {exact: true}).filter({visible: true}).waitFor();
    await page.evaluate(() => { window.open = url => { window.__trialWhatsapp = String(url); return null; }; });
    await page.getByRole('button', {name: 'WhatsApp de Prueba primera', exact: true, disabled: false}).click();
    await page.waitForFunction(() => window.__trialWhatsapp === 'https://wa.me/34612345678');
  } finally { await f.close(); }
});

test('nueva prueba admite teléfono opcional; fallo al cargar contacto impide sobrescribirlo', async () => {
  const f = await fixture({clubRole: 'admin'});
  try {
    await f.page.goto(`${origin}/roster`);
    await f.page.getByRole('button', {name: 'Añadir prueba', exact: true}).click();
    await f.page.getByLabel('Nombre de la prueba', {exact: true}).fill('Nueva prueba');
    await f.page.getByLabel('Teléfono de la prueba (solo capitanes, opcional)', {exact: true}).fill('+44 7000 000000');
    await f.page.getByRole('button', {name: 'Guardar prueba', exact: true}).click();
    await f.page.getByRole('button', {name: 'WhatsApp de Nueva prueba', exact: true, disabled: false}).waitFor();
    assert.equal(f.requests.find(r => r.endpoint === 'save_club_trial_with_contact').body.p_phone, '+447000000000');
  } finally { await f.close(); }
  const failed = await fixture({clubRole: 'admin', rosterTrials: true, failTrialContacts: true});
  try {
    await failed.page.goto(`${origin}/roster`);
    await failed.page.getByRole('button', {name: 'Editar prueba de Prueba primera', exact: true}).click();
    await failed.page.getByRole('button', {name: 'Volver a la plantilla', exact: true}).waitFor();
    assert.equal(await failed.page.getByRole('button', {name: 'Guardar prueba', exact: true}).count(), 0);
    assert.equal(failed.requests.some(r => r.endpoint === 'save_club_trial_with_contact'), false);
  } finally { await failed.close(); }
});


test('valoraciones: capitán guarda cero y No convocado, consulta media e historial privados', async()=>{
  const f=await fixture({clubRole:'admin',performance:true});
  try {
    const {page}=f;await page.goto(`${origin}/home`);
    await page.getByRole('button',{name:'Valoraciones y rendimiento',exact:true}).click();
    await page.getByRole('button',{name:/^Valorar convocatoria del /}).click();
    await page.getByText('Solo los capitanes del club pueden ver estas valoraciones.',{exact:true}).filter({visible:true}).waitFor();
    await page.getByLabel('Valoración de EA-Player_9',{exact:true}).selectOption('0');
    await page.getByLabel('Valoración de Candidate',{exact:true}).selectOption('not_selected');
    await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).click();
    await page.getByText('Valoraciones guardadas.',{exact:true}).waitFor();
    const saved=f.requests.find(request=>request.endpoint==='save_player_ratings');
    assert.equal(saved.body.p_ratings[0].score,0);assert.equal(saved.body.p_ratings[1].not_selected,true);
    assert.equal(saved.body.p_ratings[0].expected_updated_at,null);
    assert.equal(await page.getByLabel('Valoración de EA-Player_9',{exact:true}).inputValue(),'0');
    await page.getByRole('button',{name:'Ver rendimiento del club',exact:true}).click();
    await page.getByText('Media: 0 / 10',{exact:true}).filter({visible:true}).waitFor();
    await page.getByText('Sin media',{exact:true}).filter({visible:true}).waitFor();
    await page.getByRole('button',{name:'Ver historial de EA-Player_9',exact:true}).click();
    await page.getByText(/ · 0 \/ 10$/).filter({visible:true}).waitFor();
    await page.screenshot({path:'test-results/player-performance.png'});
  } finally {await f.close();}
});
test('valoraciones: hora futura bloquea notas y jugadores no entran a la gestión',async()=>{
  const f=await fixture({clubRole:'admin',performance:true,ratingFuture:true});
  try {
    await f.page.goto(`${origin}/home`);await f.page.getByRole('button',{name:'Valoraciones y rendimiento',exact:true}).click();
    assert.equal(await f.page.getByRole('button',{name:/^Valorar convocatoria del /}).count(),0);
    await f.page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
    await f.page.getByText('Solo puedes valorar la última convocatoria finalizada durante las 24 horas siguientes a su finalización.',{exact:true}).waitFor();
    assert.equal(await f.page.getByLabel('Valoración de EA-Player_9',{exact:true}).isDisabled(),true);
    assert.equal(f.requests.some(request=>request.endpoint==='save_player_ratings'),false);
  } finally {await f.close();}
  const player=await fixture({clubRole:'player',performance:true});
  try {
    await player.page.goto(`${origin}/performance`);await player.page.getByRole('button',{name:'Ver plantilla',exact:true}).waitFor();
    assert.equal(player.requests.some(request=>['get_player_performance','list_rating_call_ups','player_ratings'].includes(request.endpoint)),false);
    assert.equal(await player.page.getByRole('button',{name:'Valoraciones y rendimiento',exact:true}).count(),0);
  } finally {await player.close();}
});
test('valoraciones: solo disponibles inicialmente; añadir un suplente conserva su voto y su nota al recargar',async()=>{
  const f=await fixture({clubRole:'admin',performance:true,ratingAvailability:['available','backup']});
  try {
    const {page}=f;await page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
    await page.getByLabel('Valoración de EA-Player_9',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Valoración de Candidate',{exact:true}).count(),0);
    await page.getByLabel('Valoración de EA-Player_9',{exact:true}).selectOption('8');
    await page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Añadir a la valoración',exact:true}).isDisabled(),true);
    const picker=page.getByLabel('Jugador que añadir a la valoración',{exact:true});
    assert.deepEqual(await picker.locator('option').allTextContents(),['Selecciona un jugador','Candidate']);
    await picker.selectOption('rated-1');
    await page.getByRole('button',{name:'Añadir a la valoración',exact:true}).click();
    assert.equal(await page.getByLabel('Valoración de EA-Player_9',{exact:true}).inputValue(),'8');
    assert.equal(await page.getByLabel('Valoración de Candidate',{exact:true}).inputValue(),'');
    assert.equal(f.requests.some(r=>r.endpoint==='save_player_ratings'),false);
    assert.equal(await page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).count(),0);
    await page.getByLabel('Valoración de Candidate',{exact:true}).selectOption('7');
    await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).click();
    await page.getByText('Valoraciones guardadas.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Valoración de Candidate',{exact:true}).inputValue(),'7');
    assert.deepEqual(f.requests.find(r=>r.endpoint==='save_player_ratings').body.p_ratings.map(r=>[r.entry_id,r.score]),[['rated-0',8],['rated-1',7]]);
    await page.reload();
    await page.getByLabel('Valoración de Candidate',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Valoración de Candidate',{exact:true}).inputValue(),'7');
    assert.equal(f.requests.some(r=>['respond_to_call_up','refresh_call_up_roster'].includes(r.endpoint)),false);
  } finally {await f.close();}
});
test('valoraciones: sin disponibles se puede añadir manualmente a quien no respondió o no estaba disponible',async()=>{
  const f=await fixture({clubRole:'admin',performance:true,ratingAvailability:['unavailable','unanswered']});
  try {
    const {page}=f;await page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
    await page.getByText('No hay jugadores que valorar.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    await page.getByLabel('Jugador que añadir a la valoración',{exact:true}).selectOption('rated-1');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal(await page.getByLabel('Valoración de Candidate',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    const picker=page.getByLabel('Jugador que añadir a la valoración',{exact:true});
    assert.equal(await picker.inputValue(),'');
    await picker.selectOption('rated-0');
    await page.getByRole('button',{name:'Añadir a la valoración',exact:true}).click();
    await page.getByLabel('Valoración de EA-Player_9',{exact:true}).selectOption('0');
    await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).click();
    await page.getByText('Valoraciones guardadas.',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Valoración de EA-Player_9',{exact:true}).inputValue(),'0');
    assert.equal(await page.getByLabel('Valoración de Candidate',{exact:true}).count(),0);
    assert.equal(f.requests.find(r=>r.endpoint==='save_player_ratings').body.p_ratings.length,1);
  } finally {await f.close();}
});
test('valoraciones: conserva notas previas de no disponibles y bloquea añadir antes de la hora programada',async()=>{
  const saved=await fixture({clubRole:'admin',performance:true,ratingAvailability:['unavailable','unanswered'],seedRatings:true});
  try {
    await saved.page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
    await saved.page.getByLabel('Valoración de Candidate',{exact:true}).waitFor();
    assert.equal(await saved.page.getByLabel('Valoración de Candidate',{exact:true}).inputValue(),'4');
    assert.equal(await saved.page.getByLabel('Valoración de EA-Player_9',{exact:true}).inputValue(),'8');
  } finally {await saved.close();}
  const future=await fixture({clubRole:'admin',performance:true,ratingAvailability:['available','backup'],ratingFuture:true});
  try {
    await future.page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
    await future.page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true,disabled:true}).waitFor();
    assert.equal(future.requests.some(r=>r.endpoint==='save_player_ratings'),false);
  } finally {await future.close();}
});
test('crear convocatoria programa finalización tras medianoche y activa las valoraciones por defecto',async()=>{
  const f=await fixture({clubRole:'admin'});
  try {
    const {page}=f;await page.goto(`${origin}/create-call-up`);
    await page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).fill('2038-01-10');
    assert.equal(await page.getByRole('switch',{name:'Habilitar valoración de jugadores',exact:true}).isChecked(),true);
    assert.equal(await page.getByLabel('Hora de finalización (HH:mm)',{exact:true}).inputValue(),'00:00');
    assert.equal(await page.getByLabel('Hora de valoración (HH:mm)',{exact:true}).count(),0);
    await page.getByLabel('Hora de finalización (HH:mm)',{exact:true}).fill('01:00');
    await page.getByRole('button',{name:'Revisar convocatoria',exact:true}).click();
    await page.getByRole('button',{name:'Crear convocatoria',exact:true}).click();
    await page.waitForURL('**/call-up*');
    assert.equal(f.requests.find(request=>request.endpoint==='create_call_up_with_end').body.p_ends_at,'2038-01-11T01:00:00.000Z');
  } finally {await f.close();}
});


test('visibilidad: por defecto privada, capitán puede compartir y el modo personal filtra las notas',async()=>{
  const captain=await fixture({clubRole:'admin',performance:true});
  try {
    const {page}=captain;await page.goto(`${origin}/home`);await page.getByRole('button',{name:'Valoraciones y rendimiento',exact:true}).click();
    await page.getByRole('button',{name:'Todos los miembros del club',exact:true}).click();
    await page.getByRole('button',{name:'Guardar visibilidad',exact:true}).click();
    await page.getByText('Los miembros del club pueden ver las valoraciones.',{exact:true}).waitFor();
    assert.equal(captain.requests.find(request=>request.endpoint==='set_rating_visibility').body.p_visibility,'members');
  } finally {await captain.close();}
  for (const visibility of ['self','members']) {
    const f=await fixture({clubRole:'player',performance:true,ratingsVisibility:visibility,seedRatings:true});
    try {
      const {page}=f;await page.goto(`${origin}/home`);await page.getByRole('button',{name:'Ver rendimiento del club',exact:true}).click();
      await page.getByText('Media: 8 / 10',{exact:true}).waitFor();
      assert.equal(await page.getByText('Media: 4 / 10',{exact:true}).count(),visibility==='self'?0:1);
      assert.equal(await page.getByRole('button',{name:'Guardar visibilidad',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:/^Valorar convocatoria del /}).count(),0);
    } finally {await f.close();}
  }
});


test('eliminar cuenta: confirmación cancelable, contraseña y cierre de sesión sin modificar a otros',async()=>{
 const f=await fixture({clubRole:'player'});
 try {
  await f.page.goto(`${origin}/clubs`);
  await f.page.getByRole('button',{name:'Eliminar mi cuenta',exact:true}).click();
  await f.page.getByText('Cuenta: EA-Player_9',{exact:true}).waitFor();
  const remove=f.page.getByRole('button',{name:'Eliminar mi cuenta',exact:true});
  assert.equal(await remove.getAttribute('aria-disabled'),'true');
  await f.page.getByLabel('Contraseña actual',{exact:true}).fill('test-only-password');
  await f.page.getByLabel('Escribe tu ID de EA para confirmar',{exact:true}).fill('EA-Player_9');
  await remove.click();
  await f.page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(f.requests.some(r=>r.endpoint==='delete_my_account'),false);
  await remove.click();
  await f.page.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();
  await f.page.getByText('Tu cuenta y sus datos vinculados se han eliminado. Se ha cerrado tu sesión.',{exact:true}).waitFor();
  assert.deepEqual(f.requests.filter(r=>r.endpoint==='delete_my_account').map(r=>r.body),[{p_confirmation:'EA-Player_9'}]);
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('sb-auth-auth-token')),null);
  await f.page.reload();
  await f.page.getByRole('button',{name:'Iniciar sesión para eliminar mi cuenta',exact:true}).waitFor();
 } finally {await f.close();}
});
test('eliminar cuenta: último capitán, contraseña incorrecta y cambio de permisos impiden anunciar éxito',async()=>{
 for(const options of [{deletionBlocked:true},{wrongPassword:true},{deletionRace:true}]) {
  const f=await fixture({clubRole:'admin',...options});
  try {
   await f.page.goto(`${origin}/delete-account`);
   await f.page.getByText('Cuenta: EA-Player_9',{exact:true}).waitFor();
   if(options.deletionBlocked) {
    await f.page.getByText('Antes de eliminar tu cuenta',{exact:true}).waitFor();
    assert.equal(await f.page.getByRole('button',{name:'Eliminar mi cuenta',exact:true}).count(),0);
    await f.page.getByRole('button',{name:'Club de prueba',exact:true}).click();
    await f.page.waitForURL('**/home');
   } else {
    await f.page.getByLabel('Contraseña actual',{exact:true}).fill('test-only-password');
    await f.page.getByLabel('Escribe tu ID de EA para confirmar',{exact:true}).fill('EA-Player_9');
    await f.page.getByRole('button',{name:'Eliminar mi cuenta',exact:true}).click();
    await f.page.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();
    await f.page.getByText(options.wrongPassword ? 'Introduce tu contraseña actual correctamente.' : 'Eres el único capitán de un club. Nombra a otro capitán o elimina ese club antes de borrar tu cuenta.',{exact:true}).waitFor();
    assert.equal(await f.page.getByText('Tu cuenta y sus datos vinculados se han eliminado. Se ha cerrado tu sesión.',{exact:true}).count(),0);
   }
   if(!options.deletionRace) assert.equal(f.requests.some(r=>r.endpoint==='delete_my_account'),false);
  } finally {await f.close();}
 }
});
test('página pública de eliminación permite autenticarse sin instalar la app y no borra al iniciar sesión',async()=>{
 const f=await fixture();
 try {
  await f.page.goto(`${origin}/delete-account`);
  await f.page.getByText('Puedes eliminar tu cuenta desde esta página, sin tener la app instalada.',{exact:true}).waitFor();
  await f.page.getByLabel('ID de EA',{exact:true}).fill('EA-Player_9');
  await f.page.getByLabel('Contraseña',{exact:true}).fill('test-only-password');
  await f.page.getByRole('button',{name:'Iniciar sesión para eliminar mi cuenta',exact:true}).click();
  await f.page.getByText('Cuenta: EA-Player_9',{exact:true}).waitFor();
  assert.ok(f.page.url().endsWith('/delete-account'));
  assert.equal(f.requests.some(r=>r.endpoint==='delete_my_account'),false);
  await f.page.screenshot({path:'test-results/delete-account.png',fullPage:true});
 } finally {await f.close();}
});

test('privacidad pública: acceso sin cuenta, contacto, eliminación y vuelta a bienvenida sin consultar datos privados',async()=>{
 const f=await fixture();
 try {
  await f.page.goto(`${origin}/privacy`);
  await f.page.getByRole('heading',{name:'Política de privacidad',exact:true}).waitFor();
  await f.page.getByText('El responsable del servicio es Claudio Roldán Ramos, particular establecido en España.',{exact:false}).waitFor();
  assert.equal(await f.page.getByRole('link',{name:'convosquad.soporte@gmail.com',exact:true}).getAttribute('href'),'mailto:convosquad.soporte@gmail.com');
  assert.equal(await f.page.getByRole('link',{name:'Eliminar mi cuenta',exact:true}).getAttribute('href'),'/delete-account');
  await f.page.reload();
  await f.page.getByRole('heading',{name:'Política de privacidad',exact:true}).waitFor();
  assert.equal(f.requests.length,0);
  await f.page.getByRole('link',{name:'Eliminar mi cuenta',exact:true}).click();
  await f.page.getByRole('button',{name:'Iniciar sesión para eliminar mi cuenta',exact:true}).waitFor();
  await f.page.getByRole('button',{name:'Política de privacidad',exact:true}).click();
  await f.page.getByRole('heading',{name:'Política de privacidad',exact:true}).waitFor();
 } finally {await f.close();}
});

test('privacidad sigue los cuatro idiomas y conserva responsable y contacto',async()=>{
 const f=await fixture();
 try {
  await f.page.goto(`${origin}/privacy`);
  for(const [button,language,title,section] of [
   ['Cambiar idioma','English','Privacy policy','8. Retention and deletion'],
   ['Change language','Deutsch','Datenschutzerklärung','8. Aufbewahrung und Löschung'],
   ['Sprache ändern','Français','Politique de confidentialité','8. Conservation et suppression'],
   ['Changer de langue','Español','Política de privacidad','8. Conservación y eliminación'],
  ]) {
   await f.page.getByRole('button',{name:button,exact:true}).click();
   await f.page.getByRole('radio',{name:language,exact:true}).click();
   await f.page.getByRole('radio',{name:language,exact:true}).waitFor({state:'hidden'});
   await f.page.getByRole('heading',{name:title,exact:true}).waitFor();
   await f.page.getByRole('heading',{name:section,exact:true}).waitFor({state:'attached'});
   assert.equal(await f.page.getByRole('link',{name:'convosquad.soporte@gmail.com',exact:true}).count(),1);
  }
  assert.equal(f.requests.length,0);
  await f.page.screenshot({path:'test-results/privacy-policy.png'});
 } finally {await f.close();}
});

test('privacidad accesible desde bienvenida, registro, login y clubes con sesión',async()=>{
 for(const [route,options] of [['/',{}],['/register',{}],['/login',{}],['/clubs',{clubRole:'player'}]]) {
  const f=await fixture(options);
  try {
   await f.page.goto(`${origin}${route}`);
   assert.equal(await f.page.getByRole('button',{name:'Explorar la demo',exact:true}).count(),0);
   assert.equal(await f.page.getByText('Prueba la demo sin crear una cuenta. Los equipos y jugadores son de ejemplo.',{exact:true}).count(),0);
   await f.page.getByRole('button',{name:'Política de privacidad',exact:true}).click();
   await f.page.getByRole('heading',{name:'Política de privacidad',exact:true}).waitFor();
   await f.page.getByRole('button',{name:'Volver',exact:true}).click();
   await f.page.getByRole('button',{name:'Política de privacidad',exact:true}).waitFor();
   assert.equal(new URL(f.page.url()).pathname,route);
  } finally {await f.close();}
 }
});

test('navegación móvil: rendimiento vuelve al club sin perder sesión y hay regreso en pantallas internas', async()=>{
 const f=await fixture({clubRole:'admin',performance:true});
 try {
  const {page}=f; await page.goto(`${origin}/home`);
  await page.getByRole('button',{name:'Valoraciones y rendimiento',exact:true}).click();
  await page.waitForURL('**/performance');
  await page.getByRole('button',{name:'Volver al club',exact:true}).first().click();
  await page.waitForURL('**/home');
  await page.getByRole('button',{name:'Ver plantilla',exact:true}).waitFor();
  assert.equal(f.requests.filter(r=>r.endpoint==='logout').length,0);
  await page.goto(`${origin}/create-club`);
  await page.getByRole('button',{name:'Volver',exact:true}).first().waitFor();
  await page.goto(`${origin}/my-requests`);
  await page.getByRole('button',{name:'Volver',exact:true}).first().waitFor();
 } finally {await f.close();}
});

test('fecha y hora usan controles específicos y el formulario expandido permite llegar a confirmar',async()=>{
 const f=await fixture({clubRole:'admin'});
 try {
  const {page}=f;await page.goto(`${origin}/create-call-up`);
  assert.equal(await page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).getAttribute('type'),'date');
  assert.equal(await page.getByLabel('Hora de convocatoria (HH:mm)',{exact:true}).getAttribute('type'),'time');
  await page.getByLabel('Habilitar valoración de jugadores',{exact:true}).click();
  await page.getByLabel('Hora de finalización (HH:mm)',{exact:true}).fill('23:50');
  await page.getByRole('button',{name:'Revisar convocatoria',exact:true}).scrollIntoViewIfNeeded();
  assert.ok(await page.getByRole('button',{name:'Revisar convocatoria',exact:true}).isVisible());
 } finally {await f.close();}
});

test('aviso de admisión actualiza clubes y abre el admitido; otra cuenta o club revocado no entra',async()=>{
 const user='00000000-0000-4000-8000-000000000901';
 const club='00000000-0000-4000-8000-000000000903';
 for(const mode of ['accepted','other-account','revoked']) {
  const f=await fixture({clubRole:'player'});
  try {
   const targetClub=mode==='revoked'?'00000000-0000-4000-8000-000000000999':club;
   const targetUser=mode==='other-account'?'00000000-0000-4000-8000-000000000998':user;
   await f.page.goto(`${origin}/notification?admission=1&club=${targetClub}&user=${targetUser}`);
   if(mode==='accepted') {await f.page.waitForURL('**/home');await f.page.getByRole('button',{name:'Ver plantilla',exact:true}).waitFor();}
   else await f.page.getByText(mode==='other-account'?'Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta admitida.':'No se pudo comprobar el acceso al club. Actualiza tus clubes o consulta con un capitán.',{exact:true}).waitFor();
   assert.equal(f.requests.some(r=>r.endpoint==='respond_to_call_up'),false);
  } finally {await f.close();}
 }
});

test('actualizar plantilla muestra un alta remota sin salir del club ni reiniciar el filtro',async()=>{
 const f=await fixture({clubRole:'player'});
 try {
  const {page}=f;await page.goto(`${origin}/roster`);
  await page.getByText('EA-Player_9',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Sin registrar',exact:true}).click();
  let reads=0;
  await page.route('**/rest/v1/players?*',async route=>{
   reads++;
   return route.fulfill({json:[{id:'remote-player',club_id:'00000000-0000-4000-8000-000000000903',ea_id:'NuevoDesdeWeb',jersey_number:9,category:'attackers',sort_order:10,user_id:null,is_active:true},{id:'remote-registered',club_id:'00000000-0000-4000-8000-000000000903',ea_id:'RegistradoRemoto',jersey_number:10,category:'attackers',sort_order:11,user_id:'00000000-0000-4000-8000-000000000902',is_active:true}]});
  });
  await page.getByRole('button',{name:'Actualizar plantilla',exact:true}).click();
  await page.getByText('NuevoDesdeWeb',{exact:true}).waitFor();
  assert.ok(reads>0);assert.ok(page.url().endsWith('/roster'));
  assert.equal(await page.getByText('RegistradoRemoto',{exact:true}).count(),0);
 } finally {await f.close();}
});

test('solicitudes recibidas: chip en directo, aprobar sin cambiar de club y conservar solicitudes enviadas',async()=>{
 const f=await fixture({clubRole:'admin',pendingJoinRequests:true});
 try{
  f.joinRequests.push({id:'00000000-0000-4000-8000-000000000923',club_id:'00000000-0000-4000-8000-000000000999',user_id:'00000000-0000-4000-8000-000000000901',club_name_snapshot:'Otro club solicitado',status:'pending',created_at:new Date().toISOString()});
  const {page}=f;await page.goto(`${origin}/clubs`);
  await page.getByRole('button',{name:'Mis solicitudes, 1 pendientes de revisión',exact:true}).waitFor();
  const next={...f.joinRequests[0],id:'00000000-0000-4000-8000-000000000922',user_id:'00000000-0000-4000-8000-000000000925',profiles:{username:'OtraSolicitud'}};
  f.joinRequests.push(next);f.emitRequest('INSERT',next);
  const badge=page.getByRole('button',{name:'Mis solicitudes, 2 pendientes de revisión',exact:true});
  await badge.screenshot({path:'test-results/join-request-badge.png'});
  await badge.click();
  await page.getByText('Solicitante',{exact:true}).waitFor();await page.getByText('OtraSolicitud',{exact:true}).waitFor();
  await page.getByText('Solicitudes que he enviado',{exact:true}).waitFor();
  await page.getByText('Otro club solicitado',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Aprobar',exact:true}).first().click();
  await page.getByText('Solicitud aprobada. El usuario ya puede acceder al club.',{exact:true}).waitFor();
  await page.getByText('Solicitante',{exact:true}).waitFor({state:'hidden'});
  assert.equal(f.requests.find(r=>r.endpoint==='review_join_request').body.p_approve,true);
  next.status='rejected';f.emitRequest('UPDATE',next);
  await page.getByText('No hay solicitudes pendientes.',{exact:true}).waitFor();
  await page.goto(`${origin}/clubs`);
  await page.getByRole('button',{name:'Mis solicitudes',exact:true}).waitFor();
 }finally{await f.close();}
});

test('solicitudes: jugador no muestra pendientes de otros y al tocar push solo capitán destinatario entra a revisión',async()=>{
 const club='00000000-0000-4000-8000-000000000903',user='00000000-0000-4000-8000-000000000901';
 for(const mode of ['captain','player','wrong-account']){
  const f=await fixture({clubRole:mode==='player'?'player':'admin',pendingJoinRequests:true});
  try{
   if(mode==='player'){
    await f.page.goto(`${origin}/clubs`);await f.page.getByRole('button',{name:'Mis solicitudes',exact:true}).click();
    await f.page.getByText('No tienes solicitudes.',{exact:true}).waitFor();assert.equal(await f.page.getByText('Solicitante',{exact:true}).count(),0);
   }
   await f.page.goto(`${origin}/notification?requests=1&club=${club}&user=${mode==='wrong-account'?'00000000-0000-4000-8000-000000000998':user}`);
   if(mode==='captain'){await f.page.waitForURL('**/join-requests');await f.page.getByText('Solicitante',{exact:true}).waitFor();}
   else await f.page.getByText(mode==='player'?'Ya no tienes permisos para revisar las solicitudes de este club.':'Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta destinataria.',{exact:true}).waitFor();
   assert.equal(f.requests.some(r=>r.endpoint==='review_join_request'),false);
  }finally{await f.close();}
 }
});


test('desactivar valoraciones conserva la finalización y no envía una hora de valoración',async()=>{
 const f=await fixture({clubRole:'admin'});
 try {
  const {page}=f;await page.goto(`${origin}/create-call-up`);
  await page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).fill('2038-01-12');
  await page.getByRole('switch',{name:'Habilitar valoración de jugadores',exact:true}).click();
  assert.equal(await page.getByLabel('Hora de finalización (HH:mm)',{exact:true}).inputValue(),'00:00');
  await page.getByRole('button',{name:'Revisar convocatoria',exact:true}).click();
  await page.getByRole('button',{name:'Crear convocatoria',exact:true}).click();
  await page.waitForURL('**/call-up*');
  const request=f.requests.find(r=>r.endpoint==='create_call_up_with_end');
  assert.equal(request.body.p_ends_at,'2038-01-13T00:00:00.000Z');
  assert.equal(request.body.p_ratings_enabled,false);
  assert.ok(!('p_evaluation_at' in request.body));
 } finally {await f.close();}
});


test('rendimiento solo ofrece valorar convocatorias finalizadas, incluso si el servidor devuelve una activa',async()=>{
 for(const future of [true,false]){
  const f=await fixture({clubRole:'admin',performance:true,ratingFuture:future});
  try{
   await f.page.goto(`${origin}/performance`);
   await f.page.getByText('Cargando valoraciones…',{exact:true}).waitFor({state:'hidden'});
   if(future){
    await f.page.getByText('No hay convocatorias dentro del plazo de valoración de 24 horas.',{exact:true}).waitFor();
    assert.equal(await f.page.getByRole('button',{name:/^Valorar convocatoria del /}).count(),0);
   }else{
    await f.page.getByRole('button',{name:/^Valorar convocatoria del /}).waitFor();
   }
  }finally{await f.close();}
 }
});

test('valoración de 24 horas: solo una convocatoria, las vencidas se ocultan y un enlace antiguo no permite guardar',async()=>{
 for(const age of [1,25]) {
  const f=await fixture({clubRole:'admin',performance:true,ratingAgeHours:age,multipleRatingCalls:true});
  try {
   await f.page.goto(`${origin}/performance`);
   if(age===1) await f.page.getByRole('button',{name:/^Valorar convocatoria del /}).first().waitFor();
   else await f.page.getByText('No hay convocatorias dentro del plazo de valoración de 24 horas.',{exact:true}).waitFor();
   assert.equal(await f.page.getByRole('button',{name:/^Valorar convocatoria del /}).count(),age===1?1:0);
   if(age===25) {
    await f.page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
    await f.page.getByText('Solo puedes valorar la última convocatoria finalizada durante las 24 horas siguientes a su finalización.',{exact:true}).waitFor();
    assert.equal(await f.page.getByLabel('Valoración de EA-Player_9',{exact:true}).isDisabled(),true);
    assert.equal(await f.page.getByRole('button',{name:'Guardar valoraciones',exact:true}).isDisabled(),true);
    assert.equal(f.requests.some(r=>r.endpoint==='save_player_ratings'),false);
   }
  } finally {await f.close();}
 }
});

test('el editor abierto desactiva las notas al vencer las 24 horas sin tener que salir de la pantalla',async()=>{
 const f=await fixture({clubRole:'admin',performance:true,ratingAgeHours:23.99});
 try {
  await f.page.clock.install({time:new Date()});
  await f.page.goto(`${origin}/call-up-ratings?id=00000000-0000-4000-8000-000000000906`);
  const choice=f.page.getByLabel('Valoración de EA-Player_9',{exact:true});await choice.waitFor();
  await choice.selectOption('8');assert.equal(await f.page.getByRole('button',{name:'Guardar valoraciones',exact:true}).isEnabled(),true);
  await f.page.clock.fastForward(60000);
  await f.page.getByText('Solo puedes valorar la última convocatoria finalizada durante las 24 horas siguientes a su finalización.',{exact:true}).waitFor();
  assert.equal(await choice.isDisabled(),true);assert.equal(await f.page.getByRole('button',{name:'Guardar valoraciones',exact:true}).isDisabled(),true);
  assert.equal(f.requests.some(r=>r.endpoint==='save_player_ratings'),false);
 } finally {await f.close();}
});

test('aviso de valoración lleva al editor de la finalizada y comprueba capitán y cuenta destinataria',async()=>{
 const club='00000000-0000-4000-8000-000000000903',user='00000000-0000-4000-8000-000000000901',call='00000000-0000-4000-8000-000000000906';
 for(const mode of ['captain','player','wrong-account']) {
  const f=await fixture({clubRole:mode==='player'?'player':'admin',performance:true});
  try {
   await f.page.goto(`${origin}/notification?rating=1&club=${club}&call=${call}&user=${mode==='wrong-account'?'00000000-0000-4000-8000-000000000998':user}`);
   if(mode==='captain') {await f.page.waitForURL('**/call-up-ratings?*');await f.page.getByRole('button',{name:'Guardar valoraciones',exact:true}).waitFor();}
   else await f.page.getByText(mode==='player'?'Solo los capitanes de este club pueden gestionar las valoraciones.':'Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta destinataria.',{exact:true}).waitFor();
   assert.equal(f.requests.some(r=>['respond_to_call_up','save_player_ratings'].includes(r.endpoint)),false);
  } finally {await f.close();}
 }
});


test('el menú del ID se abre junto al identificador, se cierra al tocar fuera y permite cerrar sesión desde el club', async () => {
 for (const width of [320, 390]) {
  const f = await fixture({clubRole:'admin'});
  try {
   await f.page.setViewportSize({width,height:844});
   await f.page.goto(`${origin}/home`);
   const trigger = f.page.getByRole('button',{name:'Sesión iniciada como EA-Player_9',exact:true});
   await trigger.click();
   const menu = f.page.getByRole('menu'); await menu.waitFor();
   const badgeBounds = await trigger.boundingBox(), menuBounds = await menu.boundingBox();
   assert.ok(menuBounds.y >= badgeBounds.y + badgeBounds.height);
   assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= width);
   if (width === 390) await f.page.screenshot({path:'test-results/session-menu.png', animations:'disabled'});
   for (const dismiss of ['outside', 'escape']) {
    await f.page.getByRole('dialog').waitFor();
    await menu.evaluate(element => {
     window.sessionMenuFrames = [];
     const sample = () => {
      if (!element.isConnected) return;
      const { x, y } = element.getBoundingClientRect();
      window.sessionMenuFrames.push({ x, y });
      requestAnimationFrame(sample);
     };
     sample();
    });
    if (dismiss === 'outside') await f.page.getByRole('button',{name:'Cerrar',exact:true}).click({position:{x:8,y:500}});
    else await f.page.keyboard.press('Escape');
    await menu.waitFor({state:'detached'});
    const frames = await f.page.evaluate(() => window.sessionMenuFrames);
    assert.ok(frames.length > 1, 'se comprueba también la animación de salida');
    assert.ok(frames.every(frame => Math.abs(frame.x - menuBounds.x) < 1 && Math.abs(frame.y - menuBounds.y) < 1), `el menú conserva su posición al cerrar (${dismiss}, ${width}px)`);
    await trigger.click();
    await menu.waitFor();
   }
   await f.page.getByRole('menuitem',{name:'Cerrar sesión',exact:true}).click();
   await f.page.waitForURL(origin + '/');
   await f.page.getByRole('button',{name:'Iniciar sesión',exact:true}).waitFor();
   assert.deepEqual(f.requests.filter(r=>r.endpoint==='logout').map(r=>r.scope),['local']);
   await f.page.reload();
   await f.page.goto(`${origin}/home`);
   await f.page.waitForURL('**/login');
  } finally { await f.close(); }
 }
});

test('cerrar sesión desde clubes termina correctamente aunque la revocación remota devuelva un error tras borrar la sesión local', async () => {
 const f = await fixture({clubRole:'admin',logoutFailure:true});
 try {
  await f.page.goto(`${origin}/clubs`);
  await f.page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await f.page.waitForURL(origin + '/');
  await f.page.getByRole('button',{name:'Iniciar sesión',exact:true}).waitFor();
  assert.deepEqual(f.requests.filter(r=>r.endpoint==='logout').map(r=>r.scope),['local']);
  await f.page.reload();
  assert.equal(await f.page.getByText('ID: EA-Player_9',{exact:true}).count(),0);
 } finally { await f.close(); }
});
