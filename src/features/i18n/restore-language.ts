import { supportedLanguage, type Language } from './runtime.ts';

type Dependencies = {
  read(key: string): Promise<string | null>;
  write(key: string, language: Language): Promise<unknown>;
  readRemote(userId: string): Promise<string | null>;
  initializeRemote(language: Language): Promise<unknown>;
  apply(language: Language): Promise<unknown>;
  deviceLocale: string | undefined;
  current(): boolean;
};

export async function restoreLanguage(userId: string | null, dependencies: Dependencies) {
  const deviceKey = 'convosquad:language:device';
  const userKey = `convosquad:language:${userId}`;
  const [device, user] = await Promise.all([
    dependencies.read(deviceKey).catch(() => null),
    userId ? dependencies.read(userKey).catch(() => null) : Promise.resolve(null),
  ]);
  if (!dependencies.current()) return;
  let language = supportedLanguage(user ?? device ?? dependencies.deviceLocale);
  await dependencies.apply(language);
  if (!userId || !dependencies.current()) return;
  // Cache both scopes so login keeps the account's language after signing out.
  await Promise.all([dependencies.write(userKey, language), dependencies.write(deviceKey, language)]).catch(() => undefined);
  if (!dependencies.current()) return;
  let remote: string | null;
  try { remote = await dependencies.readRemote(userId); } catch { return; }
  if (!dependencies.current()) return;
  if (!remote) { await dependencies.initializeRemote(language).catch(() => undefined); return; }
  language = supportedLanguage(remote);
  await Promise.all([dependencies.write(userKey, language), dependencies.write(deviceKey, language)]).catch(() => undefined);
  if (dependencies.current()) await dependencies.apply(language);
}
