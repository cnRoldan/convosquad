import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getClubSettings, listClubAccounts, readClubPremium, setClubMember } from '@/features/clubs/service';
import { listPlayers } from '@/features/players/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';

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
    const [club, accounts, players, premium] = await Promise.all([getClubSettings(clubId!), listClubAccounts(clubId!), listPlayers(clubId!), readClubPremium(clubId!)]);
    return { club, accounts, players, premium };
  }, [clubId]);
  const result = useResource(`club-settings:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ userId: string; name: string; role: 'admin' | 'player' } | null>(null);
  const [filter, setFilter] = useState<'all' | 'captains' | 'players'>('all');
  const admin = currentMembership?.role === 'admin';
  const data = result.data;
  const captainCount = data?.accounts.filter(account => account.role === 'admin').length ?? 0;
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
    <Heading title={t("Capitanes")} subtitle={activeClub?.name ?? ''} action={data ? <CaptainQuota count={captainCount} premium={data.premium} /> : undefined} />
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>{t("Cargando configuración…")}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label={t("Reintentar")} onPress={result.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
    {data ? <>
      <Body>{t("Los capitanes pueden gestionar la plantilla, las convocatorias y los avisos. Solo el creador puede eliminar el club.")}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <CaptainFilter label={t('Todos')} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <CaptainFilter label={t('Capitanes actuales')} selected={filter === 'captains'} onPress={() => setFilter('captains')} />
        <CaptainFilter label={t('No capitanes')} selected={filter === 'players'} onPress={() => setFilter('players')} />
      </View>
      {!data.premium ? <Body>{t('Prémium permite añadir capitanes ilimitados.')}</Body> : null}
      {data.accounts.filter(account => filter === 'all' || (filter === 'captains' ? account.role === 'admin' : account.role !== 'admin')).map(account => {
          const player = data.players.find(row => row.user_id === account.user_id);
          const creator = data.club.created_by === account.user_id;
          const name = player?.ea_id ?? account.profiles?.username ?? t("Miembro");
          const captainLimitReached = !data.premium && account.role !== 'admin' && captainCount >= 2;
          return <Card key={account.id} title={name}>
            <Body>{creator ? t("Creador · capitán") : account.role === 'admin' ? t("Capitán") : t("Jugador")}</Body>
            {!creator && (player || account.role === 'admin') ? <Button secondary
              label={account.role === 'admin' ? t("Quitar capitanía a {{v0}}", { v0: name }) : t("Designar capitán a {{v0}}", { v0: name })}
              disabled={busy || !admin || captainLimitReached} onPress={() => setPending({ userId: account.user_id, name, role: account.role === 'admin' ? 'player' : 'admin' })} /> : null}
            {captainLimitReached ? <Body>{t('Desasigna a un capitán antes de designar a otro.')}</Body> : null}
            {!creator && !player && account.role !== 'admin' ? <Body>{t("Vincula esta cuenta con una ficha activa para designarla capitán.")}</Body> : null}
          </Card>;
        })}
    </> : null}
    <ConfirmDialog visible={Boolean(pending)} title={pending?.role === 'admin' ? t("Designar capitán") : t("Quitar capitanía")} description={`${pending?.name ?? ''}: ${pending?.role === 'admin' ? t("podrá administrar este club y crear convocatorias.") : t("conservará su cuenta y ficha como jugador.")}`} confirmLabel={t("Confirmar")} busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void changeCaptain(); }} />
  </Screen>;
}

function CaptainQuota({ count, premium }: { count: number; premium: boolean }) {
  return <View accessibilityLabel={premium ? `${count} capitanes, plazas ilimitadas` : `${count} de 2 capitanes`} style={{ minHeight: 34, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
    <Text style={{ color: colors.primary, fontWeight: '900' }}>{count}/{premium ? '∞' : '2'}</Text>
  </View>;
}

function CaptainFilter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={{ minHeight: 38, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}>
    <Text style={{ color: selected ? colors.background : colors.text, fontWeight: '800' }}>{label}</Text>
  </Pressable>;
}
