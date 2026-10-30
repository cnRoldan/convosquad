import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { purchasePremium, premiumPackage, restorePremium, revenueCatReady } from '@/features/billing/revenuecat';

export default function PremiumScreen() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function buy() {
    if (!session?.user.id) return;
    setBusy(true); setMessage('');
    try {
      const item = await premiumPackage(session.user.id);
      if (!item) throw new Error('offer');
      await purchasePremium(session.user.id, item);
      setMessage('Compra completada. Estamos activando Prémium para tu club.');
    } catch { setMessage('No se pudo completar la compra. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!session?.user.id) return;
    setBusy(true); setMessage('');
    try { await restorePremium(session.user.id); setMessage('Compra restaurada. Estamos actualizando el acceso del club.'); }
    catch { setMessage('No se pudo restaurar la compra.'); }
    finally { setBusy(false); }
  }
  return <Screen compact>
    <Heading title="ConvoSquad Prémium" />
    <Card title="Todo el potencial del club">
      <Body>Forma el 11 en todas las convocatorias, personaliza el club y accede a las próximas funciones Prémium.</Body>
      {!revenueCatReady() ? <Body>Las compras estarán disponibles cuando terminemos de configurar la tienda.</Body> : <>
        <Button label={busy ? 'Procesando…' : 'Activar Prémium'} disabled={busy} onPress={() => void buy()} />
        <Button secondary label="Restaurar compra" disabled={busy} onPress={() => void restore()} />
      </>}
    </Card>
    {message ? <Message>{message}</Message> : null}
    <Button secondary label="Regresar" onPress={() => router.back()} />
  </Screen>;
}
