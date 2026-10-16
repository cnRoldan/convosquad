import { LanguageProvider } from '@/features/i18n/language-provider';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ClubProvider } from '@/features/clubs/club-context';
import { AuthProvider } from '@/features/auth/auth-context';
import { PendingInviteProvider } from '@/features/invitations/pending-invite-context';
import { PendingPushProvider } from '@/features/notifications/pending-push-context';
import { NativePushLifecycle } from '@/features/notifications/native-lifecycle';
import { colors } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
      <LanguageProvider>
        <PendingPushProvider>
        <PendingInviteProvider>
          <ClubProvider>
            <NativePushLifecycle />
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="clubs" />
              <Stack.Screen name="(account)" />
              <Stack.Screen name="(manage)" />
              <Stack.Screen name="notification" />
              <Stack.Screen name="invite" />
              <Stack.Screen name="(club)" />
              <Stack.Screen name="auth/callback" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </ClubProvider>
        </PendingInviteProvider>
        </PendingPushProvider>
      </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
