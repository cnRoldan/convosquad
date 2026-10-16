import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import { PrivatePhoneField } from '@/features/call-ups/private-phone-field';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Body, Button, Message } from '@/components/ui';
import { whatsappUrl } from './phone';
export function PhoneContact({ phone, label, editable = false, onChange }: { phone: string; label: string; editable?: boolean; onChange?: (phone: string) => void }) {
  useLanguage();
  const [error, setError] = useState('');
  return <View style={{ gap: 12, paddingTop: 12 }}>
    {editable ? <PrivatePhoneField label={t("Teléfono de {{v0}} (solo capitanes, opcional)", { v0: label })} value={phone} onChangeText={onChange} keyboardType="phone-pad" maxLength={30} /> : phone ? <View style={{ gap: 8 }}><Body>{t("Teléfono: {{v0}}", { v0: phone })}</Body><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t("Solo los capitanes pueden ver este número.")}</Text></View> : null}
    {phone ? <Button secondary label={t("WhatsApp de {{v0}}", { v0: label })} onPress={() => {
      setError('');
      void (async () => { try { await Linking.openURL(whatsappUrl(phone)); } catch { setError("No se pudo abrir WhatsApp. Revisa el número e inténtalo de nuevo."); } })();
    }} /> : null}
    {error ? <Message error>{error}</Message> : null}
  </View>;
}
