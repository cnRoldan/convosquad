/** Choose the higher-contrast black/white number using sRGB relative luminance. */
export function goalkeeperNumberColor(shirtColor: string): '#000000' | '#FFFFFF' {
  if (!/^#[0-9a-f]{6}$/i.test(shirtColor)) return '#000000';
  const linear = [1, 3, 5].map(offset => {
    const channel = parseInt(shirtColor.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}
