import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { eaIdPattern } from '@/features/auth/ea-account';
import { colors } from '@/theme';

export function SessionIdentity({ compact }: { compact: boolean }) {
  const { session, isDemo } = useAuth();
  const { accountEaId } = useClub();
  const username: unknown = session?.user.user_metadata.username;
  const eaId = accountEaId ?? (typeof username === 'string' && eaIdPattern.test(username) ? username : null);
  if (!session || isDemo || !eaId) return null;
  return <View style={[styles.row, compact && styles.compact]}>
    <Text accessibilityLabel={`Sesión iniciada como ${eaId}`} numberOfLines={1} ellipsizeMode="tail" style={styles.badge}>ID: {eaId}</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { width: '100%', maxWidth: 600, alignSelf: 'center', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  compact: { maxWidth: 880, paddingHorizontal: 16 },
  badge: { maxWidth: '100%', color: colors.primary, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, fontWeight: '600' },
});
