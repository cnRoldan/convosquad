import { requireSupabase } from '@/lib/supabase';

export const usernamePattern = /^[A-Za-z0-9_]{3,24}$/;

export async function registerAccount(input: { username: string; email: string; password: string; redirectTo: string }) {
  if (!usernamePattern.test(input.username.trim())) throw new Error('Nombre de usuario inválido.');
  const { data, error } = await requireSupabase().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { username: input.username.trim() }, emailRedirectTo: input.redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function loginAccount(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function logoutAccount() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}
