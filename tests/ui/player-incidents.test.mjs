import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';

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

async function fixture({ route = '/lineup', role = 'admin', race = false, expiresSoon = false, suggestions = false, historyError = false, posterExample = false, noPublishedLineup = false, viewport = { width: 390, height: 844 } } = {}) {
  const context = await browser.newContext({ viewport, locale: 'es-ES' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const now = Date.now();
  if (expiresSoon) await page.clock.install({ time: now });
  const errors = [], unexpected = [], publications = [];
  const state = { incidentReads: 0, recorded: [], ratings: 0 };
  page.on('pageerror', error => errors.push(error.message));
  const club = { id: clubId, name: 'Incidents club', timezone: 'Europe/Madrid', ratings_visibility: 'captains' };
  const roster = Array.from({ length: 12 }, (_, i) => ({ id: uuid(10 + i), club_id: clubId, ea_id: i === 0 ? 'Selu' : `Jugador_${i + 1}`, nickname: null, jersey_number: i + 1, category: i === 0 ? 'goalkeepers' : 'midfielders', position: 'MC', sort_order: i, is_active: true, user_id: i === 0 ? userId : null }));
  if (suggestions) roster[11].category = 'attackers';
  if (posterExample) {
    const names=['Rojo impar','Selu','Salsinhes','MAZO NEGRO','Junior','k1mbowx','Boni','Pulpito','Twichpapiiisunda','Manoliko','istateclapeain02'];
    const numbers=[23,22,24,31,12,20,8,80,18,91,5];
    for(let i=0;i<11;i++){roster[i].ea_id=names[i];roster[i].jersey_number=numbers[i];}
  }
  const next = { id: nextId, club_id: clubId, starts_at: new Date(now + 3600000).toISOString(), ends_at: new Date(now + 10800000).toISOString(), evaluation_at: null, timezone: club.timezone, status: 'open', status_version: 1 };
  const past = { ...next, id: pastId, starts_at: new Date(now - 7200000).toISOString(), ends_at: new Date(now - 3600000).toISOString(), evaluation_at: new Date(now - 3600000).toISOString() };
  const entries = roster.map((player, i) => ({ id: uuid(30 + i), call_up_id: pastId, club_id: clubId, source_player_id: player.id, ea_id_snapshot: player.ea_id, user_id: player.user_id, availability: 'available', category_snapshot: player.category, position_snapshot: 'MC', jersey_number_snapshot: i + 1, sort_order_snapshot: i }));
  if(route==='/call-up-ratings') entries[0].availability='unavailable';
  const positions = posterExample ? [[.5,.9],[.25,.72],[.5,.72],[.75,.72],[.16,.45],[.5,.56],[.34,.34],[.66,.34],[.84,.45],[.36,.15],[.64,.15]] : [[.5,.9],[.2,.72],[.4,.72],[.6,.72],[.8,.72],[.2,.43],[.4,.43],[.6,.43],[.8,.43],[.36,.15],[.64,.15]];
  let document = { formation: posterExample ? '3-5-2' : '4-4-2', slots: positions.map(([x,y], id) => ({ id, x, y, playerId: roster[id].id })), bench: [roster[11].id] };
  let draft = null;
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
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    let result;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (endpoint === 'lineup_position_experience') {
      assert.equal(role, 'admin'); assert.equal(body.p_call_id, nextId);
      if (historyError) return route.fulfill({ status: 500, json: { message: 'History unavailable' } });
      result = suggestions ? [{player_id:roster[4].id,category:'attackers',appearances:3}] : [];
    } else if (endpoint === 'list_player_incidents') {
      state.incidentReads++;
      assert.equal(role, 'admin');
      result = incidents.filter(incident => (!body.p_active_only || Date.parse(incident.expires_at) > (expiresSoon ? now : Date.now())) && (!body.p_call_up_id || incident.call_up_id === body.p_call_up_id));
    } else if (endpoint === 'record_player_incident') {
      state.recorded.push(body);
      const index = entries.findIndex(entry => entry.id === body.p_entry_id);
      const incident = { ...makeIncident(index, 110), kind: body.p_kind, note: body.p_note };
      incidents.push(incident); result = incident;
    } else if (endpoint === 'save_player_ratings') { state.ratings++; result = 1; }
    else if (endpoint === 'publish_lineup_draft') {
      publications.push(body);
      if (race && publications.length === 1) {
        incidents.push(makeIncident(2, 103));
        return route.fulfill({ status: 409, json: { code: 'P0052', message: 'New incident' } });
      }
      assert.ok(body.p_acknowledged_incidents.includes(uuid(100)));
      if (race) assert.ok(body.p_acknowledged_incidents.includes(uuid(103)));
      assert.ok(!body.p_acknowledged_incidents.includes(uuid(102)), 'bench incident must not be acknowledged');
      result = null;
    } else if (endpoint === 'save_lineup_draft') {
      document = body.p_document;
      draft = { id: uuid(90), ordinal: 1, title: body.p_title, document, revision: (draft?.revision ?? 0) + 1, submittedAt: null, createdBy: 'Capitán', updatedBy: 'Capitán', upVotes: 0, downVotes: 0, published: false };
      result = draft;
    } else if (endpoint === 'read_lineup_access') result = { allowed: true, premium: true, activated: true, remaining: 6 };
    else if (endpoint === 'read_lineup') result = { document, revision: 0, inherited: false };
    else if (endpoint === 'list_lineup_drafts') result = draft ? [draft] : [];
    else if (endpoint === 'set_lineup_position_lock') { positionLocked=body.p_locked; result=positionLocked; }
    else if (endpoint === 'read_lineup_preference') result = { playerColor: '#4C000B', jerseyColor: '#B3FF61', goalkeeperColor: '#F4A83A', positionLocked };
    else if (endpoint === 'list_rating_call_ups') result = [past];
    else if (endpoint === 'read_rating_lineup') { assert.equal(body.p_call_id,pastId); result={published:!noPublishedLineup,entryIds:noPublishedLineup?[]:entries.slice(0,11).map(entry=>entry.id)}; }
    else if (endpoint === 'set_preferred_language') result = null;
    else if (endpoint === 'clubs') result = request.headers().accept?.includes('object') ? club : [club];
    else if (endpoint === 'club_members') result = [{ id: uuid(5), club_id: clubId, user_id: userId, role, is_active: true }];
    else if (endpoint === 'profiles') result = { id: userId, username: 'Capitán' };
    else if (endpoint === 'players') result = roster;
    else if (endpoint === 'call_ups') result = request.headers().accept?.includes('object') ? (url.searchParams.get('id') === `eq.${pastId}` ? past : next) : [next];
    else if (endpoint === 'call_up_players') result = entries;
    else if (['list_lineup_guests', 'call_up_trials', 'call_up_aids', 'club_trials', 'club_trial_notes', 'player_ratings', 'join_requests', 'player_link_requests', 'notification_preferences'].includes(endpoint)) result = [];
    else { unexpected.push(endpoint); return route.abort(); }
    return route.fulfill({ json: result });
  });
  await page.goto(`${origin}${route}${route === '/lineup' ? `?id=${nextId}` : route === '/call-up-ratings' ? `?id=${pastId}` : ''}`);
  async function close() { await context.close(); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); }
  return { page, state, incidents, publications, close };
}

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

test('generated poster downloads a full resolution PNG for a custom pivot lineup', async () => {
  const f=await fixture({posterExample:true});
  try {
    const {page}=f;
    await page.getByRole('button',{name:'Publicar 11',exact:true}).last().click();
    await page.getByRole('button',{name:'Publicar 11',exact:true}).last().click();
    await page.getByText('🎉 Once publicado',{exact:true}).waitFor();
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Generar imagen',exact:true}).click();
    const download=await pending;
    assert.equal(download.suggestedFilename(),'convosquad-once.png');
    const file='/workspace/shared/lineup-uniform-shirts.png';
    await download.saveAs(file);
    const png=readFileSync(file);
    assert.equal(png.readUInt32BE(16),1324);assert.equal(png.readUInt32BE(20),1190);
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
    const score = page.getByRole('combobox', { name: 'Valoración de Selu', exact: true });
    await score.selectOption('8');
    await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).first().click();
    await page.getByRole('combobox', { name: 'Motivo de la incidencia' }).selectOption('no_show');
    await page.getByRole('textbox', { name: 'Observación', exact: true }).fill('No entró y avisó al capitán');
    await page.getByRole('button', { name: 'Guardar incidencia', exact: true }).click();
    await page.getByText('Incidencia registrada. La marca estará vigente durante una semana.', { exact: true }).waitFor();
    assert.equal(await score.inputValue(), '8');
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
    await f.page.getByRole('combobox',{name:'Valoración de Selu',exact:true}).waitFor();
    assert.equal(await f.page.getByRole('combobox',{name:/^Valoración de /}).count(),11);
    assert.equal(await f.page.getByRole('combobox',{name:'Valoración de Jugador_12',exact:true}).count(),0);
    await f.page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    await f.page.getByRole('combobox',{name:'Jugador que añadir a la valoración',exact:true}).selectOption(uuid(41));
    await f.page.getByRole('button',{name:'Añadir a la valoración',exact:true}).click();
    await f.page.getByRole('combobox',{name:'Valoración de Jugador_12',exact:true}).waitFor();
    assert.equal(f.state.ratings,0);
  } finally {await f.close();}
});

test('without a published XI, ratings explain manual selection instead of using availability',async()=>{
  const f=await fixture({route:'/call-up-ratings',noPublishedLineup:true});
  try {
    await f.page.getByText('No se publicó un once para esta convocatoria. Añade manualmente a los jugadores que participaron para valorarlos.',{exact:true}).waitFor();
    assert.equal(await f.page.getByRole('combobox',{name:/^Valoración de /}).count(),0);
    await f.page.getByRole('button',{name:'Añadir jugador a la valoración',exact:true}).click();
    await f.page.getByRole('combobox',{name:'Jugador que añadir a la valoración',exact:true}).selectOption(uuid(30));
    await f.page.getByRole('button',{name:'Añadir a la valoración',exact:true}).click();
    await f.page.getByRole('combobox',{name:'Valoración de Selu',exact:true}).waitFor();
  } finally {await f.close();}
});

test('players never request private incidents or see incident actions', async () => {
  const f = await fixture({ role: 'player' });
  try {
    await f.page.getByText('Banquillo', { exact: true }).waitFor();
    assert.equal(f.state.incidentReads, 0);
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
