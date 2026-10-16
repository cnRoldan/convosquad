import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Language } from './runtime';

// Draw flags locally: regional-indicator emoji render as letters on Windows.
export function LanguageFlag({ language }: { language: Language }) {
  return <Svg width={30} height={20} viewBox="0 0 30 20"
    {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false, accessibilityElementsHidden: true })}>
    {language === 'es' ? <>
      <Rect width={30} height={20} fill="#AA151B" />
      <Rect y={5} width={30} height={10} fill="#F1BF00" />
    </> : language === 'de' ? <>
      <Rect width={30} height={20} fill="#000000" />
      <Rect y={20 / 3} width={30} height={40 / 3} fill="#DD0000" />
      <Rect y={40 / 3} width={30} height={20 / 3} fill="#FFCE00" />
    </> : language === 'fr' ? <>
      <Rect width={30} height={20} fill="#FFFFFF" />
      <Rect width={10} height={20} fill="#002395" />
      <Rect x={20} width={10} height={20} fill="#ED2939" />
    </> : <>
      <Rect width={30} height={20} fill="#012169" />
      <Path d="M0 0H4.5L30 17V20H25.5L0 3ZM30 0H25.5L0 17V20H4.5L30 3Z" fill="#FFFFFF" />
      <Path d="M0 0H1.5L30 19V20H28.5L0 1ZM30 0H28.5L0 19V20H1.5L30 1Z" fill="#C8102E" />
      <Path d="M12 0H18V7H30V13H18V20H12V13H0V7H12Z" fill="#FFFFFF" />
      <Path d="M13 0H17V8H30V12H17V20H13V12H0V8H13Z" fill="#C8102E" />
    </>}
  </Svg>;
}
