// A fresh tracker is created for each authenticated account. Keep activity
// independent of token-refresh events and never send heartbeats in background.
export function createActivityTracker(record: () => Promise<void>, now = Date.now) {
  let lastRecorded: number | null = null;
  let pending = false;
  let stopped = false;
  return {
    async recordForeground(visible: boolean) {
      if (stopped || !visible || pending || (lastRecorded !== null && now() - lastRecorded < 15 * 60_000)) return;
      pending = true;
      try {
        await record();
        lastRecorded = now();
      } catch {
        // Activity reporting must never prevent using the app. Retry on the
        // next foreground event/tick instead of treating a failed write as use.
      } finally { pending = false; }
    },
    stop() { stopped = true; },
  };
}
