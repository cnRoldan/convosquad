import { useState } from 'react';
import { Linking } from 'react-native';
import { Body, Button, Field, Message } from '@/components/ui';
import { whatsappUrl } from './phone';
export function PhoneContact({ phone, label, editable = false, onChange }: { phone: string; label: string; editable?: boolean; onChange?: (phone: string) => void }) {
  const [error, setError] = useState('');
  return <>
    {editable ? <Field label={`Teléfono de ${label} (solo capitanes, opcional)`} value={phone} onChangeText={onChange} keyboardType="phone-pad" maxLength={30} /> : phone ? <Body>Teléfono: {phone}</Body> : null}
    {phone ? <Button secondary label={`WhatsApp de ${label}`} onPress={() => {
      setError('');
      void (async () => { try { await Linking.openURL(whatsappUrl(phone)); } catch { setError('No se pudo abrir WhatsApp. Revisa el número e inténtalo de nuevo.'); } })();
    }} /> : null}
    {error ? <Message error>{error}</Message> : null}
  </>;
}
