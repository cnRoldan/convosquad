import { t, useLanguage } from '@/features/i18n/runtime';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { Body, Button, Card } from './ui';

export function ConfirmDialog({ visible, title, description, confirmLabel = t("Confirmar"), busy = false, disabled = false, children, onConfirm, onCancel }: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useLanguage();
  const insets = useSafeAreaInsets();
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Card title={title}>
        <Body>{description}</Body>
        {children}
        <Button label={busy ? t("Un momento…") : confirmLabel} disabled={busy || disabled} onPress={onConfirm} />
        <Button secondary label={t("Cancelar")} disabled={busy} onPress={onCancel} />
      </Card>
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  </Modal>;
}
