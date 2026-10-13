import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ClubProvider } from '@/features/clubs/club-context';
import { colors } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <ClubProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="clubs" />
          <Stack.Screen name="(club)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ClubProvider>
    </ThemeProvider>
  );
}
