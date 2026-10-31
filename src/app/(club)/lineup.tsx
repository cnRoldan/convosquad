import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LineupEditor } from '@/features/lineups/editor';
import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import { activateLineupAccess, readLineupAccess, type LineupAccess } from '@/features/lineups/service';

export default function LineupScreen() {
  useLanguage(); const { activeClub, currentMembership } = useClub();
  const { id, draft } = useLocalSearchParams<{ id?: string; draft?: string }>();
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [access, setAccess] = useState<LineupAccess | null>(null);
  const [opening, setOpening] = useState(false);
  useFocusEffect(useCallback(() => {
    setNoticeVisible(true);
    if (!id || !activeClub) return;
    let active = true;
    void readLineupAccess(id).then(value => { if (active) setAccess(value); }).catch(() => { if (active) setAccess({ activated: false, premium: false, remaining: 0, allowed: false }); });
    return () => { active = false; };
  }, [id, activeClub]));
  const back = () => {
    setNoticeVisible(false);
    requestAnimationFrame(() => router.replace('/call-up'));
  };
  async function openFreeGeneration() {
    if (!id) return;
    setOpening(true);
    try { setAccess(await activateLineupAccess(id)); }
    finally { setOpening(false); }
  }
  if (id && activeClub && access?.allowed) return <LineupEditor key={`${activeClub.id}:${id}:${currentMembership?.role}:${draft ?? ''}`} clubId={activeClub.id} clubName={activeClub.name} crestPath={activeClub.crestPath} callId={id} captain={currentMembership?.role === 'admin'} {...(draft ? { initialDraftId: draft } : {})} />;
  if (id && activeClub && access) return <Screen compact>
    <Heading title={t('Tu 11')} subtitle={activeClub.name} />
    <View style={styles.pitch}>
      <View style={styles.half} /><View style={styles.circle} /><View style={[styles.box, styles.topBox]} /><View style={[styles.box, styles.bottomBox]} />
      {[['12%', '46%'], ['30%', '18%'], ['30%', '72%'], ['48%', '34%'], ['48%', '58%'], ['68%', '12%'], ['68%', '78%'], ['83%', '45%']].map(([top, left], index) => <View key={index} style={[styles.player, { top: top as `${number}%`, left: left as `${number}%` }]} />)}
      <View style={styles.blur} />
    </View>
    <Card title={access.remaining === 0 ? '⭐ Funcionalidad Prémium' : 'Tu 11 aún no está disponible'}>
      <Body>{access.remaining === 0 ? 'Las 6 generaciones gratuitas del equipo ya se han utilizado. Activa la suscripción Prémium para formar el 11 en todas las convocatorias.' : 'Un capitán debe pulsar «¡Forma tu 11!» para activar esta convocatoria para el equipo.'}</Body>
      {currentMembership?.role === 'admin' && access.remaining > 0 ? <Button label={opening ? 'Abriendo Tu 11…' : `Usar generación gratuita (${access.remaining} restantes)`} disabled={opening} onPress={() => void openFreeGeneration()} /> : null}
      {access.remaining === 0 && currentMembership?.role === 'admin' ? <Button label="Ver Prémium" onPress={() => router.push('/premium')} /> : null}
      <Button secondary label={t('Regresar')} onPress={back} />
    </Card>
  </Screen>;
  if (id && activeClub) return <Screen compact><Heading title={t('Tu 11')} subtitle={activeClub.name} /><Body>Cargando acceso…</Body></Screen>;
  return <Screen compact>
    <Heading title={t('Tu 11')} subtitle={activeClub?.name ?? ''} />
    <View style={styles.pitch}>
      <View style={styles.half} /><View style={styles.circle} /><View style={[styles.box, styles.topBox]} /><View style={[styles.box, styles.bottomBox]} />
      {[['12%', '46%'], ['30%', '18%'], ['30%', '72%'], ['48%', '34%'], ['48%', '58%'], ['68%', '12%'], ['68%', '78%'], ['83%', '45%']].map(([top, left], index) => <View key={index} style={[styles.player, { top: top as `${number}%`, left: left as `${number}%` }]} />)}
      <View style={styles.blur} />
    </View>
    <Modal transparent visible={noticeVisible} animationType="fade" onRequestClose={back}>
      <View style={styles.overlay}><Card title={t('⭐ Funcionalidad Prémium')}><Body>{t('Funcionalidad aún no disponible')}</Body><Button label={t('Regresar')} onPress={back} /></Card></View>
    </Modal>
  </Screen>;
}
const styles = StyleSheet.create({
  pitch: { height: 520, overflow: 'hidden', borderRadius: 24, borderWidth: 3, borderColor: '#DDF8D2', backgroundColor: '#287846', position: 'relative' },
  half: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, backgroundColor: '#DDF8D2' },
  circle: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#DDF8D2', left: '50%', top: '50%', marginLeft: -60, marginTop: -60 },
  box: { position: 'absolute', width: 210, height: 75, borderWidth: 2, borderColor: '#DDF8D2', left: '50%', marginLeft: -105 },
  topBox: { top: -2 }, bottomBox: { bottom: -2 },
  player: { position: 'absolute', width: 42, height: 42, borderRadius: 21, marginLeft: -21, backgroundColor: colors.primary, shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 16 },
  blur: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,18,14,0.58)' },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(3,8,6,0.48)' },
});
