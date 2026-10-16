import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Message } from '@/components/ui';
import { colors } from '@/theme';
import { languages, supportedLanguage, t, useLanguage } from './runtime';
import { useLanguagePreference } from './language-provider';
import { LanguageFlag } from './language-flag';
export function LanguageSelector() {
  const language = supportedLanguage(useLanguage());
  const { changeLanguage } = useLanguagePreference();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Cambiar idioma')} style={styles.flag} onPress={() => { setError(''); setOpen(true); }}>
      <LanguageFlag language={language} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View accessibilityViewIsModal style={styles.overlay}><View style={{ width: '100%', maxWidth: 420 }}><Card title={t('Idioma')}>
        {languages.map(item => <Pressable key={item.code} accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ checked: item.code === language, disabled: busy }} disabled={busy}
          style={[styles.option, item.code === language && { borderColor: colors.primary }]} onPress={() => {
            setBusy(true); setError('');
            void changeLanguage(item.code).then(() => setOpen(false)).catch(cause => setError(cause instanceof Error ? cause.message : t('No se pudo guardar el idioma.'))).finally(() => setBusy(false));
          }}><LanguageFlag language={item.code} /><Text style={{ color: colors.text, fontSize: 18 }}>{item.name}</Text></Pressable>)}
        {error ? <Message error>{error}</Message> : null}
        <Button secondary label={t('Cerrar')} disabled={busy} onPress={() => setOpen(false)} />
      </Card></View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  flag: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.8)' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 52, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
});
