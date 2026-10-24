import type { ConfigContext, ExpoConfig } from 'expo/config';
export default function configure({ config }: ConfigContext): ExpoConfig {
  const slug = config.slug;
  if (!slug) throw new Error('Configura el slug del proyecto Expo existente en app.json.');
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const linkedId = config.extra?.eas?.projectId;
  if (projectId && linkedId && projectId.toLowerCase() !== String(linkedId).toLowerCase()) throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID no coincide con el proyecto EAS vinculado en app.json.');
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID debe ser el UUID real del proyecto EAS.');
  return {
    ...config, name: 'ConvoSquad', slug,
    extra: { ...config.extra, revision: process.env.COMMIT_REF ?? process.env.EAS_BUILD_GIT_COMMIT_HASH ?? null, eas: { ...config.extra?.eas, ...(projectId ? { projectId } : {}) } },
    android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
  };
}
