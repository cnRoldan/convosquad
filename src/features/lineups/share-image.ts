import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export async function shareLineupImage(viewRef: RefObject<View | null>) {
  const uri = Platform.OS === 'web' ? await renderWebPoster(viewRef) : await captureRef(viewRef, { format: 'png', quality: 1, width: 1324, height: 1190, result: 'tmpfile' });
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

async function renderWebPoster(viewRef: RefObject<View | null>) {
  const root = viewRef.current as unknown as HTMLElement | null;
  const original = root?.querySelector('svg');
  if (!original) throw new Error('Lineup poster is not ready');
  const svg = original.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '1324');
  svg.setAttribute('height', '1190');
  // Embed raster resources before serializing: standalone SVGs cannot resolve
  // external images reliably when drawn onto a browser canvas.
  await Promise.all(Array.from(svg.querySelectorAll('image')).map(async element => {
    const href = element.getAttribute('href') ?? element.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (!href || href.startsWith('data:')) return;
    const response = await fetch(href);
    if (!response.ok) throw new Error('Unable to load poster image');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    element.setAttribute('href', data);
    element.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
  }));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1324;
    canvas.height = 1190;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, 1324, 1190);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
