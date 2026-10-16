import { t, useLanguage } from '@/features/i18n/runtime';
import { LanguageSelector } from '@/features/i18n/language-selector';
import { useSegments } from 'expo-router';
import { ClubCrest } from '@/features/clubs/club-crest';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { eaIdPattern } from '@/features/auth/ea-account';
import { colors } from '@/theme';

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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}><Text accessibilityLabel={t("Sesión iniciada como {{v0}}", { v0: eaId })} numberOfLines={1} ellipsizeMode="tail" style={styles.badge}>ID: {eaId}</Text><LanguageSelector /></View>
  </View>;
}

const styles = StyleSheet.create({
  row: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  compact: { maxWidth: 880, paddingHorizontal: 16 },
  badge: { maxWidth: '85%', flexShrink: 1, color: colors.primary, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, fontWeight: '600' },
});
