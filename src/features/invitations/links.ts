export type PendingInvitation = { clubId: string; token: string };
const clubIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readInvitation(club: unknown, token: unknown): PendingInvitation | null {
  if (typeof club !== 'string' || !clubIdPattern.test(club) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return { clubId: club.toLowerCase(), token };
}

export function invitationUrl(base: string, invitation: PendingInvitation): string {
  const url = new URL(base);
  url.searchParams.set('club', invitation.clubId);
  if (url.protocol === 'https:') url.hash = new URLSearchParams({ token: invitation.token }).toString();
  else url.searchParams.set('token', invitation.token);
  return url.toString();
}

export function webInviteBase(origin: string): string {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('La URL de invitaciones debe ser un origen HTTPS sin rutas ni credenciales.');
  }
  return `${url.origin}/invite`;
}

export function invitationFragmentToken(url: string | null): string | null {
  if (!url) return null;
  try {
    const tokens = new URLSearchParams(new URL(url).hash.slice(1)).getAll('token');
    return tokens.length === 1 ? tokens[0] ?? null : null;
  }
  catch { return null; }
}
