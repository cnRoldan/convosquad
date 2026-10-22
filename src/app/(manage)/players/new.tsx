import { PlayerEditor } from '@/features/players/player-editor';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { useLocalSearchParams } from 'expo-router';

export default function NewPlayerScreen() {
  const { session } = useAuth();
  const { activeClub } = useClub();
  const { self } = useLocalSearchParams<{ self?: string }>();
  return <PlayerEditor key={`${session?.user.id}:${activeClub?.id}:${self}`} self={self === '1'} />;
}
