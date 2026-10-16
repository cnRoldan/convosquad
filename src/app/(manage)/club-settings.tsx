import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getClubSettings, listClubAccounts, setClubMember } from '@/features/clubs/service';
import { listPlayers } from '@/features/players/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

export default function ClubSettingsScreen() {
  useLanguage();
  const { session } = useAuth();
  const { activeClub } = useClub();
  return <ClubSettingsContent key={`${session?.user.id}:${activeClub?.id}`} />;
}

function ClubSettingsContent() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, reloadClubs } = useClub();
  const clubId = activeClub?.id;
  const load = useCallback(async () => {
    const [club, accounts, players] = await Promise.all([getClubSettings(clubId!), listClubAccounts(clubId!), listPlayers(clubId!)]);
    return { club, accounts, players };
  }, [clubId]);
  const result = useResource(`club-settings:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ userId: string; name: string; role: 'admin' | 'player' } | null>(null);
  const admin = currentMembership?.role === 'admin';
  const data = result.data;
  async function changeCaptain() {
    if (!clubId || !pending || !admin || isDemo || busy) return;
    setBusy(true); setMessage('');
    try {
      await setClubMember(clubId, pending.userId, pending.role, true);
      setMessage(pending.role === 'admin' ? t("Capitán designado.") : t("El jugador ya no es capitán."));
      result.reload(); await reloadClubs();
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); setPending(null); }
  }
  return <Screen>
    <Heading title={t("Capitanes")} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>{t("Cargando configuración…")}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label={t("Reintentar")} onPress={result.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
    {data ? <>
      <Card title={t("Capitanes del club")}>
        <Body>{t("Los capitanes pueden gestionar la plantilla, las convocatorias y los avisos. Solo el creador puede eliminar el club.")}</Body>
        {data.accounts.map(account => {
          const player = data.players.find(row => row.user_id === account.user_id);
          const creator = data.club.created_by === account.user_id;
          const name = player?.ea_id ?? account.profiles?.username ?? t("Miembro");
          return <Card key={account.id} title={name}>
            <Body>{creator ? t("Creador · capitán") : account.role === 'admin' ? t("Capitán") : t("Jugador")}</Body>
            {!creator && (player || account.role === 'admin') ? <Button secondary
              label={account.role === 'admin' ? t("Quitar capitanía a {{v0}}", { v0: name }) : t("Designar capitán a {{v0}}", { v0: name })}
              disabled={busy || !admin} onPress={() => setPending({ userId: account.user_id, name, role: account.role === 'admin' ? 'player' : 'admin' })} /> : null}
            {!creator && !player && account.role !== 'admin' ? <Body>{t("Vincula esta cuenta con una ficha activa para designarla capitán.")}</Body> : null}
          </Card>;
        })}
      </Card>
    </> : null}
    <ConfirmDialog visible={Boolean(pending)} title={pending?.role === 'admin' ? t("Designar capitán") : t("Quitar capitanía")} description={`${pending?.name ?? ''}: ${pending?.role === 'admin' ? t("podrá administrar este club y crear convocatorias.") : t("conservará su cuenta y ficha como jugador.")}`} confirmLabel={t("Confirmar")} busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void changeCaptain(); }} />
  </Screen>;
}
