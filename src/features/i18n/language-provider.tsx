import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useRef, type PropsWithChildren } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { requireSupabase } from '@/lib/supabase';
import { i18n, t, type Language } from './runtime';
import { restoreLanguage } from './restore-language';
const LanguageContext = createContext<{ changeLanguage: (language: Language) => Promise<void> } | null>(null);
export function LanguageProvider({ children }: PropsWithChildren) {
  const { session, isDemo } = useAuth();
  const user = session?.user.id;
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const version = ++revision.current;
    void restoreLanguage(isDemo ? null : user ?? null, {
      read: key => AsyncStorage.getItem(key),
      write: (key, language) => AsyncStorage.setItem(key, language),
      readRemote: async id => {
        const { data, error } = await requireSupabase().from('profiles').select('preferred_language').eq('id', id).single();
        if (error) throw error;
        return data.preferred_language;
      },
      initializeRemote: async language => { const result = await requireSupabase().rpc('set_preferred_language', { p_language: language }); if (result.error) throw result.error; },
      apply: language => i18n.changeLanguage(language),
      deviceLocale: getLocales()[0]?.languageTag,
      current: () => active && version === revision.current,
    }).catch(() => undefined);
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
