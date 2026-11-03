import { useCallback } from 'react';
import { withLayoutContext } from 'expo-router';
import type { ParamListBase, StackNavigationState } from 'expo-router/react-navigation';
import type { NativeStackNavigationEventMap, NativeStackNavigationOptions } from 'expo-router/native-stack';
import { createNativeStackNavigator } from 'expo-router/build/fork/native-stack/createNativeStackNavigator';
import { stackRouterOverride } from 'expo-router/build/layouts/StackClient';
import { useLeaveGuardRouter } from './navigation-leave-guard';

// Expo 57's Stack replaces UNSTABLE_router. Use the same native navigator and
// compose its Expo route handling before applying our navigation guard.
const Navigator = createNativeStackNavigator().Navigator;
export const GuardedStack = withLayoutContext<NativeStackNavigationOptions, typeof Navigator, StackNavigationState<ParamListBase>, NativeStackNavigationEventMap>(Navigator);

export function useGuardedStackRouter() {
  const guardRouter = useLeaveGuardRouter();
  return useCallback<NonNullable<React.ComponentProps<typeof Navigator>['UNSTABLE_router']>>(original => guardRouter({ ...original, ...stackRouterOverride(original) }), [guardRouter]);
}
