import { t, useLanguage } from '@/features/i18n/runtime';
import type { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { Body, Button, Heading, Screen } from './ui';
import { LoadingScreen } from './loading';

export function AuthAccess({ children }: PropsWithChildren) {
  useLanguage();
  const { isLoading, session, isDemo, isRecovery } = useAuth();
  if (isLoading) return <LoadingScreen label={t("Comprobando tu sesión…")} />;
  if (!session && !isDemo) return <Redirect href="/login" />;
  if (isRecovery) return <Redirect href="/reset-password" />;
  return children;
}

export function ClubAccess({ children, admin = false }: PropsWithChildren<{ admin?: boolean }>) {
  useLanguage();
  return <AuthAccess><ClubCheck admin={admin}>{children}</ClubCheck></AuthAccess>;
}
function ClubCheck({ children, admin }: PropsWithChildren<{ admin: boolean }>) {
  useLanguage();
  const { activeClub, currentMembership, isLoading, error, refresh } = useClub();
  if (isLoading) return <LoadingScreen label={t("Cargando el club…")} />;
  if (error) return <Screen><Heading title={t("No se pudieron cargar tus clubes")} /><Body>{error}</Body><Button label={t("Reintentar")} onPress={refresh} /></Screen>;
  if (!activeClub) return <Redirect href="/clubs" />;
  if (admin && currentMembership?.role !== 'admin') return <Redirect href="/home" />;
  return children;
}
