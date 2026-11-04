import { useCallback, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { Body, Button, Card, Message } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { requireSupabase } from '@/lib/supabase';
import { backendErrorMessage, unwrap } from '@/lib/backend-result';

export type LineupInstruction = { id: string; player_id: string; player_name: string; body: string; captain_name: string; published_at: string; recipient_linked: boolean };
export async function readLineupInstructions(callId: string): Promise<LineupInstruction[]> {
  return unwrap(await requireSupabase().rpc('read_lineup_instructions', { p_call_id: callId }));
}

export function LineupInstructionsButton({ callId, captain, initiallyOpen = false }: { callId: string; captain: boolean; initiallyOpen?: boolean }) {
  useLanguage();
  const { session } = useAuth();
  const [open, setOpen] = useState(initiallyOpen);
  const [deleting, setDeleting] = useState<LineupInstruction | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const load = useCallback(() => readLineupInstructions(callId), [callId]);
  const result = useResource(`lineup-instructions:${session?.user.id}:${callId}:${captain}`, load, open && Boolean(session));
  const title = captain ? 'Indicaciones de jugadores' : 'Mis indicaciones';
  return <>
    <Button secondary label={t(title)} onPress={() => { result.reload(); setOpen(true); }} />
    <Modal transparent visible={open && !deleting} onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}>
        <ScrollView style={{ maxHeight: '80%' }}><Card title={t(title)}>
          {result.isLoading ? <Body>{t('Cargando indicaciones…')}</Body> : null}
          {result.error ? <><Message error>{result.error}</Message><Button secondary label={t('Reintentar')} onPress={result.reload} /></> : null}
          {!result.isLoading && !result.error && !result.data?.length ? <Body>{t(captain ? 'No hay indicaciones publicadas para esta convocatoria.' : 'No tienes indicaciones publicadas para esta convocatoria.')}</Body> : null}
          {!result.isLoading && result.data?.map(instruction => <Card key={instruction.id} title={instruction.player_name}>
            {captain ? <View style={{ alignItems: 'flex-end' }}><IconButton icon="trash" danger label={t('Eliminar indicación de {{v0}}', { v0: instruction.player_name })} onPress={() => { setDeleteError(null); setDeleting(instruction); }} /></View> : null}
            <Body>{instruction.body}</Body>
            <Body>{t('Indicaciones de {{v0}}', { v0: instruction.captain_name })}</Body>
            {captain && !instruction.recipient_linked ? <Body>{t('Sin cuenta vinculada: la indicación solo está disponible para los capitanes.')}</Body> : null}
          </Card>)}
          <Button secondary label={t('Cerrar')} onPress={() => setOpen(false)} />
        </Card></ScrollView>
      </View>
    </Modal>
    <ConfirmDialog visible={Boolean(deleting)} title={t('Eliminar indicación')} description={t('Se eliminará la indicación de {{v0}} y el jugador dejará de verla.', { v0: deleting?.player_name ?? '' })} confirmLabel={t('Eliminar indicación')} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => {
      if (!deleting || busy) return;
      setBusy(true);
      setDeleteError(null);
      void (async () => {
        const { error } = await requireSupabase().rpc('delete_lineup_instruction', { p_instruction_id: deleting.id });
        if (error) throw error;
        result.reload();
        setDeleting(null);
      })().catch((error: unknown) => setDeleteError(backendErrorMessage(error))).finally(() => setBusy(false));
    }}>
      {deleteError ? <Message error>{t(deleteError)}</Message> : null}
    </ConfirmDialog>
  </>;
}
