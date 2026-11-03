type Store = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
type Manifest = { generation: string; count: number };

/** Chunk sessions under SecureStore's value limit; switch the manifest only after
 * all new chunks have been persisted, then remove obsolete chunks and plaintext. */
export function createSecureSessionStorage(secure: Store, legacy: Store, generation: () => string) {
  const manifestKey = (key: string) => `auth.${Array.from(key).map(c => c.codePointAt(0)!.toString(16)).join('_')}`;
  function decode(raw: string): Manifest {
    const value = JSON.parse(raw) as Manifest;
    if (!value || typeof value.generation !== 'string' || !/^[a-zA-Z0-9-]+$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > 1000) throw new Error('Invalid secure session');
    return value;
  }
  async function clean(key: string, manifest: Manifest) {
    await Promise.all(Array.from({ length: manifest.count }, (_, i) => secure.removeItem(`${key}.${manifest.generation}.${i}`)));
  }
  const adapter = {
    async getItem(key: string): Promise<string | null> {
      const base = manifestKey(key);
      const raw = await secure.getItem(base);
      if (raw !== null) {
        const m = decode(raw);
        const chunks = await Promise.all(Array.from({ length: m.count }, (_, i) => secure.getItem(`${base}.${m.generation}.${i}`)));
        if (chunks.some(chunk => chunk === null)) throw new Error('Incomplete secure session');
        return chunks.join('');
      }
      const old = await legacy.getItem(key);
      if (old !== null) await adapter.setItem(key, old);
      return old;
    },
    async setItem(key: string, value: string) {
      const base = manifestKey(key);
      const previous = await secure.getItem(base);
      const characters = Array.from(value);
      const chunks: string[] = [];
      for (let i = 0; i < characters.length; i += 450) chunks.push(characters.slice(i, i + 450).join(''));
      if (!chunks.length) chunks.push('');
      const next = { generation: generation(), count: chunks.length };
      try {
        for (let i = 0; i < chunks.length; i++) await secure.setItem(`${base}.${next.generation}.${i}`, chunks[i]!);
        await secure.setItem(base, JSON.stringify(next));
      } catch (error) { await clean(base, next).catch(() => undefined); throw error; }
      await legacy.removeItem(key);
      if (previous !== null) await clean(base, decode(previous)).catch(() => undefined);
    },
    async removeItem(key: string) {
      const base = manifestKey(key);
      const previous = await secure.getItem(base);
      // Delete the migration source first so logout cannot resurrect it.
      await legacy.removeItem(key);
      await secure.removeItem(base);
      if (previous !== null) await clean(base, decode(previous)).catch(() => undefined);
    },
  };
  return adapter;
}
