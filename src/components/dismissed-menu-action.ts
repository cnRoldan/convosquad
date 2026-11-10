// Auth/navigation can unmount a menu. Run those actions only after its modal
// has actually dismissed, so iOS cannot retain an invisible touch-blocking host.
export class DismissedMenuAction {
  private pending: (() => void) | null = null;
  private disposed = false;

  enqueue(action: () => void) {
    if (this.disposed || this.pending) return false;
    this.pending = action;
    return true;
  }

  dismissed() {
    const action = this.pending;
    this.pending = null;
    if (!this.disposed) action?.();
  }

  dispose() { this.disposed = true; this.pending = null; }
}
