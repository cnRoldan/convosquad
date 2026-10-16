export function createCrestCache(load: (path: string) => Promise<string>, now = Date.now) {
  const entries = new Map<string, { url: string; expires: number }>();
  const pending = new Map<string, Promise<string>>();
  const versions = new Map<string, number>();
  const listeners = new Set<() => void>();
  let generation = 0, sequence = 0;
  const key = (user: string, path: string) => `${user}:${path}`;
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    version(path: string) { return versions.get(path) ?? generation; },
    peek(user: string, path: string) {
      const entry = entries.get(key(user, path));
      return entry && entry.expires > now() ? entry.url : null;
    },
    async get(user: string, path: string): Promise<string> {
      const id = key(user, path), cached = this.peek(user, path);
      if (cached) return cached;
      if (pending.has(id)) return pending.get(id)!;
      const version = this.version(path);
      const request = load(path).then(url => {
        const versioned = `${url}${url.includes('?') ? '&' : '?'}crest_version=${version}`;
        if (version === this.version(path)) {
          if (entries.size >= 30) entries.delete(entries.keys().next().value!);
          entries.set(id, { url: versioned, expires: now() + 55 * 60_000 });
        }
        return versioned;
      }).finally(() => { if (pending.get(id) === request) pending.delete(id); });
      pending.set(id, request);
      return request;
    },
    invalidate(path: string) {
      versions.set(path, ++sequence);
      for (const id of entries.keys()) if (id.endsWith(`:${path}`)) entries.delete(id);
      for (const id of pending.keys()) if (id.endsWith(`:${path}`)) pending.delete(id);
      listeners.forEach(listener => listener());
    },
    clear() {
      generation = ++sequence; entries.clear(); pending.clear(); versions.clear();
      listeners.forEach(listener => listener());
    },
  };
}
