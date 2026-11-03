import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './auth-context';
import { BiometricLock } from './biometric-lock';
import { colors } from '@/theme';

const Context = createContext<{ lock: BiometricLock; state: ReturnType<BiometricLock['snapshot']> } | null>(null);
export function BiometricProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const userId = !auth.isDemo && !auth.isRecovery ? auth.session?.user.id ?? null : null;
  const [lock] = useState(() => new BiometricLock({
    read: async id => Platform.OS !== 'web' && await SecureStore.getItemAsync(`biometric.${id}`) === '1',
    write: (id, enabled) => SecureStore.setItemAsync(`biometric.${id}`, enabled ? '1' : '0', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    authenticate: async () => (await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear ConvoSquad', cancelLabel: 'Cancelar', fallbackLabel: 'Usar código', disableDeviceFallback: false, biometricsSecurityLevel: 'strong' })).success,
    now: Date.now,
  }));
  const state = useSyncExternalStore(lock.subscribe, lock.snapshot, lock.snapshot);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => { void lock.setUser(userId); }, [lock, userId]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    lock.appState(AppState.currentState);
    const subscription = AppState.addEventListener('change', next => lock.appState(next));
    return () => subscription.remove();
  }, [lock]);
  useEffect(() => {
    if (Platform.OS !== 'web' && state.ready && state.locked && !state.hidden && state.userId === userId) void lock.unlock();
  }, [lock, state.ready, state.locked, state.hidden, state.userId, userId]);
  const ready = !auth.isLoading && state.ready && state.userId === userId;
  const blocked = !ready || (state.enabled && (state.locked || state.hidden));
  async function password() {
    setLogoutError('');
    try {
      const id = state.userId;
      await auth.signOut();
      if (id) await SecureStore.deleteItemAsync(`biometric.${id}`);
    }
    catch { setLogoutError('No se pudo cerrar la sesión. Comprueba tu conexión e inténtalo de nuevo.'); }
  }
  const context = { lock, state };
  if (Platform.OS === 'web') return <Context.Provider value={context}>{children}</Context.Provider>;
  return <Context.Provider value={context}>
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, opacity: blocked ? 0 : 1 }} pointerEvents={blocked ? 'none' : 'auto'} accessibilityElementsHidden={blocked} importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>{ready ? children : null}</View>
      <Modal visible={blocked} animationType="none" onRequestClose={() => undefined}>
        <View style={styles.cover}>
          <Text style={styles.title}>ConvoSquad</Text>
          {!ready || state.busy ? <ActivityIndicator color={colors.primary} /> : <>
            <Text style={styles.copy}>Desbloquea tu sesión para continuar.</Text>
            {state.error ? <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text> : null}
            <Pressable style={styles.button} accessibilityRole="button" onPress={() => void lock.unlock()}><Text style={styles.buttonText}>Desbloquear</Text></Pressable>
            <Pressable style={styles.secondary} accessibilityRole="button" disabled={auth.isSigningOut} onPress={() => void password()}><Text style={styles.copy}>{auth.isSigningOut ? 'Cerrando sesión…' : 'Volver a entrar con contraseña'}</Text></Pressable>
            {logoutError ? <Text style={styles.error}>{logoutError}</Text> : null}
          </>}
        </View>
      </Modal>
    </View>
  </Context.Provider>;
}
export function useBiometrics() {
  const value = useContext(Context);
  if (!value) throw new Error('BiometricProvider is required');
  return value;
}
const styles = StyleSheet.create({
  cover: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 22 },
  title: { fontSize: 30, color: colors.primary, fontWeight: '900' },
  copy: { color: colors.text, textAlign: 'center', fontSize: 16 },
  error: { color: colors.danger, textAlign: 'center' },
  button: { minHeight: 48, paddingHorizontal: 24, justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12 },
  buttonText: { color: colors.background, fontWeight: '800' },
  secondary: { minHeight: 48, justifyContent: 'center' },
});
