import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

let browser, server, origin;
const root = path.resolve('dist-ui');
const userId = '00000000-0000-4000-8000-000000000001';
const clubId = '00000000-0000-4000-8000-000000000002';
const callId = '00000000-0000-4000-8000-000000000003';
const categories = ['goalkeepers', 'centre_backs', 'wide_backs', 'midfielders', 'attackers', 'backups'];
const statuses = ['available', 'unavailable', 'backup', 'unanswered'];
const stateLabels = ['Disponibles', 'No disponibles', 'Backup', 'Pendientes'];
const rowName = index => index === 0 ? 'UnNombreEAEspecialmenteLargoQueDebeSeguirSiendoLegible' : `Jugador_${index + 1}`;

before(async () => {
  server = createServer((req, res) => {
    const requestPath = new URL(req.url, 'http://localhost').pathname;
    let file = path.resolve(root, '.' + decodeURIComponent(requestPath));
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

async function fixture({ width = 390, role = 'player', empty = false, status = 'open', linked = true, cooldown = false, historical = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], unexpected = [], channels = [];
  let initialReloadComplete;
  const initialReload = new Promise(resolve => { initialReloadComplete = resolve; });
  const data = { reads: 0, snapshotReads: 0, writes: 0, trialAdds: 0, restarts: 0, refreshes: 0, release: null, rejectNext: false };
  page.on('pageerror', error => errors.push(error.message));
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const call = { id: callId, club_id: clubId, starts_at: `${date}T20:00:00Z`, local_date: date, timezone: 'Europe/Madrid', status, status_version: 1, created_by: userId, created_at: `${date}T00:00:00Z`, updated_at: `${date}T00:00:00Z` };
  const pastId = '00000000-0000-4000-8000-000000000004';
  const pastCall = { ...call, id: pastId, local_date: '2020-01-01', starts_at: '2020-01-01T20:00:00Z' };
  const players = empty ? [] : Array.from({ length: 24 }, (_, index) => ({
    id: `snapshot-${index}`, club_id: clubId, call_up_id: callId, source_player_id: `player-${index}`,
    user_id: index === 3 ? (linked ? userId : null) : index === 4 ? null : `other-${index}`,
    ea_id_snapshot: rowName(index), jersey_number_snapshot: index + 1, position_snapshot: 'MC',
    category_snapshot: categories[Math.floor(index / 4)], sort_order_snapshot: index, availability: statuses[index % 4],
    responded_at: null, created_at: call.created_at, updated_at: call.updated_at,
  }));
  if (cooldown && players[3]) { players[3].availability = 'available'; players[3].responded_at = new Date().toISOString(); }
  const trialSnapshots = [{ id: 'trial', ea_id_snapshot: 'Trial_fuera_del_total', jersey_number_snapshot: 99, position_snapshot: 'MC', notes_snapshot: null }];
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, last_sign_in_at: new Date().toISOString(), created_at: call.created_at };
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expiry })).toString('base64url')}.fixture`;
  await context.addInitScript(({ user, jwt, expiry }) => {
    localStorage.setItem('sb-auth-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiry, user }));
  }, { user, jwt, expiry });
  await context.route('https://**/*', route => { if (new URL(route.request().url()).hostname === 'auth.example.test') return route.fallback(); unexpected.push('Blocked external HTTP request'); return route.abort(); });
  await context.routeWebSocket('**/realtime/v1/websocket*', socket => {
    socket.onMessage(message => {
      const raw = JSON.parse(String(message));
      const frame = Array.isArray(raw) ? { join_ref: raw[0], ref: raw[1], topic: raw[2], event: raw[3], payload: raw[4] } : raw;
      function send(event, payload) {
        const reply = { join_ref: frame.join_ref, ref: frame.ref, topic: frame.topic, event, payload };
        socket.send(JSON.stringify(Array.isArray(raw) ? [reply.join_ref, reply.ref, reply.topic, reply.event, reply.payload] : reply));
      }
      if (frame.event === 'phx_join') {
        const bindings = frame.payload.config.postgres_changes.map((binding, index) => ({ ...binding, id: index + 1 }));
        channels.push({ send, bindings });
        send('phx_reply', { status: 'ok', response: { postgres_changes: bindings } });
      } else if (frame.event === 'heartbeat' || frame.event === 'phx_leave') send('phx_reply', { status: 'ok', response: {} });
    });
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname !== 'auth.example.test') { unexpected.push(url.hostname); return route.abort(); }
    const endpoint = url.pathname.split('/').at(-1);
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (request.method() !== 'GET') {
      if (endpoint === 'restart_call_up') {
        assert.equal(role, 'admin');
        const body = request.postDataJSON();
        assert.equal(body.p_call_up_id, callId);
        assert.equal(body.p_expected_version, call.status_version);
        data.restarts++; call.status = 'open'; call.status_version += 2;
        call.updated_at = new Date().toISOString();
        for (const player of players) { player.availability = 'unanswered'; player.responded_at = null; }
        return route.fulfill({json: call});
      }
      if (endpoint === 'add_call_up_trial') {
        assert.equal(role, 'admin');
        const body = request.postDataJSON();
        assert.equal(body.p_call_up_id, callId);
        assert.equal('p_ea_id' in body, false);
        const snapshot = { id: 'added-trial', ea_id_snapshot: body.p_name, jersey_number_snapshot: null, position_snapshot: null, notes_snapshot: null };
        trialSnapshots.push(snapshot); data.trialAdds++;
        return route.fulfill({ json: snapshot });
      }
      if (endpoint === 'refresh_call_up_roster') {
        assert.equal(role, 'admin');
        const body = request.postDataJSON();
        assert.equal(body.p_call_up_id, callId);
        assert.equal(body.p_reopen, status === 'cancelled');
        data.refreshes++;
        players[15].category_snapshot = 'attackers';
        if (body.p_reopen) call.status = 'open';
        call.updated_at = new Date().toISOString();
        return route.fulfill({ json: call });
      }
      if (endpoint !== 'respond_to_call_up') { unexpected.push(endpoint); return route.abort(); }
      data.writes++;
      const body = request.postDataJSON();
      assert.equal(body.p_call_up_player_id, 'snapshot-3', 'even administrators must only write their own response');
      await new Promise(resolve => { data.release = resolve; });
      data.release = null;
      if (data.rejectNext) { data.rejectNext = false; return route.fulfill({ status: 403, json: { code: '42501', message: 'Denied' } }); }
      players[3].availability = body.p_availability;
      return route.fulfill({ json: players[3] });
    }
    data.reads++;
    let result;
    if (endpoint === 'clubs') result = [{ id: clubId, name: 'Club de prueba', description: '', timezone: call.timezone }];
    else if (endpoint === 'club_members') result = [{ id: 'member', club_id: clubId, user_id: userId, role, is_active: true }];
    else if (endpoint === 'profiles') result = { id: userId, username: 'fixture' };
    else if (endpoint === 'players') result = players.map(row => ({ id: row.source_player_id, club_id: clubId, ea_id: row.ea_id_snapshot, jersey_number: row.jersey_number_snapshot, category: row.category_snapshot, sort_order: row.sort_order_snapshot, position: row.position_snapshot, user_id: row.user_id, is_active: true }));
    else if (endpoint === 'call_ups') result = request.headers().accept?.includes('object') ? (url.searchParams.get('id') === `eq.${pastId}` ? pastCall : call) : [call];
    else if (endpoint === 'call_up_players') { result = players; data.snapshotReads++; }
    else if (endpoint === 'call_up_trials') result = trialSnapshots;
    else if (endpoint === 'call_up_aids') result = [{ id: 'aid', body: 'Ayuda fuera del total', sort_order: 0 }];
    else if (endpoint === 'club_trials' || endpoint === 'notification_preferences') result = [];
    else { unexpected.push(endpoint); return route.abort(); }
    await route.fulfill({ json: result });
    if (data.snapshotReads >= (status === 'open' ? 3 : 2)) initialReloadComplete();
  });
  function emit(index, availability) {
    players[index].availability = availability;
    for (const channel of channels) {
      const binding = channel.bindings.find(binding => binding.table === 'call_up_players' && binding.event === 'UPDATE');
      channel.send('postgres_changes', { ids: [binding.id], data: { schema: 'public', table: 'call_up_players', type: 'UPDATE', columns: [], record: players[index], old_record: {}, commit_timestamp: new Date().toISOString() } });
    }
  }
  await page.goto(`${origin}/call-up${historical ? `?id=${pastId}&history=1` : ''}`);
  await page.getByRole('button', { name: `Todos (${players.length})`, exact: true }).waitFor();
  if (!historical) await page.getByText('Actualización en directo', { exact: true }).waitFor();
  // Club context, screen snapshot, then the initial Realtime reconciliation.
  await initialReload;
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando convocatoria'));
  if (!historical && !empty && linked && status === 'open' && !cooldown) await page.getByRole('button', { name: 'Disponible para Jugador_4', exact: true, disabled: false }).waitFor();
  async function close() { assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); await context.close(); }
  return { context, page, data, players, emit, close };
}

for (const width of [320, 390, 1280]) test(`filas compactas, paneles y filtros accesibles a ${width}px`, async () => {
  const f = await fixture({ width }); const { page } = f;
  try {
    const rows = page.locator('[data-testid^="call-up-player-"]:visible');
    assert.equal(await rows.count(), 24);
    const height = (await page.getByTestId('call-up-player-snapshot-1').boundingBox()).height;
    assert.ok(height <= 44, `read-only player row should be compact: ${height}px`);
    assert.equal(await page.getByTestId('call-up-player-snapshot-1').getByText('#2', { exact: true }).count(), 1);
    assert.equal(await page.getByTestId('call-up-player-snapshot-1').locator('[aria-label="Dorsal 2"]').count(), 1);
    assert.equal(await page.getByTestId('call-up-player-snapshot-4').getByRole('button').count(), 0);
    assert.equal(await page.getByTestId('call-up-player-snapshot-1').getByRole('button').count(), 0);
    assert.equal(await page.getByTestId('call-up-player-snapshot-3').getByRole('button').count(), 0);
    const floating = page.getByTestId('availability-actions');
    const ownButtons = floating.getByRole('button');
    assert.equal(await ownButtons.count(), 3);
    for (const button of await ownButtons.all()) assert.ok((await button.boundingBox()).height >= 44);
    const bounds = await floating.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 844);
    const tab = await page.getByText('Inicio', { exact: true }).boundingBox();
    assert.ok(bounds.y + bounds.height <= tab.y, 'floating buttons must remain above navigation');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const heading = page.getByRole('button', { name: 'PORTEROS (4)', exact: true });
    await heading.click(); assert.equal(await heading.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByTestId('call-up-player-snapshot-1').isVisible(), false);
    const reads = f.data.reads;
    for (const label of stateLabels) {
      await page.getByRole('button', { name: `${label} (6)`, exact: true }).click();
      assert.equal(await page.getByRole('button', { name: `${label} (6)`, exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByRole('button', { name: 'PRUEBAS (1)', exact: true }).isVisible(), false);
      assert.equal(await page.getByRole('button', { name: 'AYUDAS (1)', exact: true }).isVisible(), false);
    }
    await page.getByRole('button', { name: 'Todos (24)', exact: true }).click();
    assert.equal(await heading.getAttribute('aria-expanded'), 'false');
    assert.equal(f.data.reads, reads, 'changing filters must not query Supabase');
    await heading.click();
    await page.getByRole('button', { name: 'PRUEBAS (1)', exact: true }).click();
    assert.equal(await page.getByText('Trial_fuera_del_total', { exact: false }).isVisible(), false);
    await page.getByRole('button', { name: 'AYUDAS (1)', exact: true }).click();
    assert.equal(await page.getByText('Ayuda fuera del total', { exact: false }).isVisible(), false);
    await page.getByRole('button', { name: 'Disponibles: 6. Filtrar convocatoria', exact: true }).click();
    assert.equal(await rows.count(), 6);
    await page.getByRole('button', { name: 'Disponibles: 6. Filtrar convocatoria', exact: true }).click();
    assert.equal(await rows.count(), 24);
    mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: `test-results/call-up-${width}.png`, fullPage: true });
  } finally { await f.close(); }
});

test('Realtime actualiza contadores y retira una respuesta del filtro Pendientes', async () => {
  const f = await fixture();
  try {
    await f.page.getByRole('button', { name: 'Pendientes (6)', exact: true }).click();
    f.emit(7, 'available');
    await f.page.getByRole('button', { name: 'Pendientes (5)', exact: true }).waitFor();
    assert.equal(await f.page.getByTestId('call-up-player-snapshot-7').count(), 0);
    assert.equal(await f.page.getByRole('button', { name: 'Disponibles: 7. Filtrar convocatoria', exact: true }).count(), 1);
    assert.equal(await f.page.getByRole('button', { name: 'CENTRALES (4)', exact: true }).count(), 0);
  } finally { await f.close(); }
});

test('barra flotante permite responder con la ficha oculta y no tapa el final de la lista', async () => {
  const f = await fixture(); const { page } = f;
  try {
    const bar = page.getByTestId('availability-actions');
    const before = await bar.boundingBox();
    await page.getByRole('button', { name: 'Disponibles (6)', exact: true }).click();
    assert.equal(await page.getByTestId('call-up-player-snapshot-3').count(), 0);
    await bar.getByRole('button', { name: 'Disponible para Jugador_4', exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('Disponibles (7)'));
    f.data.release();
    await bar.getByText('Tu respuesta: Disponible.', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando convocatoria'));
    assert.equal(f.data.writes, 1);
    await page.getByRole('button', { name: 'Todos (24)', exact: true }).click();
    const aid = page.getByText('Ayuda fuera del total', { exact: false });
    await aid.scrollIntoViewIfNeeded();
    const after = await bar.boundingBox();
    assert.ok(Math.abs(before.y - after.y) <= 1, 'the bar must not scroll with the list');
    const end = await aid.boundingBox();
    assert.ok(end.y + end.height <= after.y, 'the final content must be visible above the bar');
  } finally { await f.close(); }
});

test('barra oculta sin ficha vinculada y en convocatorias no abiertas', async () => {
  for (const options of [{ linked: false }, { status: 'closed', role: 'admin' }, { status: 'cancelled', role: 'admin' }, { status: 'draft', role: 'admin' }]) {
    const f = await fixture(options);
    try {
      assert.equal(await f.page.getByTestId('availability-actions').count(), 0);
      assert.equal(f.data.writes, 0);
    } finally { await f.close(); }
  }
});

test('administración con margen y actualización explícita de categorías sin esperar al día siguiente', async () => {
  const f = await fixture({ role: 'admin' }); const { page } = f;
  try {
    await page.getByRole('button', { name: 'Administrar convocatoria', exact: true }).click();
    const state = await page.getByText(/^Estado: Abierta\./).boundingBox();
    const edit = await page.getByRole('button', { name: 'Modificar fecha y hora', exact: true }).boundingBox();
    assert.ok(edit.y - state.y - state.height >= 10, 'actions need space above the buttons');
    await page.getByRole('button', { name: 'Actualizar plantilla de convocatoria', exact: true }).click();
    assert.equal(f.data.refreshes, 0);
    await page.getByRole('button', { name: 'Actualizar plantilla', exact: true }).click();
    await page.getByText('Plantilla de la convocatoria actualizada.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'ATACANTES (5)', exact: true }).waitFor();
    await page.getByRole('button', { name: 'CENTROCAMPISTAS (3)', exact: true }).waitFor();
    assert.equal(f.data.refreshes, 1);
    assert.equal(f.data.writes, 0);
  } finally { await f.close(); }
});

test('reanudar cancelada confirma y utiliza la plantilla actual', async () => {
  const f = await fixture({ role: 'admin', status: 'cancelled' }); const { page } = f;
  try {
    await page.getByRole('button', { name: 'Administrar convocatoria', exact: true }).click();
    await page.getByRole('button', { name: 'Reanudar con plantilla actual', exact: true }).click();
    assert.equal(f.data.refreshes, 0);
    await page.getByRole('button', { name: 'Reanudar con plantilla actual', exact: true }).last().click();
    await page.getByRole('button', { name: 'ATACANTES (5)', exact: true }).waitFor();
    await page.getByTestId('availability-actions').waitFor();
    assert.equal(f.data.refreshes, 1);
  } finally { await f.close(); }
});

test('respuesta propia es inmediata, bloquea pulsaciones rápidas y vuelve al estado real si falla', async () => {
  const f = await fixture({ role: 'admin' }); const { page } = f;
  try {
    const row = page.getByTestId('availability-actions');
    const button = row.getByRole('button', { name: 'Disponible para Jugador_4', exact: true });
    await button.evaluate(element => { element.click(); element.click(); });
    await page.getByText('Guardando respuesta…', { exact: true }).first().waitFor();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => document.body.innerText.includes('Disponibles (7)'));
    assert.equal(f.data.writes, 1);
    assert.equal(await button.getAttribute('aria-disabled'), 'true');
    f.data.release();
    await page.getByText('Tu respuesta: Disponible.', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando convocatoria'));
    f.data.rejectNext = true;
    await row.getByRole('button', { name: 'No disponible para Jugador_4', exact: true }).click();
    await page.getByText('Guardando respuesta…', { exact: true }).first().waitFor();
    await page.waitForFunction(() => document.body.innerText.includes('No disponibles (7)'));
    f.data.release();
    await page.getByText(/La convocatoria ya no está disponible o no tienes permiso/).waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando convocatoria'));
    assert.equal(await row.getByRole('button', { name: 'Disponible para Jugador_4', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByTestId('call-up-player-snapshot-1').getByRole('button').count(), 0, 'admin cannot edit another response');
  } finally { await f.close(); }
});

test('categorías vacías, exclusión de pruebas/ayudas y retorno fácil a Todos', async () => {
  const f = await fixture({ empty: true });
  try {
    for (const category of ['PORTEROS', 'CENTRALES', 'LATERALES / CARRILEROS', 'CENTROCAMPISTAS', 'ATACANTES', 'BACKUPS']) assert.equal(await f.page.getByRole('button', { name: `${category} (0)`, exact: true }).count(), 1);
    await f.page.getByRole('button', { name: 'Disponibles (0)', exact: true }).click();
    await f.page.getByText('No hay jugadores en disponibles.', { exact: true }).waitFor();
    assert.equal(await f.page.getByRole('button', { name: 'PORTEROS (0)', exact: true }).count(), 0);
    await f.page.getByRole('button', { name: 'Mostrar todos', exact: true }).click();
    assert.equal(await f.page.getByRole('button', { name: 'PRUEBAS (1)', exact: true }).isVisible(), true);
    assert.equal(await f.page.getByRole('button', { name: 'Todos (0)', exact: true }).getAttribute('aria-pressed'), 'true');
  } finally { await f.close(); }
});

test('enlace push verifica sesión/club y abre la convocatoria; otro club no obtiene acceso', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/notification?club=${clubId}&call=${callId}`);
    await f.page.getByTestId('call-up-player-snapshot-3').waitFor();
    assert.equal(new URL(f.page.url()).pathname, '/call-up');
    assert.equal(new URL(f.page.url()).searchParams.get('id'), callId);
    await f.page.goto(`${origin}/notification?club=00000000-0000-4000-8000-000000000099&call=${callId}`);
    await f.page.getByText('Ya no perteneces al club de esta convocatoria o no tienes acceso.', { exact: true }).waitFor();
    await f.page.goto(`${origin}/notifications`);
    await f.page.getByText('Las notificaciones de convocatoria están disponibles en la app para Android e iOS.', { exact: true }).waitFor();
    assert.equal(await f.page.getByRole('button', { name: 'Activar notificaciones en este dispositivo', exact: true }).count(), 0);
  } finally { await f.close(); }
});

test('enlace push sin sesión permite iniciar sesión; payload inválido no navega a recursos externos', async () => {
  const context = await browser.newContext(); const page = await context.newPage(); let requests = 0;
  await context.route('https://auth.example.test/**', route => { requests++; return route.abort(); });
  try {
    await page.goto(`${origin}/notification?club=${clubId}&call=${callId}`);
    await page.getByRole('button', { name: 'Iniciar sesión y continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    await page.goto(`${origin}/notification?club=invalid&call=invalid`);
    await page.getByText(/La convocatoria puede haberse cancelado o cerrado/).waitFor();
    assert.equal(requests, 0);
  } finally { await context.close(); }
});

test('bloqueo de 30 segundos visible; Realtime recupera el desbloqueo sin recargar',async()=>{
  const f=await fixture({cooldown:true});
  try{
    const action=f.page.getByRole('button',{name:'Backup para Jugador_4',exact:true});
    assert.equal(await action.getAttribute('aria-disabled'),'true');
    await f.page.getByText(/Podrás cambiar tu voto en \d+ s\./).waitFor();
    assert.equal(f.data.writes,0);
    f.players[3].responded_at=new Date(Date.now()-31_000).toISOString();f.emit(3,'available');
    await f.page.getByRole('button',{name:'Backup para Jugador_4',exact:true,disabled:false}).waitFor();
  }finally{await f.close();}
});

test('consulta histórica es de solo lectura y vuelve a la convocatoria actual sin cambiar de pestaña', async () => {
  const f = await fixture({role: 'admin', historical: true});
  try {
    const {page} = f;
    assert.equal(await page.getByRole('button', {name: 'Crear convocatoria', exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Historial de convocatorias', exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Actualizar convocatoria', exact: true}).count(), 0);
    assert.equal(await page.getByText('Administrar convocatoria', {exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Añadir ayuda', exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Añadir prueba', exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Reiniciar convocatoria', exact: true}).count(), 0);
    assert.equal(await page.getByTestId('availability-actions').count(), 0);
    assert.equal(f.data.writes, 0);
    await page.getByRole('button', {name: 'Volver a la convocatoria actual', exact: true}).click();
    await page.getByRole('button', {name: 'Crear convocatoria', exact: true}).waitFor();
    await page.getByText('Administrar convocatoria', {exact: true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.has('id'), false);
    assert.equal(new URL(page.url()).searchParams.has('history'), false);
    assert.equal(await page.getByRole('button', {name: 'Volver a la convocatoria actual', exact: true}).count(), 0);
  } finally { await f.close(); }
});

test('capitán añade prueba por nombre desde convocatoria sin EA ID ni dorsal y sin alterar totales', async () => {
  const f = await fixture({role: 'admin'});
  try {
    const {page} = f;
    await page.getByRole('textbox', {name: 'Nueva prueba', exact: true}).fill('Amigo de Selu');
    await page.getByRole('button', {name: 'Añadir prueba', exact: true}).click();
    await page.getByText('Amigo de Selu', {exact: true}).waitFor();
    assert.equal(f.data.trialAdds, 1);
    assert.equal(await page.getByRole('button', {name: 'Todos (24)', exact: true}).count(), 1);
    assert.equal(await page.getByText('PRUEBAS (2)', {exact: true}).count(), 1);
    assert.equal(await page.getByText('#99', {exact: true}).count(), 0);
  } finally { await f.close(); }
});

test('reiniciar pide confirmación, cancelar no escribe y confirmar elimina votos y desbloquea respuesta', async () => {
  const f = await fixture({role: 'admin', cooldown: true});
  try {
    const {page} = f;
    await page.getByRole('button', {name: 'Administrar convocatoria', exact: true}).click();
    await page.getByRole('button', {name: 'Reiniciar convocatoria', exact: true}).click();
    await page.getByText(/¿Estás seguro de que deseas reiniciar la convocatoria\?/).waitFor();
    await page.getByRole('button', {name: 'Cancelar', exact: true}).click();
    assert.equal(f.data.restarts, 0);
    await page.getByRole('button', {name: 'Reiniciar convocatoria', exact: true}).click();
    await page.getByRole('button', {name: 'Reiniciar convocatoria', exact: true}).last().click();
    await page.getByRole('button', {name: 'Pendientes (24)', exact: true}).waitFor();
    await page.getByRole('button', {name: 'Disponible para Jugador_4', exact: true, disabled: false}).waitFor();
    assert.equal(f.data.restarts, 1);
    assert.equal(await page.getByText('Ayuda fuera del total', {exact: true}).count(), 1);
  } finally { await f.close(); }
});
