import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card } from '@/components/ui';
import { clubLocalDateTime } from './local-time';
import { formatMatchDate } from '@/lib/format';
import { t, useLanguage } from '@/features/i18n/runtime';
import type { Tables } from '@/types/database';

export function CallUpInfoDialog({ call, creator, visible, onClose }: {
  call: Tables<'call_ups'>; creator: string | null; visible: boolean; onClose: () => void;
}) {
  useLanguage();
  const insets = useSafeAreaInsets();
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Card title={t('Información de la convocatoria')}>
          <Body>{t('Finalización: {{v0}}', { v0: formatMatchDate(call.ends_at, call.timezone) })}</Body>
          <Body>{call.closes_at ? t('Cierre de votación: {{v0}} · {{v1}}', { v0: clubLocalDateTime(call.timezone, new Date(call.closes_at)).time, v1: call.timezone }) : t('Cierre de votación: no programado')}</Body>
          <Body>{call.last_notice_at ? t('Último aviso para votar: {{v0}} · solo pendientes', { v0: clubLocalDateTime(call.timezone, new Date(call.last_notice_at)).time }) : t('Último aviso para votar: no programado')}</Body>
          <Body>{t('Creada por: {{v0}}', { v0: creator ?? t('Usuario no disponible') })}</Body>
          <Button label={t('Cerrar')} onPress={onClose} />
        </Card>
      </ScrollView>
    </View>
  </Modal>;
}
