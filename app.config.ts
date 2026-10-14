import type { ConfigContext, ExpoConfig } from 'expo/config';
export default function configure({ config }: ConfigContext): ExpoConfig {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID debe ser el UUID real del proyecto EAS.');
  return {
    ...config, name: 'ConvoSquad', slug: 'convosquad',
    extra: { ...config.extra, eas: { ...config.extra?.eas, ...(projectId ? { projectId } : {}) } },
    android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
  };
}
