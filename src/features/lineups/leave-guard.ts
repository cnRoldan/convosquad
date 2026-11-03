import type { NavigationAction, NavigationState, Router } from 'expo-router/react-navigation';

type State = { index?: number | undefined; routes: readonly { name: string; key?: string | undefined; params?: object | undefined; state?: State | undefined }[] };
function focusedRoute(state: State): string {
  const route = state.routes[state.index ?? state.routes.length - 1];
  return route ? `${route.key ?? route.name}:${JSON.stringify(route.params ?? {})}/${route.state ? focusedRoute(route.state) : ''}` : '';
}

export function guardRouter<S extends NavigationState, A extends NavigationAction>(original: Router<S, A>, guard: LeaveGuard, dispatch: (action: A) => void): Partial<Router<S, A>> {
  return {
    getStateForAction(state, action, options) {
      const next = original.getStateForAction(state, action, options);
      if (next && focusedRoute(state) !== focusedRoute(next) && guard.attempt(() => dispatch({ ...action, target: action.target ?? state.key }))) return state;
      return next;
    },
  };
}

/** One pending navigation at a time; replay is allowed synchronously after consent. */
export class LeaveGuard {
  private shouldBlock: (() => boolean) | null = null;
  private pending: (() => void) | null = null;
  private allowing = false;
  private listeners = new Set<() => void>();
  snapshot = () => this.pending !== null;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setHandler(handler: (() => boolean) | null) { this.shouldBlock = handler; }
  attempt(resume: () => void) {
    if (this.allowing || !this.shouldBlock?.()) return false;
    if (!this.pending) { this.pending = resume; this.listeners.forEach(listener => listener()); }
    return true;
  }
  cancel() { this.pending = null; this.listeners.forEach(listener => listener()); }
  proceed() {
    const resume = this.pending;
    this.cancel();
    if (!resume) return;
    this.allowing = true;
    try { resume(); } finally { this.allowing = false; }
  }
}
