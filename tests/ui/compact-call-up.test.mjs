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

async function fixture({ width = 390, role = 'player', empty = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], unexpected = [], channels = [];
  let initialReloadComplete;
  const initialReload = new Promise(resolve => { initialReloadComplete = resolve; });
  const data = { reads: 0, snapshotReads: 0, writes: 0, release: null, rejectNext: false };
  page.on('pageerror', error => errors.push(error.message));
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const call = { id: callId, club_id: clubId, starts_at: `${date}T20:00:00Z`, local_date: date, timezone: 'Europe/Madrid', status: 'open', created_by: userId, created_at: `${date}T00:00:00Z`, updated_at: `${date}T00:00:00Z` };
  const players = empty ? [] : Array.from({ length: 24 }, (_, index) => ({
    id: `snapshot-${index}`, club_id: clubId, call_up_id: callId, source_player_id: `player-${index}`,
    user_id: index === 3 ? userId : index === 4 ? null : `other-${index}`,
    ea_id_snapshot: rowName(index), jersey_number_snapshot: index + 1, position_snapshot: 'MC',
    category_snapshot: categories[Math.floor(index / 4)], sort_order_snapshot: index, availability: statuses[index % 4],
    responded_at: null, created_at: call.created_at, updated_at: call.updated_at,
  }));
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, last_sign_in_at: new Date().toISOString(), created_at: call.created_at };
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: expiry })).toString('base64url')}.fixture`;
  await context.addInitScript(({ user, jwt, expiry }) => {
    localStorage.setItem('sb-auth-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiry, user }));
  }, { user, jwt, expiry });
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
    else if (endpoint === 'call_ups') result = request.headers().accept?.includes('object') ? call : [call];
    else if (endpoint === 'call_up_players') { result = players; data.snapshotReads++; }
    else if (endpoint === 'call_up_trials') result = [{ id: 'trial', ea_id_snapshot: 'Trial_fuera_del_total', jersey_number_snapshot: 99, position_snapshot: 'MC', notes_snapshot: null }];
    else if (endpoint === 'call_up_aids') result = [{ id: 'aid', body: 'Ayuda fuera del total', sort_order: 0 }];
    else if (endpoint === 'club_trials') result = [];
    else { unexpected.push(endpoint); return route.abort(); }
    await route.fulfill({ json: result });
    if (data.snapshotReads >= 3) initialReloadComplete();
  });
  function emit(index, availability) {
    players[index].availability = availability;
    for (const channel of channels) {
      const binding = channel.bindings.find(binding => binding.table === 'call_up_players' && binding.event === 'UPDATE');
      channel.send('postgres_changes', { ids: [binding.id], data: { schema: 'public', table: 'call_up_players', type: 'UPDATE', columns: [], record: players[index], old_record: {}, commit_timestamp: new Date().toISOString() } });
    }
  }
  await page.goto(`${origin}/call-up`);
  await page.getByRole('button', { name: `Todos (${players.length})`, exact: true }).waitFor();
  await page.getByText('Actualización en directo', { exact: true }).waitFor();
  // Club context, screen snapshot, then the initial Realtime reconciliation.
  await initialReload;
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando convocatoria'));
  if (!empty) await page.getByRole('button', { name: 'Disponible para Jugador_4', exact: true, disabled: false }).waitFor();
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
    const ownButtons = page.getByTestId('call-up-player-snapshot-3').getByRole('button');
    assert.equal(await ownButtons.count(), 3);
    for (const button of await ownButtons.all()) assert.ok((await button.boundingBox()).height >= 44);
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

test('respuesta propia es inmediata, bloquea pulsaciones rápidas y vuelve al estado real si falla', async () => {
  const f = await fixture({ role: 'admin' }); const { page } = f;
  try {
    const row = page.getByTestId('call-up-player-snapshot-3');
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
