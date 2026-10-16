import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Image } from 'expo-image';
import { useAuth } from '@/features/auth/auth-context';
import { useResource } from '@/hooks/use-resource';
import { clubCrestCache } from './crest';
export function ClubCrest({ path, name, size = 48 }: { path?: string | null | undefined; name: string; size?: number }) {
  useLanguage();
  const { session } = useAuth();
  const user = session?.user.id ?? '';
  const version = useSyncExternalStore(clubCrestCache.subscribe, () => clubCrestCache.version(path ?? ''), () => 0);
  const [failure, setFailure] = useState<string | null>(null);
  const key = `crest:${user}:${path ?? ''}:${version}`;
  const load = useCallback(() => path && user ? clubCrestCache.get(user, path) : Promise.resolve(null), [path, user]);
  const result = useResource(key, load, Boolean(path && user));
  const url = path && user ? clubCrestCache.peek(user, path) ?? result.data : null;
  if (!url || failure === key) return null;
  return <Image accessibilityLabel={t("Escudo de {{v0}}", { v0: name })} source={{ uri: url }} cachePolicy="memory-disk" contentFit="contain" transition={0}
    style={{ width: size, height: size, flexShrink: 0 }} onError={() => setFailure(key)} />;
}
