import { useState } from 'react';
import { Button, Card, Message } from '@/components/ui';
import { useClub } from './club-context';
import { ClubCrest } from './club-crest';
import { CrestPicker } from './crest-picker';
import { removeClubCrest, uploadClubCrest, type ClubCrestImage } from './crest';
export function CrestSettings() {
  const { activeClub, reloadClubs } = useClub();
  const [image, setImage] = useState<ClubCrestImage | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function save(remove: boolean) {
    if (!activeClub || busy || (!remove && !image)) return;
    setBusy(true); setMessage('');
    try {
      if (remove) await removeClubCrest(activeClub.id); else await uploadClubCrest(activeClub.id, image!);
      await reloadClubs(activeClub.id); setImage(null); setMessage(remove ? 'Escudo retirado.' : 'Escudo actualizado.');
    } catch { setMessage('No se pudo guardar el escudo. Comprueba tu conexión e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <Card title="Escudo del club">
    <ClubCrest path={activeClub?.crestPath} name={activeClub?.name ?? ''} size={64} />
    <CrestPicker image={image} onChange={setImage} disabled={busy} />
    {image ? <Button label="Guardar escudo" disabled={busy} onPress={() => { void save(false); }} /> : null}
    {activeClub?.crestPath ? <Button secondary label="Quitar escudo del club" disabled={busy} onPress={() => { void save(true); }} /> : null}
    {message ? <Message>{message}</Message> : null}
  </Card>;
}
