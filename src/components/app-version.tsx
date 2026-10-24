import { Text, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { colors } from '@/theme';

export function AppVersion() {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';
  const build = Application.nativeBuildVersion;
  const revision = Constants.expoConfig?.extra?.revision;
  const webRevision = typeof revision === 'string' ? revision.slice(0, 7) : null;
  const detail = Platform.OS === 'web' ? webRevision : build;
  const platform = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  return <Text selectable style={{ color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 12 }}>
    {`ConvoSquad ${version}${detail ? ` (${detail})` : ''} · ${platform}`}
  </Text>;
}
