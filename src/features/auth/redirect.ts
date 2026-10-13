import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export function authCallbackUrl() {
  return process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
    || (Platform.OS === 'web' ? Linking.createURL('/auth/callback') : 'convosquad://auth/callback');
}
