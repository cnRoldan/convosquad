import { useLanguage } from '@/features/i18n/runtime';
import { LanguageSelector } from '@/features/i18n/language-selector';
import { useSegments } from 'expo-router';
import { ClubCrest } from '@/features/clubs/club-crest';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { eaIdPattern } from '@/features/auth/ea-account';
import { SessionMenu } from './session-menu';

export function SessionIdentity({ compact }: { compact: boolean }) {
  useLanguage();
  const { session, isDemo } = useAuth();
  const segments = useSegments();
  const { accountEaId, activeClub } = useClub();
  const username: unknown = session?.user.user_metadata.username;
  const eaId = accountEaId ?? (typeof username === 'string' && eaIdPattern.test(username) ? username : null);
  if (!session || isDemo || !eaId) return null;
  return <View style={[styles.row, compact && styles.compact]}>
    <View>{activeClub && segments.some(segment => segment === '(club)' || segment === '(manage)') ? <ClubCrest path={activeClub.crestPath} name={activeClub.name} size={32} /> : null}</View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}><SessionMenu eaId={eaId} /><LanguageSelector /></View>
  </View>;
}

const styles = StyleSheet.create({
  row: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  compact: { maxWidth: 880, paddingHorizontal: 16 },
});
