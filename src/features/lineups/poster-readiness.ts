export type PosterAsset = 'layout' | 'background' | 'crest' | 'brand';

// Native SVG raster images decode asynchronously. A layout/RAF alone does not
// mean they are painted, and captureRef can otherwise export an empty crest.
export function createPosterReadiness(hasCrest: boolean, timeoutMs = 15000, waitForRaster = true) {
  const pending = new Set<PosterAsset>(waitForRaster ? ['layout', 'background', 'brand', ...(hasCrest ? ['crest' as const] : [])] : ['layout']);
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  let finished = false;
  const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const timer = setTimeout(() => {
    finished = true;
    reject(new Error('No se terminaron de cargar las imágenes del once.'));
  }, timeoutMs);
  return {
    ready,
    loaded(asset: PosterAsset) {
      if (finished) return;
      pending.delete(asset);
      if (!pending.size) { finished = true; clearTimeout(timer); resolve(); }
    },
    cancel() {
      if (finished) return;
      finished = true; clearTimeout(timer); reject(new Error('Captura cancelada.'));
    },
  };
}
