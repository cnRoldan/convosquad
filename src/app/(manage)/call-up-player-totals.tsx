import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';

// Decorative preview: no player data is requested for the premium placeholder.
const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760" viewBox="0 0 600 760">
<rect width="600" height="760" fill="#0B1210"/>
${[0, 1, 2, 3].map(section => `<g transform="translate(20 ${20 + section * 185})">
<rect width="560" height="165" rx="24" fill="#14241C" stroke="#384A3D"/>
<rect x="24" y="22" width="240" height="16" rx="8" fill="#EDF5E9"/>
${[0, 1, 2].map(row => `<circle cx="38" cy="${66 + row * 34}" r="10" fill="#B4F16C"/><rect x="65" y="${58 + row * 34}" width="${350 - row * 75}" height="16" rx="8" fill="#B4F16C" opacity="${0.8 - row * 0.2}"/>`).join('')}
</g>`).join('')}</svg>`)}`;

export default function CallUpPlayerTotalsScreen() {
  useLanguage();
  const { activeClub } = useClub();
  const [noticeVisible, setNoticeVisible] = useState(true);
  useFocusEffect(useCallback(() => { setNoticeVisible(true); }, []));
  const back = () => {
    setNoticeVisible(false);
    requestAnimationFrame(() => router.replace('/call-up-history'));
  };
  return <Screen>
    <Heading title={t('Total por jugador')} subtitle={activeClub?.name ?? ''} />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.preview}>
      <Image source={{ uri: preview }} contentFit="cover" blurRadius={10} style={StyleSheet.absoluteFill} accessible={false} />
      <View style={styles.tint} />
    </View>
    <Modal transparent visible={noticeVisible} animationType="fade" onRequestClose={back}>
      <View style={styles.overlay}>
        <Card title={t('⭐ Funcionalidad Prémium')}>
          <Button label={t('Regresar')} onPress={back} />
        </Card>
      </View>
    </Modal>
  </Screen>;
}
const styles = StyleSheet.create({
  preview: { height: 560, borderRadius: 24, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,18,14,0.35)' },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(3,8,6,0.48)' },
});
