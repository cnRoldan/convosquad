import { Link, router } from 'expo-router';
import Head from 'expo-router/head';
import { Text, View } from 'react-native';
import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { LanguageSelector } from '@/features/i18n/language-selector';
import { intlLocale, supportedLanguage, t, useLanguage } from '@/features/i18n/runtime';
import { privacyContact, privacyPolicies, privacyUpdatedAt } from '@/features/legal/privacy';
import { colors } from '@/theme';

const linkStyle = { color: colors.primary, fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' as const };

export default function PrivacyScreen() {
  const language = supportedLanguage(useLanguage());
  const { session, isDemo } = useAuth();
  const policy = privacyPolicies[language];
  const date = new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${privacyUpdatedAt}T12:00:00Z`));
  return <Screen>
    <Head><title>{`${t('Política de privacidad')} · ConvoSquad`}</title><meta name="description" content={policy.intro} /></Head>
    {!session || isDemo ? <View style={{ alignSelf: 'flex-end' }}><LanguageSelector /></View> : null}
    <Heading title={t('Política de privacidad')} subtitle="ConvoSquad" />
    <Body>{t('Última actualización: {{v0}}', { v0: date })}</Body>
    <Body>{policy.intro}</Body>
    <Link href={`mailto:${privacyContact}`} style={linkStyle}>{privacyContact}</Link>
    <Link href="/delete-account" style={linkStyle}>{t('Eliminar mi cuenta')}</Link>
    {policy.sections.map(section => <Card key={section.title}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{section.title}</Text>
      {section.paragraphs.map(paragraph => <Body key={paragraph}>{paragraph}</Body>)}
    </Card>)}
    <Card title={t('Políticas de los proveedores')}>
      {policy.providerLinks.map(provider => <Link key={provider.href} href={provider.href} style={linkStyle}>{provider.label}</Link>)}
      <Link href="https://www.aepd.es/" style={linkStyle}>Agencia Española de Protección de Datos (AEPD)</Link>
    </Card>
    <Button secondary label={t('Volver')} onPress={() => { if (router.canGoBack()) router.back(); else router.replace(session || isDemo ? '/clubs' : '/'); }} />
  </Screen>;
}
