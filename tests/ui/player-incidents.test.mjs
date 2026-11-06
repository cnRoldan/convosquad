import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';
import { posterGeometry } from '../../src/features/lineups/poster-geometry.ts';

let browser, server, origin;
const root = path.resolve('dist-ui');
const uuid = n => `99000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const userId = uuid(1), clubId = uuid(2), nextId = uuid(3), pastId = uuid(4);
before(async () => {
  server = createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (existsSync(file) && statSync(file).isDirectory() && existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
    else if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(file + '.html') ? file + '.html' : path.join(root, 'index.html');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined;
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function fixture({ route = '/lineup', role = 'admin', race = false, expiresSoon = false, suggestions = false, historyError = false, posterExample = false, lineupPlayers = 11, noPublishedLineup = false, seedInstructions = false, withCrest = false, ratingMeans = false, withHistory = false, historyTeamAverage = null, benchSelection = false, rosterFixes = false, viewport = { width: 390, height: 844 } } = {}) {
  const context = await browser.newContext({ viewport, locale: 'es-ES' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const now = Date.now();
  if (expiresSoon || ratingMeans) await page.clock.install({ time: now });
  const errors = [], unexpected = [], publications = [];
  const state = { activityWrites: 0, unlinkedRemoved: [], incidentReads: 0, incidentDeletes: [], recorded: [], ratings: 0, ratingChanges: [], averageScore: 7.5, historicalRatingReads: 0, lineupReads: 0, lineupAccessReads: 0, publishedReads: 0, guests: [], helperRemovals: [], trialWithdrawals: [], instructionSaves: [], instructionReads: 0, instructionDeletes: [] };
  page.on('pageerror', error => errors.push(error.message));
  const club = { id: clubId, name: 'Incidents club', ...(withCrest ? {crest_path:`${clubId}/crest.png`} : {}), timezone: 'Europe/Madrid', ratings_visibility: 'captains' };
  const roster = Array.from({ length: benchSelection ? 15 : 12 }, (_, i) => ({ id: uuid(10 + i), club_id: clubId, ea_id: i === 0 ? 'Selu' : `Jugador_${i + 1}`, nickname: null, jersey_number: i + 1, category: i === 0 ? 'goalkeepers' : 'midfielders', position: 'MC', sort_order: i, is_active: true, user_id: i === 0 ? userId : null }));
  if (suggestions) roster[11].category = 'attackers';
  if (benchSelection) { roster[12].category='attackers';roster[13].category='goalkeepers'; }
  if (posterExample) {
    const names=['Rojo impar','Selu','Salsinhes','MAZO NEGRO','Junior','k1mbowx','Boni','Pulpito','Twichpapiiisunda','Manoliko','istateclapeain02'];
    const numbers=[23,22,24,31,12,20,8,80,18,91,5];
    for(let i=0;i<11;i++){roster[i].ea_id=names[i];roster[i].jersey_number=numbers[i];}
  }
  const next = { id: nextId, club_id: clubId, starts_at: new Date(now + 3600000).toISOString(), ends_at: new Date(now + 10800000).toISOString(), evaluation_at: null, timezone: club.timezone, status: 'open', status_version: 1 };
  const past = { ...next, id: pastId, starts_at: new Date(now - 7200000).toISOString(), ends_at: new Date(now - 3600000).toISOString(), evaluation_at: new Date(now - 3600000).toISOString() };
  const rosterHelpers=rosterFixes?[{id:uuid(400),name:'Ayuda de plantilla'}]:[];
  const trialRows=rosterFixes?Array.from({length:9},(_,i)=>({id:uuid(300+i),club_id:clubId,ea_id:i===8?'Prueba activa':`Prueba archivo ${i+1}`,status:i===8?'active':'withdrawn',created_at:past.starts_at,resolved_at:i===8?null:past.starts_at,sort_order:i,player_id:null,position:null})):[];
  const entries = roster.map((player, i) => ({ id: uuid(30 + i), call_up_id: pastId, club_id: clubId, source_player_id: player.id, ea_id_snapshot: player.ea_id, user_id: player.user_id, availability: 'available', category_snapshot: player.category, position_snapshot: 'MC', jersey_number_snapshot: i + 1, sort_order_snapshot: i }));
  if(benchSelection)for(const entry of entries.slice(12))entry.availability='unavailable';
  if(route==='/call-up-ratings') entries[0].availability='unavailable';
  const positions = posterExample ? [[.5,.9],[.25,.72],[.5,.72],[.75,.72],[.16,.45],[.5,.56],[.34,.34],[.66,.34],[.84,.45],[.36,.15],[.64,.15]] : [[.5,.9],[.2,.72],[.4,.72],[.6,.72],[.8,.72],[.2,.43],[.4,.43],[.6,.43],[.8,.43],[.36,.15],[.64,.15]];
  let document = { formation: posterExample ? '3-5-2' : '4-4-2', slots: positions.map(([x,y], id) => ({ id, x, y, playerId: id < lineupPlayers ? roster[id].id : null })), bench: [roster[11].id], ...(benchSelection?{excludedIds:[roster[13].id,roster[14].id]}:{}) };
  let draft = null;
  let publishedInstructions = seedInstructions ? [
    {id:uuid(120),player_id:roster[0].id,player_name:roster[0].ea_id,body:'Indicación privada para Selu',captain_name:'Capitán',published_at:past.ends_at,recipient_linked:true,recipient:userId},
    {id:uuid(121),player_id:roster[1].id,player_name:roster[1].ea_id,body:'Indicación privada para otro jugador',captain_name:'Capitán',published_at:past.ends_at,recipient_linked:true,recipient:uuid(999)},
  ] : [];
  let positionLocked = true;
  const makeIncident = (index, id, expired = false) => ({ id: uuid(id), club_id: clubId, call_up_id: pastId, call_up_player_id: entries[index].id, player_id: roster[index].id, player_name: roster[index].ea_id, match_starts_at: past.starts_at, match_timezone: club.timezone, kind: 'late', note: 'Llegó veinte minutos tarde', recorded_by: userId, captain_name: 'Capitán', created_at: new Date(now - (expired ? 8 : 1) * 86400000).toISOString(), expires_at: new Date(now + (expired ? -86400000 : expiresSoon && index === 0 ? 60000 : 6 * 86400000)).toISOString() });
  const incidents = [makeIncident(0, 100), makeIncident(1, 101, true), makeIncident(11, 102)];
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: past.starts_at };
  const expiry = Math.floor(now / 1000) + 7200;
  const jwt = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expiry })).toString('base64url')}.fixture`;
  await context.addInitScript(({ user, jwt, expiry }) => localStorage.setItem('sb-auth-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: expiry, user })), { user, jwt, expiry });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => { socket.onMessage(() => {}); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.split('/').at(-1);
    if (url.origin === origin) return route.continue();
    if (url.hostname !== 'auth.example.test') { unexpected.push(url.hostname); return route.abort(); }
    if(url.pathname.includes('/storage/v1/object/')) {
      if(request.method()==='GET') {
        await new Promise(resolve=>setTimeout(resolve,250));
        return route.fulfill({contentType:'image/png',body:readFileSync('assets/images/icon.png')});
      }
      return route.fulfill({json:{signedURL:`/object/sign/club-crests/${clubId}/crest.png?token=fixture`}});
    }
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    let result;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (endpoint === 'record_account_activity') {state.activityWrites++;result=null;}
    else if (endpoint === 'list_roster_helpers') result=rosterHelpers;
    else if (endpoint === 'remove_roster_helper') {
      assert.equal(role,'admin');state.helperRemovals.push(body.p_guest_id);const i=rosterHelpers.findIndex(h=>h.id===body.p_guest_id);if(i>=0)rosterHelpers.splice(i,1);result=null;
    } else if (endpoint === 'read_trial_history') {
      assert.equal(role,'admin');const rows=trialRows.filter(t=>t.status!=='active');result={premium:true,total:rows.length,entries:rows.slice(body.p_offset,body.p_offset+100),hasMore:false};
    } else if (endpoint === 'withdraw_trial') {
      assert.equal(role,'admin');state.trialWithdrawals.push(body.p_trial_id);const trial=trialRows.find(t=>t.id===body.p_trial_id);trial.status='withdrawn';trial.resolved_at=past.starts_at;result=trial;
    } else if (endpoint === 'club_trials') result=url.searchParams.get('status')==='eq.active'?trialRows.filter(t=>t.status==='active'):trialRows;
    else if (endpoint === 'club_trial_contacts') result=[];
    else if (endpoint === 'add_lineup_guest') {
      const guest={id:uuid(200),name:body.p_name,kind:body.p_kind};state.guests.push(guest);result=guest.id;
    } else if (endpoint === 'list_lineup_guests') result=state.guests;
    else if (endpoint === 'get_player_performance') {
      state.historicalRatingReads++;
      assert.equal(role,'admin');assert.equal(body.p_club_id,clubId);assert.equal(body.p_period,'3m');
      result=withHistory ? [[0,2.5],[1,4.5],[2,5.5],[3,7],[11,8.25]].map(([index,score])=>({player_id:roster[index].id,player_name:roster[index].ea_id,average_score:score,rated_matches:2,not_selected_matches:0,last_match_at:past.starts_at})):[];
    } else if (endpoint === 'lineup_position_experience') {
      assert.equal(role, 'admin'); assert.equal(body.p_call_id, nextId);
      if (historyError) return route.fulfill({ status: 500, json: { message: 'History unavailable' } });
      result = suggestions ? [{player_id:roster[4].id,category:'attackers',appearances:3}] : [];
    } else if (endpoint === 'list_player_incidents') {
      state.incidentReads++;
      assert.equal(role, 'admin');
      result = incidents.filter(incident => (!body.p_active_only || Date.parse(incident.expires_at) > (expiresSoon ? now : Date.now())) && (!body.p_call_up_id || incident.call_up_id === body.p_call_up_id));
    } else if (endpoint === 'delete_player_incident') {
      assert.equal(role,'admin');state.incidentDeletes.push(body.p_incident_id);
      const index=incidents.findIndex(incident=>incident.id===body.p_incident_id);
      if(index>=0)incidents.splice(index,1);
      result=null;
    } else if (endpoint === 'record_player_incident') {
      state.recorded.push(body);
      const index = entries.findIndex(entry => entry.id === body.p_entry_id);
      const incident = { ...makeIncident(index, 110), kind: body.p_kind, note: body.p_note };
      incidents.push(incident); result = incident;
    } else if (endpoint === 'read_my_player_ratings') { assert.equal(body.p_call_up_id,pastId); result=[]; }
    else if (endpoint === 'read_call_up_rating_averages') { assert.equal(body.p_call_up_id,pastId); result=ratingMeans?[{call_up_player_id:uuid(30),average_score:state.ratings ? 8 : state.averageScore,rating_count:2},{call_up_player_id:uuid(31),average_score:0,rating_count:1}]:[]; }
    else if (endpoint === 'save_my_player_ratings') { state.ratings++; state.ratingChanges.push(body); result = 1; }
    else if (endpoint === 'publish_lineup_draft') {
      publications.push(body);
      if (race && publications.length === 1) {
        incidents.push(makeIncident(2, 103));
        return route.fulfill({ status: 409, json: { code: 'P0052', message: 'New incident' } });
      }
      assert.ok(body.p_acknowledged_incidents.includes(uuid(100)));
      if (race) assert.ok(body.p_acknowledged_incidents.includes(uuid(103)));
      assert.ok(!body.p_acknowledged_incidents.includes(uuid(102)), 'bench incident must not be acknowledged');
      draft.published=true;
      publishedInstructions=Object.entries(draft.instructions??{}).filter(([id])=>document.slots.some(slot=>slot.playerId===id)).map(([id,text],index)=>({id:uuid(120+index),player_id:id,player_name:roster.find(p=>p.id===id).ea_id,body:text,captain_name:'Capitán',published_at:new Date().toISOString(),recipient_linked:Boolean(roster.find(p=>p.id===id).user_id),recipient:roster.find(p=>p.id===id).user_id}));
      result = null;
    } else if (endpoint === 'delete_lineup_instruction') {
      assert.equal(role,'admin');
      state.instructionDeletes.push(body.p_instruction_id);
      publishedInstructions=publishedInstructions.filter(note=>note.id!==body.p_instruction_id);
      result=null;
    } else if (endpoint === 'read_lineup_instructions') {
      state.instructionReads++;
      assert.ok([nextId,pastId].includes(body.p_call_id));
      result=publishedInstructions.filter(note=>role==='admin'||note.recipient===userId).map(({recipient:_,...note})=>note);
    } else if (endpoint === 'save_lineup_draft' || endpoint === 'save_lineup_draft_with_instructions') {
      if(endpoint==='save_lineup_draft_with_instructions')state.instructionSaves.push(body);
      document = body.p_document;
      draft = { id: uuid(90), ordinal: 1, title: body.p_title, document, instructions:body.p_instructions??draft?.instructions??{}, revision: (draft?.revision ?? 0) + 1, submittedAt: null, createdBy: 'Capitán', updatedBy: 'Capitán', upVotes: 0, downVotes: 0, published: false };
      result = draft;
    } else if (endpoint === 'read_published_lineup') {
      state.publishedReads++;
      assert.equal(body.p_call_id,nextId);
      result={allowed:true,snapshot:noPublishedLineup?null:{clubName:club.name,crestPath:withCrest?club.crest_path:null,lineup:document,candidates:roster.map(p=>({id:p.id,name:p.ea_id,jerseyNumber:p.jersey_number,active:true,eligible:true})),shirtColor:'#4C000B',numberColor:'#B3FF61',goalkeeperColor:'#F4A83A'}};
    } else if (endpoint === 'read_lineup_access') { state.lineupAccessReads++; assert.equal(role,'admin'); result = { allowed: true, premium: true, activated: true, remaining: 6 }; }
    else if (endpoint === 'read_lineup') { state.lineupReads++; assert.equal(role,'admin'); result = { document, revision: 0, inherited: false }; }
    else if (endpoint === 'list_lineup_drafts') result = draft ? [draft] : [];
    else if (endpoint === 'set_lineup_position_lock') { positionLocked=body.p_locked; result=positionLocked; }
    else if (endpoint === 'read_lineup_preference') result = { playerColor: '#4C000B', jerseyColor: '#B3FF61', goalkeeperColor: '#F4A83A', positionLocked };
    else if (endpoint === 'list_rating_call_ups') result = [past];
    else if (endpoint === 'read_rating_lineup') { assert.equal(body.p_call_id,pastId); result={published:!noPublishedLineup,entryIds:noPublishedLineup?[]:entries.slice(0,11).map(entry=>entry.id)}; }
    else if (endpoint === 'set_preferred_language') result = null;
    else if (endpoint === 'list_player_link_requests') result = [];
    else if (endpoint === 'list_inactive_club_members') {
      assert.equal(role,'admin');assert.equal(body.p_club_id,clubId);
      result=[{user_id:uuid(151),username:'Jugador inactivo',role:'player',last_active_at:new Date(now-220*86400000).toISOString(),has_player_card:true,sole_captain:false}];
    }
    else if (endpoint === 'list_call_up_history') { assert.equal(body.p_club_id,clubId);result=[past]; }
    else if (endpoint === 'list_call_up_history_ratings') {
      assert.equal(role,'admin');assert.equal(body.p_club_id,clubId);
      result=historyTeamAverage===null ? [] : [{call_up_id:pastId,average_score:historyTeamAverage}];
    }
    else if (endpoint === 'list_unlinked_club_members') {
      assert.equal(role,'admin'); assert.equal(body.p_club_id,clubId);
      result = [{user_id:userId,username:'Capitán sin ficha',role:'admin'}, ...(!state.unlinkedRemoved.length ? [{user_id:uuid(150),username:'Miembro sin ficha',role:'player'}] : [])];
    }
    else if (endpoint === 'remove_unlinked_club_member') { assert.equal(role,'admin'); assert.equal(body.p_club_id,clubId);assert.equal(body.p_user_id,uuid(150));state.unlinkedRemoved.push(body.p_user_id);result=null; }
    else if (endpoint === 'clubs') result = request.headers().accept?.includes('object') ? club : [club];
    else if (endpoint === 'club_members') result = [{ id: uuid(5), club_id: clubId, user_id: userId, role, is_active: true }];
    else if (endpoint === 'profiles') result = { id: userId, username: 'Capitán' };
    else if (endpoint === 'players') result = roster;
    else if (endpoint === 'call_ups') result = request.headers().accept?.includes('object') ? (url.searchParams.get('id') === `eq.${pastId}` ? past : next) : [next];
    else if (endpoint === 'call_up_players') result = entries;
    else if (['call_up_trials', 'call_up_aids', 'club_trial_notes', 'call_up_contacts', 'call_up_trial_notes', 'player_ratings', 'join_requests', 'player_link_requests', 'notification_preferences', 'club_decision_locks'].includes(endpoint)) result = [];
    else { unexpected.push(endpoint); return route.abort(); }
    return route.fulfill({ json: result });
  });
  await page.goto(`${origin}${route}${route === '/lineup' ? `?id=${nextId}` : route === '/call-up-ratings' ? `?id=${pastId}` : ''}`);
  async function close() { await context.close(); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); }
  return { page, state, incidents, publications, close };
}

for(const mean of [null,0,7.33]) test(`history shows only available Premium team ratings: ${mean}`,async()=>{
  const f=await fixture({route:'/call-up-history',historyTeamAverage:mean});
  try {
    await f.page.getByRole('button',{name:/Consultar convocatoria del/}).waitFor();
    const summary=f.page.getByText(/^Valoración media del equipo:/);
    if(mean===null)assert.equal(await summary.count(),0);
    else await f.page.getByText(`Valoración media del equipo: ${mean.toFixed(2).replace('.',',')} / 10`,{exact:true}).waitFor();
  } finally {await f.close();}
});

for (const entry of ['/home','/call-up']) test(`historical call-up returns through history to its original entry ${entry}`, async () => {
  const f=await fixture({route:entry});
  try {
    const {page}=f;
    await page.getByRole('button',{name:'Historial de convocatorias',exact:true}).click();
    await page.waitForURL('**/call-up-history');
    const consult=page.getByRole('button',{name:/Consultar convocatoria del/});
    await consult.click();
    await page.waitForURL('**/historical-call-up?**');
    await page.getByRole('button',{name:'Historial de convocatorias',exact:true}).click();
    await page.waitForURL('**/call-up-history');
    await consult.waitFor();
    await page.getByRole('button',{name:'Volver',exact:true}).click();
    await page.waitForURL(`**${entry}`);
    if(entry==='/call-up') {
      await page.getByRole('button',{name:'Historial de convocatorias',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Volver a la convocatoria actual',exact:true}).count(),0);
    }
  } finally {await f.close();}
});

test('captain can inspect unlinked members and must confirm removal; own account has no removal button', async () => {
  const f = await fixture({route:'/join-requests'});
  try {
    const {page}=f;
    await page.getByText('Miembros sin ficha',{exact:true}).waitFor();
    await page.getByText('Miembro sin ficha',{exact:true}).waitFor();
    await page.getByText('Tu cuenta',{exact:true}).waitFor();
    await page.getByText('Miembros inactivos',{exact:true}).waitFor();
    await page.getByText('Jugador inactivo',{exact:true}).waitFor();
    await page.getByText(/^Sin actividad desde:/).waitFor();
    assert.ok(f.state.activityWrites>=1,'opening the foreground app records real use');
    assert.equal(await page.getByRole('button',{name:'Desvincular del club',exact:true}).count(),1);
    await page.getByRole('button',{name:'Desvincular del club',exact:true}).click();
    await page.getByText('¿Desvincular a Miembro sin ficha del club? Perderá el acceso al club. Su cuenta y los datos históricos se conservarán.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByText('¿Desvincular a Miembro sin ficha del club? Perderá el acceso al club. Su cuenta y los datos históricos se conservarán.',{exact:true}).waitFor({state:'hidden'});
    assert.equal(f.state.unlinkedRemoved.length,0);
    await page.getByRole('button',{name:'Desvincular del club',exact:true}).first().click();
    await page.getByText('¿Desvincular a Miembro sin ficha del club? Perderá el acceso al club. Su cuenta y los datos históricos se conservarán.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Desvincular del club',exact:true}).last().click();
    await page.getByText('Miembro sin ficha',{exact:true}).waitFor({state:'hidden'});
    assert.deepEqual(f.state.unlinkedRemoved,[uuid(150)]);
    await page.getByText('Capitán sin ficha',{exact:true}).waitFor();
  } finally {await f.close();}
});

test('lineup warns only for active starters, lists details and requires renewed consent when incidents change', async () => {
  const f = await fixture({ race: true });
  try {
    const { page } = f;
    await page.getByRole('button', { name: 'Consultar incidencias de jugadores', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Incidencias vigentes', { exact: true }).count(), 2);
    await page.getByRole('button', { name: 'Consultar incidencias de jugadores', exact: true }).click();
    await page.getByText('Incidencias de jugadores alineados', { exact: true }).waitFor();
    assert.equal(await page.getByText('Llegó veinte minutos tarde', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Publicar 11', exact: true }).last().click();
    await page.getByText('Vas a publicar una alineación con jugadores que tienen incidencias.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(f.publications.length, 0);
    await page.getByRole('button', { name: 'Publicar 11', exact: true }).last().click();
    await page.getByText('Vas a publicar una alineación con jugadores que tienen incidencias.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Publicar 11', exact: true }).last().click();
    await page.getByText('Las incidencias han cambiado. Revísalas y confirma de nuevo la publicación.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Publicar 11', exact: true }).last().click();
    await page.getByText('🎉 Once publicado', { exact: true }).waitFor();
    assert.equal(f.publications.length, 2);
  } finally { await f.close(); }
});

test('captain saves private instructions with the draft and publishes them separately from the XI',async()=>{
  const f=await fixture();
  try {
    const {page}=f;
    await page.getByRole('button',{name:'Selu, dorsal 1',exact:true}).click();
    await page.getByRole('button',{name:'Añadir indicaciones',exact:true}).click();
    await page.getByRole('textbox',{name:'Indicaciones',exact:true}).fill('Saca en corto y busca al pivote.');
    await page.getByRole('button',{name:'Guardar indicaciones',exact:true}).click();
    await page.getByText('Tienes cambios sin guardar.',{exact:true}).waitFor();
    assert.equal(f.state.instructionSaves.length,0);
    await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await page.getByText('Borrador guardado.',{exact:true}).waitFor();
    assert.equal(f.state.instructionSaves[0].p_instructions[uuid(10)],'Saca en corto y busca al pivote.');
    assert.equal('instructions' in f.state.instructionSaves[0].p_document,false);
    await page.getByRole('button',{name:'Indicaciones de jugadores',exact:true}).click();
    await page.getByText('No hay indicaciones publicadas para esta convocatoria.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await page.getByRole('button',{name:'Selu, dorsal 1',exact:true}).click();
    await page.getByRole('button',{name:'Editar indicaciones',exact:true}).click();
    assert.equal(await page.getByRole('textbox',{name:'Indicaciones',exact:true}).inputValue(),'Saca en corto y busca al pivote.');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await page.getByRole('button',{name:'Publicar 11',exact:true}).last().click();
    await page.getByText('Vas a publicar una alineación con jugadores que tienen incidencias.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Publicar 11',exact:true}).last().click();
    await page.getByText('🎉 Once publicado',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await page.getByRole('button',{name:'Indicaciones de jugadores',exact:true}).click();
    await page.getByText('Saca en corto y busca al pivote.',{exact:true}).waitFor();
  } finally {await f.close();}
});

test('players see only their published instructions and the targeted notification opens them',async()=>{
  const f=await fixture({role:'player',route:'/call-up',seedInstructions:true});
  try {
    const {page}=f;
    await page.getByRole('button',{name:'Mis indicaciones',exact:true}).click();
    await page.getByText('Indicación privada para Selu',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Eliminar indicación de Selu',exact:true}).count(),0);
    assert.equal(await page.getByText('Indicación privada para otro jugador',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();
    await page.goto(`${origin}/notification?club=${clubId}&call=${nextId}&instructions=1&user=${userId}`);
    await page.waitForURL('**/call-up?*');
    await page.getByText('Indicación privada para Selu',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Eliminar indicación de Selu',exact:true}).count(),0);
    assert.equal(await page.getByText('Indicación privada para otro jugador',{exact:true}).count(),0);
  } finally {await f.close();}
});

test('instruction notification for another account does not open private instructions',async()=>{
  const f=await fixture({role:'player',route:'/call-up',seedInstructions:true});
  try {
    await f.page.goto(`${origin}/notification?club=${clubId}&call=${nextId}&instructions=1&user=${uuid(999)}`);
    await f.page.getByText('Este aviso pertenece a otra cuenta. Inicia sesión con la cuenta destinataria.',{exact:true}).waitFor();
    assert.equal(await f.page.getByText('Indicación privada para Selu',{exact:true}).count(),0);
    assert.equal(f.state.instructionReads,0);
  } finally {await f.close();}
});

test('suggestions select a bench attacker, then swap an experienced midfielder into an empty attacking slot', async () => {
  const f = await fixture({ suggestions: true });
  try {
    const { page } = f;
    await page.getByRole('button', {name:'Jugador_10, dorsal 10',exact:true}).click();
    const suggested=page.getByLabel('Jugadores sugeridos',{exact:true});
    await suggested.getByText('Ya jugó aquí · 3 convocatorias',{exact:true}).waitFor();
    await suggested.getByText('Posición de plantilla',{exact:true}).waitFor();
    assert.equal(await suggested.getByRole('button').count(),2);
    await suggested.getByRole('button',{name:'Elegir Jugador_12',exact:true}).click();
    await page.getByRole('button',{name:'Jugador_12, dorsal 12',exact:true}).click();
    await page.getByRole('button',{name:'Mandar al banquillo',exact:true}).click();
    await page.getByRole('button',{name:'Posición vacía',exact:true}).click();
    await page.getByLabel('Jugadores sugeridos',{exact:true}).getByRole('button',{name:'Elegir Jugador_5',exact:true}).click();
    await page.getByRole('button',{name:'Jugador_5, dorsal 5',exact:true}).click();
    await page.getByText('Cambiar jugador',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cerrar',exact:true}).click();
    assert.equal(await page.getByText('Tienes cambios sin guardar.',{exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Posición vacía',exact:true}).count(),1);
  } finally { await f.close(); }
});

test('roster suggestions remain usable if position history fails', async () => {
  const f=await fixture({suggestions:true,historyError:true});
  try {
    await f.page.getByRole('button',{name:'Jugador_10, dorsal 10',exact:true}).click();
    await f.page.getByText('No se pudo consultar el histórico. Se muestran las coincidencias de plantilla.',{exact:true}).waitFor();
    await f.page.getByLabel('Jugadores sugeridos',{exact:true}).getByRole('button',{name:'Elegir Jugador_12',exact:true}).click();
    await f.page.getByRole('button',{name:'Jugador_12, dorsal 12',exact:true}).waitFor();
  } finally { await f.close(); }
});

for(const lineupPlayers of [0,5,11]) test(`captain exports an unpublished lineup with ${lineupPlayers} players without saving or publishing`,async()=>{
  const f=await fixture({lineupPlayers});
  try {
    const {page}=f;
    const generate=page.getByRole('button',{name:'Generar imagen',exact:true});
    await generate.waitFor();
    assert.equal(await generate.isEnabled(),true);
    if(lineupPlayers<11)assert.equal(await page.getByRole('button',{name:'Publicar 11',exact:true}).isEnabled(),false);
    const pending=page.waitForEvent('download');
    await generate.click();
    const download=await pending;
    assert.equal(download.suggestedFilename(),'convosquad-once.png');
    await generate.waitFor();
    assert.deepEqual(f.publications,[]);
    assert.deepEqual(f.state.instructionSaves,[]);
    assert.equal(await page.getByText('Tienes cambios sin guardar.',{exact:true}).count(),0);
  } finally {await f.close();}
});

for(const withCrest of [false,true]) test(`generated portrait poster downloads readable players ${withCrest?'with the embedded crest':'without a club crest'}`, async () => {
  const f=await fixture({posterExample:true,withCrest});
  try {
    const {page}=f;
    await page.getByRole('button',{name:'Publicar 11',exact:true}).last().click();
    await page.getByText('Vas a publicar una alineación con jugadores que tienen incidencias.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Publicar 11',exact:true}).last().click();
    await page.getByText('🎉 Once publicado',{exact:true}).waitFor();
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Generar imagen',exact:true}).click();
    const download=await pending;
    assert.equal(download.suggestedFilename(),'convosquad-once.png');
    const file=withCrest?'/workspace/shared/lineup-field-focused-crest.png':'/workspace/shared/lineup-field-focused.png';
    await download.saveAs(file);
    const png=readFileSync(file);
    assert.equal(png.readUInt32BE(16),posterGeometry.width);assert.equal(png.readUInt32BE(20),posterGeometry.height);
    if(withCrest) {
      const pixels=await page.evaluate(async data=>{
        const image=new Image();image.src=data;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=1324;canvas.height=1550;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        const dataBytes=ctx.getImageData(66,60,104,102).data;let bright=0;
        for(let i=0;i<dataBytes.length;i+=4)if(dataBytes[i]>100&&dataBytes[i+1]>130&&dataBytes[i+2]<140)bright++;
        return bright;
      },'data:image/png;base64,'+png.toString('base64'));
      assert.ok(pixels>100,'the exported crest region contains the image, not an empty frame');
    }
  } finally {await f.close();}
});

test('lineup expands on iPad and Surface, keeps editing state on resize and returns to one column on mobile', async () => {
  const f=await fixture({viewport:{width:1032,height:1376}});
  try {
    const {page}=f;
    const pitch=page.getByTestId('lineup-pitch'),controls=page.getByTestId('lineup-controls');
    await pitch.waitFor();
    for(const size of [{width:1032,height:1376},{width:912,height:1368}]) {
      await page.setViewportSize(size);
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid="lineup-workspace"]')).flexDirection==='row');
      const p=await pitch.boundingBox(),c=await controls.boundingBox();
      assert.ok(p.width>size.width*.6,`pitch width ${p.width} at ${size.width}`);
      assert.ok(p.height>520);
      assert.ok(c.x>=p.x+p.width+15);
      assert.ok(Math.abs(c.y-p.y)<2);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    }
    await page.getByRole('button',{name:'Desbloquear posiciones',exact:true}).click();
    await page.getByRole('button',{name:'Bloquear posiciones',exact:true}).waitFor();
    const moving=page.getByRole('button',{name:'Jugador_2, dorsal 2',exact:true});
    const before=await moving.boundingBox(),field=await pitch.boundingBox();
    const dx=field.width*.08,dy=-field.height*.07;
    await page.mouse.move(before.x+before.width/2,before.y+before.height/2);
    await page.mouse.down();
    await page.mouse.move(before.x+before.width/2+dx,before.y+before.height/2+dy,{steps:12});
    await page.mouse.up();
    const after=await moving.boundingBox();
    // PanResponder starts after its movement threshold, so a few initial pixels are ignored.
    assert.ok(Math.abs(after.x-before.x-dx)<10,`horizontal drag: ${JSON.stringify({before,after,dx,dy,field})}`);
    assert.ok(Math.abs(after.y-before.y-dy)<10,`vertical drag: ${after.y-before.y} expected ${dy}`);
    await page.getByRole('button',{name:'Jugador_10, dorsal 10',exact:true}).click();
    await page.getByRole('button',{name:'Mandar al banquillo',exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid="lineup-workspace"]')).flexDirection==='column');
    const p=await pitch.boundingBox(),c=await controls.boundingBox();
    assert.ok(p.width>=300 && p.width<=390);
    assert.equal(p.height,520);
    assert.ok(c.y>=p.y+p.height+15);
    assert.equal(await page.getByRole('button',{name:'Posición vacía',exact:true}).count(),1);
    assert.equal(await page.getByText('Tienes cambios sin guardar.',{exact:true}).count(),1);
    await page.setViewportSize({width:1032,height:1376});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid="lineup-workspace"]')).flexDirection==='row');
    assert.equal(await page.getByRole('button',{name:'Posición vacía',exact:true}).count(),1);
    await page.screenshot({path:'/workspace/shared/lineup-tablet-responsive.png',fullPage:true});
  } finally { await f.close(); }
});

test('incident recording keeps unsaved ratings and history includes archived records', async () => {
  const f = await fixture({ route: '/call-up-ratings' });
  try {
    const { page } = f;
    const score = page.getByRole('radio', { name: 'Nota 8 para Selu', exact: true });
    await score.click();
    await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).first().click();
    await page.getByRole('combobox', { name: 'Motivo de la incidencia' }).selectOption('no_show');
    await page.getByRole('textbox', { name: 'Observación', exact: true }).fill('No entró y avisó al capitán');
    await page.getByRole('button', { name: 'Guardar incidencia', exact: true }).click();
    await page.getByText('Incidencia registrada. La marca estará vigente durante una semana.', { exact: true }).waitFor();
    assert.equal(await score.getAttribute('aria-checked'), 'true');
    assert.equal(f.state.ratings, 0);
    assert.equal(f.state.recorded[0].p_kind, 'no_show');
    await page.getByRole('button', { name: 'Histórico de incidencias', exact: true }).click();
    await page.getByText('No entró y avisó al capitán', { exact: true }).waitFor();
    assert.ok(await page.getByText(/^Archivada desde /).count() > 0);
  } finally { await f.close(); }
});

test('ratings initially show published starters even when unavailable, and omit an available bench player with an incident',async()=>{
  const f=await fixture({route:'/call-up-ratings'});
  try {
    await f.page.getByLabel('Valoración de Selu',{exact:true}).waitFor();
    assert.equal(await f.page.getByLabel(/^Valoración de /).count(),11);
    assert.equal(await f.page.getByLabel('Valoración de Jugador_12',{exact:true}).count(),0);
    await f.page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    await f.page.getByRole('combobox',{name:'Jugador que añadir a la valoración',exact:true}).selectOption(uuid(41));
    await f.page.getByRole('button',{name:'Añadir a la valoración',exact:true}).click();
    await f.page.getByLabel('Valoración de Jugador_12',{exact:true}).waitFor();
    assert.equal(f.state.ratings,0);
  } finally {await f.close();}
});

test('without a published XI, ratings explain manual selection instead of using availability',async()=>{
  const f=await fixture({route:'/call-up-ratings',noPublishedLineup:true});
  try {
    await f.page.getByText('No se publicó un once para esta convocatoria. Añade manualmente a los jugadores que participaron para valorarlos.',{exact:true}).waitFor();
    assert.equal(await f.page.getByLabel(/^Valoración de /).count(),0);
    await f.page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    await f.page.getByRole('combobox',{name:'Jugador que añadir a la valoración',exact:true}).selectOption(uuid(30));
    await f.page.getByRole('button',{name:'Añadir a la valoración',exact:true}).click();
    await f.page.getByLabel('Valoración de Selu',{exact:true}).waitFor();
  } finally {await f.close();}
});

test('players see only the published poster from a direct lineup link', async () => {
  const f = await fixture({ role: 'player' });
  try {
    await f.page.getByTestId('published-lineup-image').waitFor();
    assert.ok(f.state.publishedReads>0);
    assert.equal(await f.page.getByRole('button',{name:'Guardar borrador',exact:true}).count(),0);
    assert.equal(await f.page.getByRole('button',{name:'Publicar 11',exact:true}).count(),0);
    assert.equal(await f.page.locator('a[download]').count(),0);
    assert.equal(await f.page.getByTestId('lineup-pitch').count(),0);
    assert.equal(await f.page.getByRole('button',{name:'Consulta el 11',exact:true}).count(),0);
    assert.equal(await f.page.getByRole('button',{name:'¡Forma tu 11!',exact:true}).count(),0);
    assert.equal(f.state.lineupReads,0);
    assert.equal(f.state.lineupAccessReads,0);
    assert.equal(f.state.incidentReads, 0);
    assert.equal(f.state.historicalRatingReads, 0);
    assert.equal(await f.page.getByLabel(/^Media histórica de /).count(),0);
    assert.equal(await f.page.getByText(/^VAL MED:/).count(),0);
    assert.equal(await f.page.getByRole('button',{name:/^(Mostrar|Ocultar) valoraciones$/}).count(),0);
    assert.equal(await f.page.getByLabel('Incidencias vigentes', { exact: true }).count(), 0);
    assert.equal(await f.page.getByRole('button', { name: 'Consultar incidencias de jugadores', exact: true }).count(), 0);
  } finally { await f.close(); }
});

test('an open lineup removes expired marks, consultation and publication warning without a reload', async () => {
  const f = await fixture({ expiresSoon: true });
  try {
    const consultation = f.page.getByRole('button', { name: 'Consultar incidencias de jugadores', exact: true });
    await consultation.waitFor();
    await f.page.getByRole('button', { name: 'Publicar 11', exact: true }).click();
    const warning = f.page.getByText('Vas a publicar una alineación con jugadores que tienen incidencias.', { exact: true });
    await warning.waitFor();
    await f.page.clock.fastForward(61000);
    await warning.waitFor({ state: 'hidden' });
    assert.equal(await consultation.count(), 0);
    assert.equal(await f.page.getByLabel('Incidencias vigentes', { exact: true }).count(), 1, 'only the benched player still has an active incident');
  } finally { await f.close(); }
});

 test('captain confirms deletion from the published instructions list',async()=>{
 const f=await fixture({seedInstructions:true});
 try {
  const {page}=f;
  await page.getByRole('button',{name:'Indicaciones de jugadores',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar indicación de Selu',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(f.state.instructionDeletes.length,0);
  await page.getByText('Indicación privada para Selu',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Eliminar indicación de Selu',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar indicación',exact:true}).click();
  await page.getByText('Indicación privada para otro jugador',{exact:true}).waitFor();
  assert.equal(await page.getByText('Indicación privada para Selu',{exact:true}).count(),0);
  assert.deepEqual(f.state.instructionDeletes,[uuid(120)]);
 } finally {await f.close();}
});

test('rating buttons distinguish zero, ten, not rated and not selected',async()=>{
 const f=await fixture({route:'/call-up-ratings'});
 try {
  const {page}=f;
  const zero=page.getByRole('radio',{name:'Nota 0 para Selu',exact:true});
  const ten=page.getByRole('radio',{name:'Nota 10 para Selu',exact:true});
  const clear=page.getByRole('radio',{name:'Sin valorar: Selu',exact:true});
  await zero.click();assert.equal(await zero.getAttribute('aria-checked'),'true');
  await ten.click();assert.equal(await ten.getAttribute('aria-checked'),'true');
  assert.equal(await zero.getAttribute('aria-checked'),'false');
  await page.getByRole('button',{name:'No alineado: Selu',exact:true}).click();
  await page.getByText('No alineado',{exact:true}).waitFor();
  await clear.click();assert.equal(await clear.getAttribute('aria-checked'),'true');
  assert.equal(await page.getByText('No alineado',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).isDisabled(),true);
  await zero.click();
  await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).click();
  await page.getByText('Valoraciones guardadas.',{exact:true}).waitFor();
  assert.equal(f.state.ratingChanges[0].p_ratings[0].score,0);
  await page.getByRole('button',{name:'No alineado: Selu',exact:true}).click();
  await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).click();
  await page.getByText('Valoraciones guardadas.',{exact:true}).waitFor();
  assert.equal(f.state.ratingChanges[1].p_ratings[0].not_selected,true);
  assert.equal('score' in f.state.ratingChanges[1].p_ratings[0],false);
  await page.getByLabel('Valoración de Selu',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'/workspace/shared/rating-selector.png',fullPage:false});
 }finally {await f.close();}
});

test('captain sees match averages separately from their own unsaved rating',async()=>{
 const f=await fixture({route:'/call-up-ratings',ratingMeans:true});
 try {
  const {page}=f;
  await page.getByText('Valoración media capitanes: 7,50',{exact:true}).waitFor();
  await page.getByText('Valoración media capitanes: 0,00',{exact:true}).waitFor();
  assert.ok(await page.getByText('Valoración media capitanes: Sin valoraciones',{exact:true}).count()>0);
  assert.equal(await page.getByRole('radio',{name:'Sin valorar: Selu',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByRole('radio',{name:'Nota 10 para Selu',exact:true}).click();
  await page.getByText('Valoración media capitanes: 7,50',{exact:true}).waitFor();
  f.state.averageScore=9;
  await page.clock.runFor(20000);
  await page.getByText('Valoración media capitanes: 9,00',{exact:true}).waitFor();
  assert.equal(await page.getByRole('radio',{name:'Nota 10 para Selu',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByRole('button',{name:'Guardar valoraciones',exact:true}).click();
  await page.getByText('Valoración media capitanes: 8,00',{exact:true}).waitFor();
  assert.equal(f.state.ratingChanges[0].p_ratings[0].score,10);
 }finally {await f.close();}
});

test('captain sees coloured historical averages on the pitch, bench and player selector',async()=>{
 const f=await fixture({withHistory:true});
 try {
  const {page}=f;
  const expected=[['Selu','2,5','rgb(255, 139, 139)'],['Jugador_2','4,5','rgb(255, 188, 102)'],['Jugador_3','5,5','rgb(255, 228, 107)'],['Jugador_4','7','rgb(180, 241, 108)'],['Jugador_12','8,25','rgb(180, 241, 108)']];
  for(const [name,score,colour] of expected){
   const badge=page.getByLabel(`Media histórica de ${name}: ${score} de 10`,{exact:true});
   await badge.waitFor();
   assert.equal(await badge.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.equal(await badge.getByText(score,{exact:true}).evaluate(e=>getComputedStyle(e).color),colour);
  }
  await page.getByText('VAL MED: 49',{exact:true}).waitFor();
  await page.getByLabel('Sin valoraciones históricas para Jugador_5',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Incidencias vigentes',{exact:true}).count(),2);
  await page.getByTestId('lineup-pitch').screenshot({path:'/workspace/shared/lineup-historical-ratings.png'});
  await page.getByRole('button',{name:'Selu, dorsal 1',exact:true}).click();
  assert.equal(await page.getByLabel('Media histórica de Jugador_12: 8,25 de 10',{exact:true}).count(),2);
  await page.getByRole('button',{name:'Elegir Jugador_12',exact:true}).click();
  const pitch=page.getByTestId('lineup-pitch');
  await pitch.getByLabel('Media histórica de Jugador_12: 8,25 de 10',{exact:true}).waitFor();
  assert.equal(await pitch.getByLabel('Media histórica de Selu: 2,5 de 10',{exact:true}).count(),0);
  await pitch.getByText('VAL MED: 63',{exact:true}).waitFor();
 }finally {await f.close();}
});

test('published poster opens from call-up without downloading or loading the editor',async()=>{
 const f=await fixture({role:'player',route:'/call-up',withCrest:true});
 try {
  const {page}=f;let downloads=0;page.on('download',()=>downloads++);
  const crestLoaded=page.waitForResponse(response=>response.url().includes('/storage/v1/object/sign/club-crests/')&&response.request().method()==='GET');
  await page.getByRole('button',{name:'Consulta el 11',exact:true}).click();
  await page.getByTestId('published-lineup-image').waitFor();
  await page.getByTestId('published-lineup-image').locator('svg').waitFor();
  assert.equal(await page.getByTestId('lineup-pitch').count(),0);
  assert.equal(f.state.lineupReads,0);assert.equal(f.state.lineupAccessReads,0);assert.equal(f.state.historicalRatingReads,0);
  assert.equal(downloads,0);
  await crestLoaded;
  const embeddedCrest=page.getByTestId('published-lineup-image').locator('svg image');
  assert.ok((await embeddedCrest.evaluateAll(images=>images.map(img=>img.getAttribute('href')??img.getAttribute('xlink:href')??''))).some(href=>href.startsWith('data:image/png;base64,')));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const screenshot=await page.getByTestId('published-lineup-image').screenshot({path:'/workspace/shared/published-lineup-view.png'});
  const bright=await page.evaluate(async src=>{
   const image=new Image();image.src=src;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const scale=image.naturalWidth/1324;
   const pixels=ctx.getImageData(Math.round(66*scale),Math.round(60*scale),Math.round(104*scale),Math.round(102*scale)).data;
   let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>100&&pixels[i+1]>130&&pixels[i+2]<140)count++;
   return count;
  },'data:image/png;base64,'+screenshot.toString('base64'));
  assert.ok(bright>10,'published image contains the club crest, not an empty frame');
 }finally {await f.close();}
});

test('players see an unpublished message instead of drafts or the editor',async()=>{
 const f=await fixture({role:'player',noPublishedLineup:true});
 try {
  await f.page.getByText('El capitán todavía no ha publicado el once.',{exact:true}).waitFor();
  assert.equal(await f.page.getByTestId('published-lineup-image').count(),0);
  assert.equal(await f.page.getByTestId('lineup-pitch').count(),0);
  assert.equal(f.state.lineupReads,0);assert.equal(f.state.lineupAccessReads,0);
 }finally {await f.close();}
});

test('captain cancels or deletes an incident from the pitch and the warning clears',async()=>{
 const f=await fixture();
 try {
  const {page}=f;
  await page.getByRole('button',{name:'Consultar incidencias de jugadores',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar incidencia de Selu',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.deepEqual(f.state.incidentDeletes,[]);
  await page.getByRole('button',{name:'Eliminar incidencia de Selu',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar incidencia',exact:true}).click();
  await page.getByText('Los jugadores alineados no tienen incidencias vigentes.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  assert.deepEqual(f.state.incidentDeletes,[uuid(100)]);
  assert.equal(await page.getByTestId('lineup-pitch').getByLabel('Incidencias vigentes',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Consultar incidencias de jugadores',exact:true}).count(),0);
 }finally {await f.close();}
});

test('deleting an incident from ratings preserves the unsaved score',async()=>{
 const f=await fixture({route:'/call-up-ratings'});
 try {
  const {page}=f;
  const score=page.getByRole('radio',{name:'Nota 8 para Selu',exact:true});
  await score.click();
  await page.getByRole('button',{name:'Eliminar incidencia de Selu',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar incidencia',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar incidencia de Selu',exact:true}).waitFor({state:'hidden'});
  assert.equal(await score.getAttribute('aria-checked'),'true');
  assert.equal(f.state.ratings,0);
  assert.deepEqual(f.state.incidentDeletes,[uuid(100)]);
 }finally {await f.close();}
});

test('captains can remove an expired incident from history',async()=>{
 const f=await fixture({route:'/incident-history'});
 try {
  const {page}=f;
  await page.getByRole('button',{name:'Eliminar incidencia de Jugador_2',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar incidencia',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar incidencia de Jugador_2',exact:true}).waitFor({state:'hidden'});
  assert.deepEqual(f.state.incidentDeletes,[uuid(101)]);
  assert.equal(await page.getByRole('button',{name:'Eliminar incidencia de Selu',exact:true}).count(),1);
 }finally {await f.close();}
});

test('bench multiselect keeps choices across filters and saves the whole group',async()=>{
 const f=await fixture({benchSelection:true});
 try {
  const {page}=f;
  await page.getByRole('button',{name:'Añadir al banquillo',exact:true}).click();
  const add=()=>page.getByRole('button',{name:'Añadir seleccionados (2)',exact:true});
  assert.equal(await page.getByRole('button',{name:'Añadir seleccionados (0)',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox',{name:'Seleccionar Jugador_13 para el banquillo',exact:true}).click();
  await page.getByRole('button',{name:'Porteros',exact:true}).click();
  await page.getByRole('checkbox',{name:'Seleccionar Jugador_14 para el banquillo',exact:true}).click();
  await add().waitFor();
  await page.getByRole('button',{name:'Todos',exact:true}).click();
  const first=page.getByRole('checkbox',{name:'Seleccionar Jugador_13 para el banquillo',exact:true});
  assert.equal(await first.getAttribute('aria-checked'),'true');
  await first.click();await page.getByRole('button',{name:'Añadir seleccionados (1)',exact:true}).waitFor();
  await first.click();await add().click();
  await page.getByRole('button',{name:'Gestionar Jugador_13 en el banquillo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Gestionar Jugador_14 en el banquillo',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Gestionar Jugador_15 en el banquillo',exact:true}).count(),0);
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.getByText('Borrador guardado.',{exact:true}).waitFor();
  const saved=f.state.instructionSaves.at(-1).p_document;
  assert.deepEqual(saved.bench,[uuid(21),uuid(23),uuid(22)]);
  assert.deepEqual(new Set(saved.manualIds),new Set([uuid(22),uuid(23)]));
  assert.deepEqual(saved.excludedIds,[uuid(24)]);
 }finally {await f.close();}
});

test('closing bench multiselect cancels changes and undo removes an added group together',async()=>{
 const f=await fixture({benchSelection:true});
 try {
  const {page}=f;
  const open=()=>page.getByRole('button',{name:'Añadir al banquillo',exact:true}).click();
  const pick=name=>page.getByRole('checkbox',{name:`Seleccionar ${name} para el banquillo`,exact:true}).click();
  await open();await pick('Jugador_13');
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Gestionar Jugador_13 en el banquillo',exact:true}).count(),0);
  await open();await page.getByRole('button',{name:'Añadir seleccionados (0)',exact:true}).waitFor();
  await pick('Jugador_13');await pick('Jugador_14');
  await page.getByRole('button',{name:'Añadir seleccionados (2)',exact:true}).click();
  await page.getByRole('button',{name:'Gestionar Jugador_14 en el banquillo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Deshacer último cambio',exact:true}).click();
  for(const name of ['Jugador_13','Jugador_14'])assert.equal(await page.getByRole('button',{name:`Gestionar ${name} en el banquillo`,exact:true}).count(),0);
 }finally {await f.close();}
});

test('adding a helper keeps pending roster selections',async()=>{
 const f=await fixture({benchSelection:true});
 try {
  const {page}=f;
  await page.getByRole('button',{name:'Añadir al banquillo',exact:true}).click();
  await page.getByRole('checkbox',{name:'Seleccionar Jugador_13 para el banquillo',exact:true}).click();
  await page.getByRole('button',{name:'Añadir ayuda',exact:true}).click();
  await page.getByRole('button',{name:'Volver',exact:true}).click();
  assert.equal(await page.getByRole('checkbox',{name:'Seleccionar Jugador_13 para el banquillo',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByRole('button',{name:'Añadir ayuda',exact:true}).click();
  await page.getByRole('textbox',{name:'Nombre',exact:true}).fill('Ayuda nueva');
  await page.getByRole('button',{name:'Añadir ayuda',exact:true}).click();
  await page.getByRole('button',{name:'Gestionar Ayuda nueva en el banquillo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Gestionar Jugador_13 en el banquillo',exact:true}).waitFor();
  assert.equal(f.state.guests.length,1);
 }finally {await f.close();}
});

test('rating toggle hides and restores player ratings and team average without editing the lineup',async()=>{
 const f=await fixture({withHistory:true});
 try {
  const {page}=f;
  const toggle=page.getByRole('button',{name:/^(Mostrar|Ocultar) valoraciones$/});
  const color=page.getByRole('button',{name:'Configurar colores de jugadores',exact:true});
  await toggle.waitFor();
  for(const width of [390,320,1032]){
   await page.setViewportSize({width,height:844});
   const [left,right]=await Promise.all([color.boundingBox(),toggle.boundingBox()]);
   assert.ok(right.x>=left.x+left.width);
   assert.ok(Math.abs((left.y+left.height/2)-(right.y+right.height/2))<2);
  }
  assert.equal(await page.getByRole('button',{name:'Ocultar valoraciones',exact:true}).locator('svg').getAttribute('stroke'),'#B4F16C');
  await page.getByText('VAL MED: 49',{exact:true}).waitFor();
  await toggle.click();
  assert.equal(await page.getByRole('button',{name:'Mostrar valoraciones',exact:true}).locator('svg').getAttribute('stroke'),'#AABCB0');
  assert.equal(await page.getByText(/^VAL MED:/).count(),0);
  assert.equal(await page.getByLabel(/^Media histórica de /).count(),0);
  assert.equal(await page.getByLabel(/^Sin valoraciones históricas para /).count(),0);
  assert.equal(await page.getByLabel('Incidencias vigentes',{exact:true}).count(),2);
  await page.getByRole('button',{name:'Selu, dorsal 1',exact:true}).click();
  await page.getByRole('button',{name:'Elegir Jugador_12',exact:true}).waitFor();
  assert.equal(await page.getByLabel(/^Media histórica de /).count(),0);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await toggle.click();
  await page.getByText('VAL MED: 49',{exact:true}).waitFor();
  await page.getByLabel('Media histórica de Selu: 2,5 de 10',{exact:true}).waitFor();
  assert.equal(await page.getByText('Tienes cambios sin guardar.',{exact:true}).count(),0);
  assert.equal(f.state.instructionSaves.length,0);
  await color.locator('..').screenshot({path:'/workspace/shared/lineup-rating-star.png'});
 }finally {await f.close();}
});

test('Premium captain withdraws a trial with full free history and sees all archived entries',async()=>{
 const f=await fixture({route:'/roster',rosterFixes:true});
 try {
  const {page}=f;
  await page.getByRole('button',{name:'Quitar prueba de Prueba activa',exact:true}).click();
  await page.getByRole('button',{name:'Quitar prueba',exact:true}).click();
  await page.getByText('Prueba retirada de la plantilla. Las convocatorias anteriores conservan sus datos.',{exact:true}).waitFor();
  assert.deepEqual(f.state.trialWithdrawals,[uuid(308)]);
  await page.getByRole('button',{name:'Historial de pruebas',exact:true}).click();
  await page.getByText('Historial Prémium: 9 pruebas',{exact:true}).waitFor();
  await page.getByText('Prueba archivo 8',{exact:true}).waitFor();
  assert.equal(await page.getByText(/^Historial gratuito:/).count(),0);
 }finally {await f.close();}
});

test('roster helper removal requires confirmation and is hidden from players',async()=>{
 const f=await fixture({route:'/roster',rosterFixes:true});
 try {
  const {page}=f;const remove=page.getByRole('button',{name:'Quitar ayuda Ayuda de plantilla de la plantilla',exact:true});
  await remove.click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(f.state.helperRemovals.length,0);
  await remove.click();await page.getByRole('button',{name:'Quitar ayuda',exact:true}).click();
  await page.getByText('Ayuda de plantilla',{exact:true}).waitFor({state:'hidden'});
  assert.deepEqual(f.state.helperRemovals,[uuid(400)]);
 }finally {await f.close();}
 const player=await fixture({route:'/roster',role:'player',rosterFixes:true});
 try {
  await player.page.getByText('Ayuda de plantilla',{exact:true}).waitFor();
  assert.equal(await player.page.getByRole('button',{name:'Quitar ayuda Ayuda de plantilla de la plantilla',exact:true}).count(),0);
 }finally {await player.close();}
});
