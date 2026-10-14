export type RegistrationResult = 'enabled' | 'denied' | 'cancelled' | 'unsupported';
export async function registerDeviceWithPermission(deps: {
  supported: boolean;
  current: () => Promise<boolean>;
  permission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  token: () => Promise<string>;
  register: (token: string) => Promise<void>;
  deactivate: () => Promise<void>;
}, prompt: boolean): Promise<RegistrationResult> {
  if (!deps.supported) return 'unsupported';
  if (!await deps.current()) return 'cancelled';
  let allowed = await deps.permission();
  if (!allowed && prompt && await deps.current()) allowed = await deps.requestPermission();
  if (!await deps.current()) return 'cancelled';
  if (!allowed) { await deps.deactivate(); return 'denied'; }
  const token = await deps.token();
  if (!await deps.current()) return 'cancelled';
  await deps.register(token);
  return await deps.current() ? 'enabled' : 'cancelled';
}
