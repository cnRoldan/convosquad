import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { useNavigationContainerRef } from 'expo-router';
import type { NavigationAction, NavigationState, Router } from 'expo-router/react-navigation';
import { guardRouter, LeaveGuard } from '@/features/lineups/leave-guard';

const Context = createContext<LeaveGuard | null>(null);
export function NavigationLeaveGuardProvider({ children }: PropsWithChildren) {
  const [guard] = useState(() => new LeaveGuard());
  return <Context.Provider value={guard}>{children}</Context.Provider>;
}
export function useLeaveGuard() {
  const guard = useContext(Context);
  if (!guard) throw new Error('NavigationLeaveGuardProvider is required');
  return guard;
}
export function useLeaveGuardRouter() {
  const guard = useLeaveGuard();
  const navigation = useNavigationContainerRef();
  return useCallback(<S extends NavigationState, A extends NavigationAction>(original: Router<S, A>): Partial<Router<S, A>> => guardRouter(original, guard, action => navigation.dispatch(action)), [guard, navigation]);
}
