import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Button, Message } from '@/components/ui';
import { pickClubCrest, type ClubCrestImage } from './crest';
export function CrestPicker({ image, onChange, disabled = false, hasExistingCrest = false }: { image: ClubCrestImage | null; onChange: (image: ClubCrestImage | null) => void; disabled?: boolean; hasExistingCrest?: boolean }) {
  useLanguage();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function choose() {
    if (busy || disabled) return;
    setBusy(true); setError('');
    try { const selected = await pickClubCrest(); if (selected) onChange(selected); }
    catch { setError(t("No se pudo leer la imagen. Revisa el acceso a tus fotos o prueba con una imagen PNG o JPG.")); }
    finally { setBusy(false); }
  }
  return <View style={{gap: 12}}>
    {image ? <Image source={{uri: image.uri}} accessibilityLabel={t("Vista previa del escudo")} resizeMode="contain" style={{ width: 160, height: 160, alignSelf: 'center' }} /> : null}
    <Button secondary label={busy ? t("Preparando imagen…") : image || hasExistingCrest ? t("Cambiar escudo") : t("Añadir escudo (opcional)")} disabled={disabled || busy} onPress={() => { void choose(); }} />
    {image ? <Button secondary label={t("Quitar imagen seleccionada")} disabled={disabled || busy} onPress={() => onChange(null)} /> : null}
    {error ? <Message error>{error}</Message> : null}
  </View>;
}
