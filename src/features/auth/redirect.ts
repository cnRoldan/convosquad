import * as Linking from 'expo-linking';

export function authCallbackUrl() {
  return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
    || Linking.createURL('/auth/callback');
}
