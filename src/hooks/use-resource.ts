import { useCallback, useEffect, useState } from 'react';
import { backendErrorMessage } from '@/lib/backend-result';

type ResourceState<T> = { key: string; revision: number; data: T | null; error: string | null };

export function useResource<T>(key: string, load: () => Promise<T>, enabled = true) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ResourceState<T> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void load().then((data) => {
      if (active) setState({ key, revision, data, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ key, revision, data: null, error: backendErrorMessage(error) });
    });
    return () => { active = false; };
  }, [key, revision, load, enabled]);
  const sameKey = state?.key === key;
  return {
    version: revision,
    data: enabled && sameKey ? state.data : null,
    error: enabled && sameKey ? state.error : null,
    isLoading: enabled && (!sameKey || state.revision !== revision),
    reload: useCallback(() => setRevision((value) => value + 1), []),
  };
}
