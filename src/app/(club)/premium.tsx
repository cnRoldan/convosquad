import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { beginClubPurchase } from '@/features/clubs/service';
import { offeringPackage, purchaseRevenueCatPackage, restoreRevenueCatPurchases, revenueCatReady } from '@/features/billing/revenuecat';

export default function PremiumScreen() {
  const { session } = useAuth();
  const { activeClub, currentMembership } = useClub();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function buy(packageIdentifier: '$rc_monthly' | '$rc_annual') {
    if (!session?.user.id || !activeClub?.id || currentMembership?.role !== 'admin') return;
    setBusy(true); setMessage('');
    try {
      const item = await offeringPackage(session.user.id, 'premium', packageIdentifier);
      if (!item) throw new Error('offer');
      await beginClubPurchase(activeClub.id, item.product.identifier);
      await purchaseRevenueCatPackage(session.user.id, item);
      setMessage('Compra completada. Estamos activando Prémium para tu club. Puede tardar unos segundos.');
    } catch { setMessage('No se pudo completar la compra. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!session?.user.id) return;
    setBusy(true); setMessage('');
    try {
      if (!activeClub?.id) throw new Error('club');
      await Promise.all([
        beginClubPurchase(activeClub.id, 'com.convosquad.premium.monthly'),
        beginClubPurchase(activeClub.id, 'com.convosquad.premium.yearly'),
      ]);
      await restoreRevenueCatPurchases(session.user.id);
      setMessage('Compra restaurada. Estamos actualizando el acceso del club.');
    }
    catch { setMessage('No se pudo restaurar la compra.'); }
    finally { setBusy(false); }
  }
  return <Screen compact>
    <Heading title="ConvoSquad Prémium" />
    <Card title="Todo el potencial del club">
      <Body>Forma el 11 en todas las convocatorias, personaliza el club y accede a las próximas funciones Prémium.</Body>
      {!revenueCatReady() ? <Body>Las compras estarán disponibles cuando terminemos de configurar la tienda.</Body> : currentMembership?.role !== 'admin' ? <Body>Solo un capitán puede activar Prémium para el club.</Body> : <>
        <Button label={busy ? 'Procesando…' : 'Prémium mensual · 0,99 €/mes'} disabled={busy} onPress={() => void buy('$rc_monthly')} />
        <Button label={busy ? 'Procesando…' : 'Prémium anual · 9,99 €/año'} disabled={busy} onPress={() => void buy('$rc_annual')} />
        <Button secondary label="Restaurar compra" disabled={busy} onPress={() => void restore()} />
      </>}
    </Card>
    {message ? <Message>{message}</Message> : null}
    <Button secondary label="Regresar" onPress={() => router.back()} />
  </Screen>;
}
