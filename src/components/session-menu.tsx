import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useSessionLogout } from '@/features/auth/use-session-logout';
import { logoutErrorMessage } from '@/features/auth/logout';
import { colors } from '@/theme';

export function SessionMenu({ eaId }: { eaId: string }) {
  useLanguage();
  const trigger = useRef<View>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { logout, isSigningOut } = useSessionLogout();
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuWidth = Math.min(220, width - 32);
  function open() {
    setError('');
    trigger.current?.measureInWindow((x, y, triggerWidth, triggerHeight) => {
      setAnchor({
        top: Math.max(insets.top + 8, Math.min(y + triggerHeight + 6, height - insets.bottom - 180)),
        right: Math.max(16, Math.min(width - x - triggerWidth, width - menuWidth - 16)),
      });
      setMenuOpen(true);
    });
  }
  // Keep the measured position while the modal finishes its exit animation.
  function close() { setMenuOpen(false); }
  async function leave() {
    setError('');
    try { await logout(); close(); }
    catch (cause) { setError(t(logoutErrorMessage(cause))); }
  }
  return <>
    <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={t('Sesión iniciada como {{v0}}', { v0: eaId })}
      accessibilityState={{ expanded: menuOpen, disabled: isSigningOut }} disabled={isSigningOut}
      onPress={open} style={({ pressed }) => [styles.badge, pressed && styles.pressed]}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.identity}>ID: {eaId}</Text>
    </Pressable>
    <Modal visible={menuOpen} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={close}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Cerrar')} style={StyleSheet.absoluteFill} onPress={close} />
        <View accessibilityRole="menu" style={[styles.menu, { width: menuWidth, top: anchor?.top, right: anchor?.right }]}>
          <Pressable accessibilityRole="menuitem" accessibilityLabel={t('Cerrar sesión')} disabled={isSigningOut} accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]} onPress={() => { void leave(); }}>
            {isSigningOut ? <ActivityIndicator size="small" color={colors.primary} /> : <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
              <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </Svg>}
            <Text style={styles.itemText}>{t('Cerrar sesión')}</Text>
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  badge: { maxWidth: '85%', flexShrink: 1, minHeight: 44, justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  identity: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1 },
  menu: { position: 'absolute', padding: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  itemText: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  pressed: { backgroundColor: '#243622' },
  error: { color: colors.danger, fontSize: 13, padding: 12 },
});
