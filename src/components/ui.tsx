import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { SessionIdentity } from './session-identity';

export function Screen({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SessionIdentity compact={compact} />
      <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>CONVOSQUAD · CLUBES PRO</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}
    </View>
  );
}

export function Body({ children }: PropsWithChildren) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Card({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Button({ label, onPress, secondary = false, disabled = false }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
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
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole="button"
      disabled={disabled} accessibilityState={{ selected: value === option.value, disabled }} onPress={() => onChange(option.value)}
      style={{ minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: value === option.value ? colors.primary : colors.border, backgroundColor: colors.surface }}>
      <Text style={{ color: value === option.value ? colors.primary : colors.text, fontWeight: '600' }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

export function Message({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <Text accessibilityLiveRegion="polite" style={[styles.body, { color: error ? colors.danger : colors.primary }]}>{children}</Text>;
}

export function DemoNotice() {
  return <Body>Modo demo. Puedes explorar y revisar los formularios; los cambios requieren una cuenta y Supabase configurado.</Body>;
}
