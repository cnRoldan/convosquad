import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useSegments } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { SessionIdentity } from './session-identity';

export function Screen({ children, compact = false, footer, onRefresh, refreshing = false }: PropsWithChildren<{ compact?: boolean; footer?: ReactNode; onRefresh?: (() => void) | undefined; refreshing?: boolean }>) {
  useLanguage();
  const segments = useSegments();
  const hasHeader = segments.some(segment => segment === '(account)' || segment === '(manage)');
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    <SafeAreaView style={styles.safe} edges={hasHeader ? ['left', 'right'] : ['top', 'left', 'right']}>
      <SessionIdentity compact={compact} />
      <ScrollView alwaysBounceVertical={onRefresh ? true : undefined} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined} style={{ flex: 1 }} contentContainerStyle={[styles.content, compact && styles.compactContent, footer ? { paddingBottom: footerHeight + 24 } : undefined]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets>
        {children}
      </ScrollView>
      {footer ? <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} onLayout={event => setFooterHeight(Math.ceil(event.nativeEvent.layout.height))}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  useLanguage();
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{t("CONVOSQUAD · CLUBES PRO")}</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}
    </View>
  );
}

export function Body({ children }: PropsWithChildren) {
  useLanguage();
  return <Text style={styles.body}>{children}</Text>;
}

export function Card({ title, children }: PropsWithChildren<{ title?: string }>) {
  useLanguage();
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Button({ label, onPress, secondary = false, disabled = false, badge, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  badge?: number;
  accessibilityLabel?: string;
}) {
  useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {badge && badge > 0 ? <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.buttonText, secondary && styles.secondaryButtonText, { flex: 1 }]}>{t(label)}</Text>
        <View style={{ minWidth: 24, minHeight: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
          <Text style={{ color: colors.background, fontSize: 12, fontWeight: '800' }}>{badge}</Text>
        </View>
      </View> : <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{t(label)}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  useLanguage();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{t(label)}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 40 },
  compactContent: { padding: 16, gap: 12, maxWidth: 880 },
  heading: { gap: 12, marginVertical: 12 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  button: { backgroundColor: colors.primary, minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14, padding: 14 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text },
  dimmed: { opacity: 0.6 },
  field: { gap: 8 },
  fieldLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, color: colors.text, fontSize: 16, minHeight: 52 },
});

export function Options<T extends string>({ options, value, onChange, disabled = false }: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  useLanguage();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole="button"
      disabled={disabled} accessibilityState={{ selected: value === option.value, disabled }} onPress={() => onChange(option.value)}
      style={{ minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: value === option.value ? colors.primary : colors.border, backgroundColor: colors.surface }}>
      <Text style={{ color: value === option.value ? colors.primary : colors.text, fontWeight: '600' }}>{t(option.label)}</Text>
    </Pressable>)}
  </View>;
}

export function Message({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  useLanguage();
  return <Text accessibilityLiveRegion="polite" style={[styles.body, { color: error ? colors.danger : colors.primary }]}>{typeof children === 'string' ? t(children) : children}</Text>;
}

export function DemoNotice() {
  useLanguage();
  return <Body>{t("Modo demo. Explora un club de ejemplo. Crea una cuenta para organizar tu equipo.")}</Body>;
}
