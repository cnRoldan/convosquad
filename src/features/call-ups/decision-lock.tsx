import { useCallback, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/features/auth/auth-context';
import { Button, Message } from '@/components/ui';
import { useResource } from '@/hooks/use-resource';
import { requireSupabase } from '@/lib/supabase';
import { backendErrorMessage, unwrap } from '@/lib/backend-result';
import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import { availabilityLabels } from './availability';
import type { Availability } from './list-model';

export function DecisionLock({ clubId, entryId, availability, canEnable, pendingVote, revision, votingClosed = false, onChanged }: {
  onChanged?: () => void;
  votingClosed?: boolean; clubId: string; entryId: string | undefined; availability: Availability; canEnable: boolean; pendingVote: boolean; revision: string;
}) {
  useLanguage();
  const { session, isDemo } = useAuth();
  const userId = session?.user.id;
  const load = useCallback(async () => {
    const rows = unwrap(await requireSupabase().from('club_decision_locks').select('availability').eq('club_id', clubId).eq('user_id', userId!));
    return rows[0] ?? null;
  }, [clubId, userId]);
  const result = useResource(`decision-lock:${userId}:${clubId}:${availability}:${pendingVote}:${revision}`, load, Boolean(userId) && !isDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = Boolean(result.data);
  const disabled = busy || pendingVote || result.isLoading || Boolean(result.error) || (!locked && !canEnable);
  async function toggle() {
    if (disabled || isDemo) return;
    setBusy(true); setError('');
    try {
      const { error: cause } = await requireSupabase().rpc('set_club_decision_lock', {
        p_club_id: clubId, p_enabled: !locked, ...(entryId ? { p_call_up_player_id: entryId } : {}),
      });
      if (cause) throw cause;
      result.reload();
      onChanged?.();
    } catch (cause) { setError(backendErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  if (isDemo || ((!entryId || (votingClosed && !canEnable)) && !locked && !result.error)) return null;
  return <View style={{ gap: 6 }}>
    <Pressable accessibilityRole="switch" accessibilityLabel={t('Mantener decisión')}
      {...(Platform.OS === 'web' ? { 'aria-checked': locked } : {})} accessibilityState={{ checked: locked, disabled }} disabled={disabled} onPress={() => { void toggle(); }}
      style={{ minHeight: 44, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: locked ? colors.primary : colors.border,
        flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', opacity: disabled ? 0.55 : 1 }}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={locked ? colors.primary : colors.muted} strokeWidth={1.8}
        {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false, accessibilityElementsHidden: true })}>
        <Path d={locked ? 'M6 10h12v11H6V10zM8 10V6a4 4 0 018 0v4' : 'M6 10h12v11H6V10zM8 10V6a4 4 0 017-2'} />
      </Svg>
      <Text style={{ color: locked ? colors.primary : colors.text, fontWeight: '700', fontSize: 13 }}>{t('Mantener decisión')}</Text>
    </Pressable>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
      {locked && result.data ? t('Se mantendrá «{{v0}}» en las próximas convocatorias de este club hasta que lo desactives.', { v0: t(availabilityLabels[result.data.availability]) })
        : canEnable ? t('Reutiliza tu voto en las próximas convocatorias de este club.') : t('Vota primero para mantener tu decisión.')}
    </Text>
    {error || result.error ? <><Message error>{error || result.error}</Message>{result.error ? <Button secondary label={t('Reintentar')} onPress={result.reload} /> : null}</> : null}
  </View>;
}
