import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const root = new URL('../supabase/functions/', import.meta.url);
const config = JSON.parse(await readFile(new URL('deno.json', root), 'utf8'));
const files = ['_shared/push-language.ts', '_shared/push-event.ts', '_shared/reminder-worker.ts', 'send-reminders/index.ts'];
const parts = [];
for (const file of files) {
  const source = await readFile(new URL(file, root), 'utf8');
  parts.push(source.replace(/^import .* from ['"]\.\.?\/.*['"];\r?\n/gm, '')
    .replace("from '@supabase/supabase-js'", `from '${config.imports['@supabase/supabase-js']}'`).trim());
}
const imports = parts.flatMap(part => part.match(/^import .*;$/gm) ?? []);
const bodies = parts.map(part => part.replace(/^import .*;\r?\n/gm, '').trim());
const generated = '// Generado con node scripts/export-reminder-dashboard.mjs. Edita los archivos originales.\n' + imports.join('\n') + '\n\n' + bodies.join('\n\n') + '\n';
const target = new URL('send-reminders/dashboard.ts', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== generated) throw new Error('Regenera send-reminders/dashboard.ts desde sus archivos originales.');
  console.log('Versión para el editor de Supabase alineada con el worker original.');
} else {
  await writeFile(target, generated);
  console.log('Versión completa para el editor de Supabase generada.');
}
