import { Modal, View } from 'react-native';
import type { ReactNode } from 'react';
import { Body, Button, Card } from './ui';

export function ConfirmDialog({ visible, title, description, confirmLabel = 'Confirmar', busy = false, disabled = false, children, onConfirm, onCancel }: {
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
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 }}>
      <Card title={title}>
        <Body>{description}</Body>
        {children}
        <Button label={busy ? 'Un momento…' : confirmLabel} disabled={busy || disabled} onPress={onConfirm} />
        <Button secondary label="Cancelar" disabled={busy} onPress={onCancel} />
      </Card>
    </View>
  </Modal>;
}
