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

async function fixture({ confirmed = true, available = true, clubRole = null, creator = false, wrongPassword = false, failCrestUploadOnce = false, rosterTrials = false, failTrialContacts = false, browserLanguage = 'es-ES' } = {}) {
  const context = await browser.newContext({ locale: browserLanguage, viewport: { width: 390, height: 844 } });
  const userId = '00000000-0000-4000-8000-000000000901';
  const candidateId = '00000000-0000-4000-8000-000000000902';
  const club = { id: '00000000-0000-4000-8000-000000000903', name: 'Club de prueba', timezone: 'UTC', created_by: creator ? userId : '00000000-0000-4000-8000-000000000904', reminder_minutes: null };
  const accounts = [
    { id: 'own', club_id: club.id, user_id: userId, role: clubRole, is_active: true, profiles: { username: 'EA-Player_9' } },
    { id: 'candidate', club_id: club.id, user_id: candidateId, role: 'player', is_active: true, profiles: { username: 'Candidate' } },
    { id: 'unlinked', club_id: club.id, user_id: '00000000-0000-4000-8000-000000000905', role: 'player', is_active: true, profiles: { username: 'SinFicha' } },
  ];
  const players = [userId, candidateId].map((user_id, i) => ({ id: `player-${i}`, club_id: club.id, user_id, ea_id: i ? 'Candidate' : 'EA-Player_9', category: 'backups', sort_order: i, jersey_number: i + 1, is_active: true }));
  if (clubRole) await context.addInitScript(({ userId }) => {
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
  const trialContacts = rosterTrials ? [{trial_id: 'trial-one', phone: '+34600000000'}] : [];
  const trialNotes = rosterTrials ? [{trial_id: 'trial-one', notes: 'Valoración privada del capitán'}] : [];
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
    requests.push({ endpoint, body });
    if (endpoint === 'create_club') { club.name = body.p_name; club.timezone = body.p_timezone; return route.fulfill({json: club}); }
    if (endpoint === 'set_club_crest') { club.crest_path = body.p_has_crest ? `${club.id}/crest.png` : null; return route.fulfill({json: club}); }
    if (endpoint === 'notification_preferences') return route.fulfill({ json: [{ vote_notifications: voteNotifications }] });
    if (endpoint === 'set_notification_preferences') { voteNotifications = body.p_vote_notifications; return route.fulfill({ json: { user_id: userId, vote_notifications: voteNotifications } }); }
    if (endpoint === 'create_call_up_with_schedule') return route.fulfill({ json: { id: 'new-call' } });
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
      if (endpoint === 'call_ups') return route.fulfill({ json: [] });
      if (endpoint === 'set_club_member') {
        const account = accounts.find(row => row.user_id === body.p_user_id);
        account.role = body.p_role;
        return route.fulfill({ json: account });
      }
    }
    if (endpoint === 'settings') return route.fulfill({ json: { mailer_autoconfirm: confirmed, disable_signup: false } });
    if (endpoint === 'is_ea_id_available') return route.fulfill({ json: available });
    if (endpoint === 'user') return route.fulfill({ json: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'ea.player@accounts.convosquad.invalid', user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() } });
    if (endpoint === 'logout') return route.fulfill({ json: {} });
    if (endpoint === 'token' && wrongPassword) return route.fulfill({ status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version' }, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } });
    if (endpoint === 'signup' || endpoint === 'token') {
      const user = { id: '00000000-0000-4000-8000-000000000901', aud: 'authenticated', role: 'authenticated', email: body.email, user_metadata: body.data ?? {}, app_metadata: {}, created_at: new Date().toISOString() };
      const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
      return route.fulfill({ json: { user, access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer' } });
    }
    if (endpoint === 'set_preferred_language') { preferredLanguage = body.p_language; return route.fulfill({json: null}); }
    if (endpoint === 'profiles') return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000901', username: 'EA-Player_9', preferred_language: preferredLanguage } });
    if (['clubs', 'club_members', 'search_clubs', 'club_directory'].includes(endpoint)) return route.fulfill({ json: [] });
    throw new Error(`Unexpected fixture endpoint: ${endpoint}`);
  });
  return { page, requests, crestFixture: transparentPng, async close() { assert.deepEqual(errors, []); await context.close(); } };
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

test('convocatoria propone último aviso a las 18:45, valida hora y lo envía en el RPC atómico', async () => {
  const f=await fixture({clubRole:'admin'});
  try {
    await f.page.goto(`${origin}/create-call-up`);
    const notice=f.page.getByLabel('Último aviso para votar (HH:mm)',{exact:true});
    assert.equal(await notice.inputValue(),'18:45');
    await f.page.getByLabel('Fecha (AAAA-MM-DD)',{exact:true}).fill('2035-06-01');
    await f.page.getByLabel('Hora del club (HH:mm)',{exact:true}).fill('18:00');
    await f.page.getByRole('button',{name:'Revisar convocatoria',exact:true}).click();
    await f.page.getByText('El último aviso debe ser anterior a la hora de la convocatoria.',{exact:true}).waitFor();
    assert.equal(f.requests.some(r=>r.endpoint==='create_call_up_with_schedule'),false);
    await f.page.getByLabel('Hora del club (HH:mm)',{exact:true}).fill('21:50');
    await f.page.getByRole('button',{name:'Revisar convocatoria',exact:true}).click();
    await f.page.getByRole('button',{name:'Crear convocatoria',exact:true}).click();
    await f.page.waitForURL('**/call-up*');
    const request=f.requests.find(r=>r.endpoint==='create_call_up_with_schedule');
    assert.equal(request.body.p_last_notice_at,'2035-06-01T18:45:00.000Z');
    assert.equal(request.body.p_status,'open');
    assert.equal(request.body.p_closes_at,'2035-06-01T21:50:00.000Z');
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
