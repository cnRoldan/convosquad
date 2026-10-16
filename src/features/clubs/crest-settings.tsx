import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Message } from '@/components/ui';
import { useClub } from './club-context';
import { ClubCrest } from './club-crest';
import { CrestPicker } from './crest-picker';
import { removeClubCrest, uploadClubCrest, type ClubCrestImage } from './crest';
export function CrestSettings() {
  useLanguage();
  const { activeClub, reloadClubs } = useClub();
  const [image, setImage] = useState<ClubCrestImage | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function save(remove: boolean) {
    if (!activeClub || busy || (!remove && !image)) return;
    setBusy(true); setMessage('');
    try {
      if (remove) await removeClubCrest(activeClub.id); else await uploadClubCrest(activeClub.id, image!);
      await reloadClubs(activeClub.id); setRevision(value => value + 1); setImage(null); setMessage(remove ? t("Escudo retirado.") : t("Escudo actualizado."));
    } catch { setMessage(t("No se pudo guardar el escudo. Comprueba tu conexión e inténtalo de nuevo.")); }
    finally { setBusy(false); }
  }
  return <Card title={t("Escudo del club")}>
    {!image && activeClub?.crestPath ? <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <ClubCrest key={revision} path={activeClub.crestPath} name={activeClub.name} size={160} />
    </View> : null}
    <CrestPicker image={image} onChange={setImage} disabled={busy} hasExistingCrest={Boolean(activeClub?.crestPath)} />
    {image ? <Button label={t("Guardar escudo")} disabled={busy} onPress={() => { void save(false); }} /> : null}
    {!image && activeClub?.crestPath ? <Button secondary label={t("Quitar escudo del club")} disabled={busy} onPress={() => { void save(true); }} /> : null}
    {message ? <Message>{message}</Message> : null}
  </Card>;
}
