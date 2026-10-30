import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export async function shareLineupImage(viewRef: RefObject<View | null>) {
  const uri = await captureRef(viewRef, { format: 'png', quality: 0.95, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
  if (Platform.OS !== 'web') {
    if (!await Sharing.isAvailableAsync()) throw new Error('Sharing unavailable');
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir el 11' });
    return;
  }
  const blob = await (await fetch(uri)).blob();
  const file = new File([blob], 'convosquad-once.png', { type: 'image/png' });
  const browser = navigator as Navigator & { share?: (data: { files: File[]; title: string }) => Promise<void>; canShare?: (data: { files: File[] }) => boolean };
  if (browser.share && (!browser.canShare || browser.canShare({ files: [file] }))) {
    await browser.share({ files: [file], title: 'ConvoSquad · Tu 11' });
    return;
  }
  const link = document.createElement('a');
  link.href = uri; link.download = file.name; link.click();
}
