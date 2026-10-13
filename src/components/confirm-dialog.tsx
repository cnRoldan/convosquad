import { Modal, View } from 'react-native';
import { Body, Button, Card } from './ui';

export function ConfirmDialog({ visible, title, description, confirmLabel = 'Confirmar', busy = false, onConfirm, onCancel }: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 }}>
      <Card title={title}>
        <Body>{description}</Body>
        <Button label={busy ? 'Un momento…' : confirmLabel} disabled={busy} onPress={onConfirm} />
        <Button secondary label="Cancelar" disabled={busy} onPress={onCancel} />
      </Card>
    </View>
  </Modal>;
}
