export class DeviceWriteGate {
  private writes: Promise<unknown> = Promise.resolve();
  private paused = new Set<string>();
  pause(userId: string) { this.paused.add(userId); }
  resume(userId: string) { this.paused.delete(userId); }
  allowed(userId: string) { return !this.paused.has(userId); }
  run<T>(action: () => Promise<T>): Promise<T> {
    const next = this.writes.catch(() => undefined).then(action);
    this.writes = next; return next;
  }
}
