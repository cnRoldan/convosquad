import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };

// A routing marker, never an authorization substitute for a Supabase session.
export class RecoveryState {
  current = false;
  private revision = 0;
  private identity: string | null = null;
  private writes: Promise<void> = Promise.resolve();
  private storage: Storage;
  private key: string;
  private onChange: (value: boolean) => void;

  constructor(storage: Storage, key: string, onChange: (value: boolean) => void) {
    this.storage = storage;
    this.key = key;
    this.onChange = onChange;
  }

  async handle(event: AuthChangeEvent, session: Session | null) {
    if (session && event !== 'INITIAL_SESSION' && event !== 'PASSWORD_RECOVERY' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
    const identity = session ? JSON.stringify([session.user.id, session.user.last_sign_in_at ?? null]) : null;
    // Supabase can re-emit SIGNED_IN when the same session regains focus.
    if (event === 'SIGNED_IN' && this.current && session?.user.last_sign_in_at && identity === this.identity) return;
    const revision = ++this.revision;
    if (event === 'INITIAL_SESSION') {
      await this.writes;
      const marker = await this.storage.getItem(this.key).catch(() => null);
      if (revision !== this.revision) return;
      this.current = Boolean(session && marker === identity);
      this.identity = this.current ? identity : null;
      this.onChange(this.current);
      return;
    }
    if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || !session) {
      this.current = event === 'PASSWORD_RECOVERY' && Boolean(session);
      this.onChange(this.current);
      this.identity = this.current ? identity : null;
      const marker = this.identity;
      this.writes = this.writes.then(() => marker ? this.storage.setItem(this.key, marker) : this.storage.removeItem(this.key)).catch(() => undefined);
      await this.writes;
    }
  }
}
