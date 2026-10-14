export type SyncStatus = 'connecting' | 'live' | 'recovering';
type Timer = ReturnType<typeof setTimeout>;
export type SyncScheduler = { timeout: (callback: () => void, delay: number) => Timer; cancelTimeout: (timer: Timer) => void; interval: (callback: () => void, delay: number) => Timer; cancelInterval: (timer: Timer) => void };
const scheduler: SyncScheduler = { timeout: (callback, delay) => setTimeout(callback, delay), cancelTimeout: timer => clearTimeout(timer), interval: (callback, delay) => setInterval(callback, delay), cancelInterval: timer => clearInterval(timer) };

export function startCallUpSync({ connect, reload, status, clock = scheduler }: {
  connect: (change: () => void, state: (state: string) => void) => () => void;
  reload: () => void;
  status: (state: SyncStatus) => void;
  clock?: SyncScheduler;
}) {
  let stopped = false, generation = 0, failures = 0;
  let disconnect: (() => void) | undefined;
  let retry: Timer | undefined, pending: Timer | undefined;
  function refresh() {
    if (stopped || pending !== undefined) return;
    pending = clock.timeout(() => { pending = undefined; if (!stopped) reload(); }, 150);
  }
  function reconnect() {
    if (stopped) return;
    const current = ++generation;
    const previous = disconnect; disconnect = undefined; previous?.();
    status(failures ? 'recovering' : 'connecting');
    disconnect = connect(() => { if (current === generation) refresh(); }, state => {
      if (stopped || current !== generation) return;
      if (state === 'SUBSCRIBED') {
        failures = 0;
        if (retry !== undefined) { clock.cancelTimeout(retry); retry = undefined; }
        status('live'); refresh();
      } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(state)) {
        status('recovering'); refresh();
        if (retry === undefined) retry = clock.timeout(() => { retry = undefined; reconnect(); }, Math.min(1000 * 2 ** failures++, 30000));
      }
    });
  }
  refresh(); reconnect();
  const polling = clock.interval(refresh, 30000);
  return {
    refresh,
    stop() {
      stopped = true; generation++;
      if (retry !== undefined) clock.cancelTimeout(retry);
      if (pending !== undefined) clock.cancelTimeout(pending);
      clock.cancelInterval(polling); disconnect?.();
    },
  };
}
