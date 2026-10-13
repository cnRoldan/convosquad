import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';

export async function createTestDatabase() {
  const database = new PGlite();
  try {
    await database.exec(await readFile(new URL('../supabase/tests/auth-fixture.sql', import.meta.url), 'utf8'));
    const directory = new URL('../supabase/migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      await database.exec(await readFile(new URL(name, directory), 'utf8'));
    }
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

export async function asUser(database, userId, action, role = 'authenticated') {
  return database.transaction(async (transaction) => {
    await transaction.exec(`set local role ${role === 'anon' ? 'anon' : 'authenticated'}`);
    await transaction.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    return action(transaction);
  });
}
