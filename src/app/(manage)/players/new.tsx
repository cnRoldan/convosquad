import { PlayerEditor } from '@/features/players/player-editor';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';

export default function NewPlayerScreen() {
  const { session } = useAuth();
  const { activeClub } = useClub();
  return <PlayerEditor key={`${session?.user.id}:${activeClub?.id}`} />;
}
