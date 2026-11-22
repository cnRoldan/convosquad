import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Body, Button, Card } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { intlLocale, t, useLanguage } from '@/features/i18n/runtime';
import { notificationStatusCopy, type RosterNotificationStatus } from './roster-status';

export function RosterNotificationBadge({ name, value }: { name: string; value?: RosterNotificationStatus | undefined }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const status = value?.status ?? 'unknown';
  const copy = notificationStatusCopy(status);
  const votesMuted = value?.vote_notifications === false;
  // A configured device is not proof of delivery: do not show a green delivery badge.
  if (status === 'enabled' && !votesMuted) return null;
  const title = status === 'enabled' ? 'Avisos de votos desactivados' : copy.title;
  return <>
    <IconButton icon={status === 'unknown' ? 'bell-unknown' : 'bell-off'} muted={status === 'unknown'}
      label={t('Notificaciones de {{v0}}: {{v1}}', { v0: name, v1: t(title) })} onPress={() => setOpen(true)} />
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><ScrollView style={{ maxHeight: '85%' }}><Card title={t(title)}>
        <Body>{name}</Body>
        <Body>{t(copy.detail)}</Body>
        {votesMuted ? <Body>{t('Este jugador ha silenciado los avisos de votos. Esta preferencia no desactiva todos los avisos ni el último recordatorio para votar.')}</Body> : null}
        <Body>{value?.checked_at ? t('Última comprobación: {{v0}}', { v0: new Date(value.checked_at).toLocaleString(intlLocale()) }) : t('Sin comprobaciones de dispositivo disponibles.')}</Body>
        <Body>{t('El estado puede cambiar desde la última comprobación. No informa sobre No molestar ni acredita que un aviso se haya entregado o leído.')}</Body>
        <Button secondary label={t('Cerrar')} onPress={() => setOpen(false)} />
      </Card></ScrollView></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' } });
