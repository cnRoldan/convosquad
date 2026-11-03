export type LockState = { userId: string | null; ready: boolean; enabled: boolean; locked: boolean; hidden: boolean; busy: boolean; error: string };
type Dependencies = { read(userId: string): Promise<boolean>; write(userId: string, enabled: boolean): Promise<void>; authenticate(): Promise<boolean>; now(): number };
export class BiometricLock {
  private state: LockState = { userId: null, ready: false, enabled: false, locked: true, hidden: false, busy: false, error: '' };
  private listeners = new Set<() => void>();
  private version = 0;
  private awaySince: number | null = null;
  private readonly dependencies: Dependencies;
  constructor(dependencies: Dependencies) { this.dependencies = dependencies; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(next: Partial<LockState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(listener => listener()); }
  async setUser(userId: string | null) {
    const version = ++this.version;
    this.awaySince = null;
    this.update({ userId, ready: false, locked: true, enabled: false, busy: false, error: '' });
    if (!userId) { this.update({ ready: true, locked: false }); return; }
    try {
      const enabled = await this.dependencies.read(userId);
      if (version === this.version) this.update({ enabled, locked: enabled, ready: true });
    } catch { if (version === this.version) this.update({ enabled: true, locked: true, ready: true, error: 'No se pudo leer la configuración de seguridad. Puedes volver a iniciar sesión.' }); }
  }
  async unlock() {
    if (this.state.busy || !this.state.userId || !this.state.ready || !this.state.locked || this.state.hidden) return;
    const version = this.version;
    this.update({ busy: true, error: '' });
    try {
      const success = await this.dependencies.authenticate();
      if (version === this.version) this.update({ locked: !success || this.state.hidden, error: success ? '' : 'No se ha desbloqueado la sesión. Puedes intentarlo otra vez.' });
    } catch { if (version === this.version) this.update({ error: 'La autenticación no está disponible. Inténtalo otra vez o usa tu contraseña.' }); }
    finally { if (version === this.version) this.update({ busy: false }); }
  }
  async setEnabled(enabled: boolean) {
    const userId = this.state.userId;
    if (!userId || !this.state.ready || this.state.busy || this.state.locked) return false;
    const version = this.version;
    this.update({ busy: true, error: '' });
    try {
      if (!await this.dependencies.authenticate() || version !== this.version) return false;
      await this.dependencies.write(userId, enabled);
      if (version !== this.version) return false;
      this.update({ enabled, locked: false });
      return true;
    } catch { if (version === this.version) this.update({ error: 'No se pudo guardar la configuración de biometría.' }); return false; }
    finally { if (version === this.version) this.update({ busy: false }); }
  }
  appState(state: string) {
    const hidden = state !== 'active';
    if (hidden) {
      if (!this.state.busy && this.awaySince === null) this.awaySince = this.dependencies.now();
      this.update({ hidden });
    } else {
      const elapsed = this.awaySince === null ? 0 : this.dependencies.now() - this.awaySince;
      this.awaySince = null;
      this.update({ hidden, ...(this.state.enabled && elapsed >= 30_000 ? { locked: true } : {}) });
    }
  }
}
