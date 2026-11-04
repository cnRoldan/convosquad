export const posterGeometry = {
  width: 1324, height: 1550,
  // Keep the header compact and use the stadium/grass portion of the asset.
  backgroundSourceTop: 300, backgroundTop: 180, backgroundHeight: 1370,
  sourceHeight: 1190, fieldFarY: 399, fieldHalfY: 634, fieldNearY: 1126,
} as const;

export function posterPoint(x: number, depth: number) {
  const g = posterGeometry;
  const t = Math.max(0, Math.min(1, depth));
  // Project the board onto the perspective pitch: its halfway line stays at
  // depth .5, rather than placing midfielders below the drawn centre circle.
  const c = (g.fieldFarY + g.fieldNearY - 2 * g.fieldHalfY) / (g.fieldHalfY - g.fieldNearY);
  const a = g.fieldNearY * (c + 1) - g.fieldFarY;
  const sourceY = (a * t + g.fieldFarY) / (c * t + 1);
  const width = 790 + 440 * (sourceY - g.fieldFarY) / (g.fieldNearY - g.fieldFarY);
  return {
    x: g.width / 2 + (x - .5) * width,
    y: g.backgroundTop + (sourceY - g.backgroundSourceTop) * g.backgroundHeight / (g.sourceHeight - g.backgroundSourceTop),
  };
}
