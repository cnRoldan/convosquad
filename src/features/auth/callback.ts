import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthLink =
  | { kind: 'pkce'; code: string; flowId?: string }
  | { kind: 'otp'; tokenHash: string; type: 'recovery' | 'signup' | 'email' }
  | { kind: 'error'; code: string }
  | { kind: 'invalid' };

// Accept one credential only. URL hints never grant recovery privileges.
export function readAuthLink(url: string | null): AuthLink {
  if (!url) return { kind: 'invalid' };
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => params.append(key, value));
    for (const key of ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description', 'sb_flow_id']) {
      if (params.getAll(key).length > 1) return { kind: 'invalid' };
    }
    if (params.has('error') || params.has('error_code')) return { kind: 'error', code: params.get('error_code') || params.get('error') || 'unknown' };
    const code = params.get('code');
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (params.has('access_token') || params.has('refresh_token') || (params.has('code') && params.has('token_hash'))) return { kind: 'invalid' };
    if (code?.trim() && code.length <= 2048) {
      const flowId = params.get('sb_flow_id');
      return flowId ? { kind: 'pkce', code, flowId } : { kind: 'pkce', code };
    }
    if (tokenHash?.trim() && tokenHash.length <= 2048 && (type === 'recovery' || type === 'signup' || type === 'email')) return { kind: 'otp', tokenHash, type };
  } catch { /* Invalid links are shown without echoing credentials. */ }
  return { kind: 'invalid' };
}

export async function completeAuthLink(auth: Pick<SupabaseClient['auth'], 'verifyOtp' | 'exchangeCodeForSession'>, link: AuthLink) {
  if (link.kind === 'error') throw { code: link.code };
  if (link.kind !== 'otp' && link.kind !== 'pkce') throw new Error('Invalid auth link');
  if (link.kind === 'otp') {
    const { data, error } = await auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
    if (error) throw error;
    if (!data.session) throw new Error('Missing verified session');
    return { session: data.session, recovery: link.type === 'recovery' };
  }
  const { data, error } = await auth.exchangeCodeForSession(link.code, link.flowId ? { flowId: link.flowId } : undefined);
  if (error) throw error;
  if (!data.session) throw new Error('Missing verified session');
  return { session: data.session, recovery: 'redirectType' in data && data.redirectType === 'recovery' };
}
