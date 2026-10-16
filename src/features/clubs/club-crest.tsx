import { useCallback, useState } from 'react';
import { Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useResource } from '@/hooks/use-resource';
import { getClubCrestUrl } from './crest';
export function ClubCrest({ path, name, size = 48 }: { path?: string | null | undefined; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => path ? getClubCrestUrl(path) : Promise.resolve(null), [path]);
  const result = useResource(`crest:${path ?? ''}`, load, Boolean(path));
  const { reload } = result;
  useFocusEffect(useCallback(() => { setFailed(false); if (path) reload(); }, [path, reload]));
  if (!result.data || failed) return null;
  return <Image accessibilityLabel={`Escudo de ${name}`} source={{ uri: result.data, cache: 'reload' }} resizeMode="contain" style={{ width: size, height: size, flexShrink: 0 }} onError={() => setFailed(true)} />;
}
