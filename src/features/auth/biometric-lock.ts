export type LockState = { userId: string | null; ready: boolean; enabled: boolean; locked: boolean; hidden: boolean; authInactive: boolean; busy: boolean; error: string };
export function needsNativeLockCover(state: LockState, ready: boolean, alreadyPresented: boolean) {
  // Restoring/clearing an account is not a biometric challenge. Presenting a
  // UIKit modal for that one-render mismatch can leave it stuck over login.
  if (!ready || !state.userId || !state.enabled) return false;
  // Do not present another native modal while Face ID is closing on the settings
  // screen. A lock cover already presented before authentication stays in place.
  return state.locked || (state.hidden && (!state.authInactive || alreadyPresented));
}
export function biometricPresentation(state: LockState, userId: string | null, authLoading: boolean, alreadyPresented: boolean) {
  const ready = !authLoading && state.ready && state.userId === userId;
  return {
    ready,
    blocked: !ready || (state.enabled && (state.locked || state.hidden)),
    nativeCover: needsNativeLockCover(state, ready, alreadyPresented),
  };
}
type Dependencies = { read(userId: string): Promise<boolean>; write(userId: string, enabled: boolean): Promise<void>; authenticate(): Promise<boolean>; now(): number };
export class BiometricLock {
  private state: LockState = { userId: null, ready: false, enabled: false, locked: true, hidden: false, authInactive: false, busy: false, error: '' };
  private listeners = new Set<() => void>();
  private version = 0;
  private awaySince: number | null = null;
  private backgroundEpoch = 0;
  private authenticating = false;
  private autoAttempted = false;
  private readonly dependencies: Dependencies;
  constructor(dependencies: Dependencies) { this.dependencies = dependencies; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(next: Partial<LockState>) {
    if (Object.entries(next).every(([key, value]) => this.state[key as keyof LockState] === value)) return;
    this.state = { ...this.state, ...next }; this.listeners.forEach(listener => listener());
  }
  async setUser(userId: string | null) {
    if (this.state.ready && this.state.userId === userId) return;
    const version = ++this.version;
    this.awaySince = null;
    this.autoAttempted = false;
    this.update({ userId, ready: false, locked: true, enabled: false, busy: this.authenticating, error: '' });
    if (!userId) { this.update({ ready: true, locked: false }); return; }
    try {
      const enabled = await this.dependencies.read(userId);
      if (version === this.version) this.update({ enabled, locked: enabled, ready: true });
    } catch { if (version === this.version) this.update({ enabled: true, locked: true, ready: true, error: 'No se pudo leer la configuración de seguridad. Puedes volver a iniciar sesión.' }); }
  }
  async unlockAutomatically() {
    if (this.autoAttempted || !this.canUnlock()) return;
    this.autoAttempted = true;
    await this.unlock();
  }
  private canUnlock() {
    return !this.authenticating && !this.state.busy && Boolean(this.state.userId) && this.state.ready && this.state.locked && !this.state.hidden;
  }
  private finishAuthentication() {
    this.authenticating = false;
    if (this.state.hidden && this.awaySince === null) this.awaySince = this.dependencies.now();
    this.update({ busy: false });
  }
  async unlock() {
    if (!this.canUnlock()) return;
    const version = this.version;
    const background = this.backgroundEpoch;
    this.autoAttempted = true;
    this.authenticating = true;
    this.update({ busy: true, error: '' });
    try {
      const success = await this.dependencies.authenticate();
      // Face ID can resolve while iOS is still inactive. Keep the privacy cover
      // until active, but accept success unless the app really entered background.
      if (version === this.version) this.update({ locked: !success || background !== this.backgroundEpoch, error: success ? '' : 'No se ha desbloqueado la sesión. Puedes intentarlo otra vez.' });
    } catch { if (version === this.version) this.update({ error: 'La autenticación no está disponible. Inténtalo otra vez o usa tu contraseña.' }); }
    finally { this.finishAuthentication(); }
  }
  async setEnabled(enabled: boolean) {
    const userId = this.state.userId;
    if (!userId || !this.state.ready || this.state.busy || this.state.locked) return false;
    const version = this.version;
    const background = this.backgroundEpoch;
    if (this.authenticating) return false;
    this.authenticating = true;
    this.update({ busy: true, error: '' });
    try {
      if (!await this.dependencies.authenticate() || version !== this.version || background !== this.backgroundEpoch) return false;
      await this.dependencies.write(userId, enabled);
      if (version !== this.version) return false;
      this.update({ enabled, locked: false });
      return true;
    } catch { if (version === this.version) this.update({ error: 'No se pudo guardar la configuración de biometría.' }); return false; }
    finally { this.finishAuthentication(); }
  }
  appState(state: string) {
    const hidden = state !== 'active';
    if (hidden) {
      if (state === 'background') {
        this.backgroundEpoch++;
        if (this.authenticating && this.state.enabled) {
          this.autoAttempted = false;
          this.update({ locked: true });
        }
      }
      if (!this.state.busy && this.awaySince === null) this.awaySince = this.dependencies.now();
      this.update({ hidden, authInactive: state === 'inactive' && (this.authenticating || this.state.authInactive) });
    } else {
      const elapsed = this.awaySince === null ? 0 : this.dependencies.now() - this.awaySince;
      this.awaySince = null;
      if (this.state.enabled && !this.state.locked && elapsed >= 30_000) this.autoAttempted = false;
      this.update({ hidden, authInactive: false, ...(this.state.enabled && elapsed >= 30_000 ? { locked: true } : {}) });
    }
  }
}
