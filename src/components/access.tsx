import type { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { Body, Button, Heading, Screen } from './ui';
import { LoadingScreen } from './loading';

export function AuthAccess({ children }: PropsWithChildren) {
  const { isLoading, session, isDemo, isRecovery } = useAuth();
  if (isLoading) return <LoadingScreen label="Comprobando tu sesión…" />;
  if (!session && !isDemo) return <Redirect href="/login" />;
  if (isRecovery) return <Redirect href="/reset-password" />;
  return children;
}

export function ClubAccess({ children, admin = false }: PropsWithChildren<{ admin?: boolean }>) {
  return <AuthAccess><ClubCheck admin={admin}>{children}</ClubCheck></AuthAccess>;
}
function ClubCheck({ children, admin }: PropsWithChildren<{ admin: boolean }>) {
  const { activeClub, currentMembership, isLoading, error, refresh } = useClub();
  if (isLoading) return <LoadingScreen label="Cargando el club…" />;
  if (error) return <Screen><Heading title="No se pudieron cargar tus clubes" /><Body>{error}</Body><Button label="Reintentar" onPress={refresh} /></Screen>;
  if (!activeClub) return <Redirect href="/clubs" />;
  if (admin && currentMembership?.role !== 'admin') return <Redirect href="/home" />;
  return children;
}
