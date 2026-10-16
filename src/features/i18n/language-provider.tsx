import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useRef, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { requireSupabase } from '@/lib/supabase';
import { i18n, supportedLanguage, t, type Language } from './runtime';
const LanguageContext = createContext<{ changeLanguage: (language: Language) => Promise<void> } | null>(null);
export function LanguageProvider({ children }: PropsWithChildren) {
  const { session, isDemo } = useAuth();
  const user = session?.user.id;
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const version = ++revision.current;
    void (async () => {
      const saved = await AsyncStorage.getItem(`convosquad:language:${user ?? 'device'}`);
      let next = supportedLanguage(saved ?? getLocales()[0]?.languageTag);
      if (user && !isDemo) {
        const { data, error } = await requireSupabase().from('profiles').select('preferred_language').eq('id', user).single();
        if (!error && data?.preferred_language) next = supportedLanguage(data.preferred_language);
        if (!error && !data?.preferred_language && active && version === revision.current) await requireSupabase().rpc('set_preferred_language', { p_language: next });
      }
      if (active && version === revision.current) await i18n.changeLanguage(next);
    })().catch(() => undefined);
    return () => { active = false; };
  }, [user, isDemo]);
  async function changeLanguage(language: Language) {
    revision.current++;
    await i18n.changeLanguage(language);
    await AsyncStorage.setItem(`convosquad:language:${user ?? 'device'}`, language);
    await AsyncStorage.setItem('convosquad:language:device', language);
    if (user && !isDemo) {
      const { error } = await requireSupabase().rpc('set_preferred_language', { p_language: language });
      if (error) throw new Error(t('El idioma se ha cambiado en este dispositivo, pero no se pudo guardar para los avisos. Reintenta cuando tengas conexión.'));
    }
  }
  return <LanguageContext.Provider value={{ changeLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguagePreference() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('LanguageProvider missing');
  return value;
}
