import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Lucide icons (ISC license): https://lucide.dev/license
export function NavigationIcon({ name, color }: { name: 'house' | 'shirt' | 'user-round-check'; color: ColorValue }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {name === 'house' ? <><Path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><Path d="M9 21v-8h6v8" /></> : null}
    {name === 'shirt' ? <Path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a1 1 0 0 0-.57 1.28l1.58 3.95a1 1 0 0 0 1.28.56L8 8.5V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8.5l2.09.75a1 1 0 0 0 1.28-.56l1.58-3.95a1 1 0 0 0-.57-1.28Z" /> : null}
    {name === 'user-round-check' ? <><Path d="M2 21a8 8 0 0 1 13.3-6M16 19l2 2 4-4" /><Circle cx={10} cy={8} r={5} /></> : null}
  </Svg>;
}
