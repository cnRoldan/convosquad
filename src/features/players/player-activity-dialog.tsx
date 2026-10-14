import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DemoNotice, Message } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { activityErrorMessage, playerActivityCopy } from './activity';
import { setPlayerActivity } from './service';

export function PlayerActivityDialog({ player, onCancel, onSuccess }: {
  player: { id: string; eaId: string; isActive: boolean };
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { isDemo } = useAuth();
  const { activeClub, currentMembership, refreshRoster } = useClub();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const admin = currentMembership?.role === 'admin';
  async function confirm() {
    if (!activeClub || !admin || isDemo || busy) return;
    setBusy(true); setError('');
    try {
      await setPlayerActivity(activeClub.id, player.id, !player.isActive);
      refreshRoster();
      onSuccess();
    } catch (cause) { setError(activityErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <ConfirmDialog visible={admin} {...playerActivityCopy(player.isActive)} busy={busy} disabled={isDemo || !admin}
    onCancel={onCancel} onConfirm={() => { void confirm(); }}>
    <Message>{player.eaId}</Message>
    {isDemo ? <DemoNotice /> : null}
    {error ? <Message error>{error}</Message> : null}
  </ConfirmDialog>;
}
