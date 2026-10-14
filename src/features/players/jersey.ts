export function jerseyLabel(jersey: number | null) { return jersey === null ? 'Sin dorsal' : `#${jersey}`; }
export function jerseyAccessibilityLabel(jersey: number | null) { return jersey === null ? 'Sin dorsal' : `Dorsal ${jersey}`; }
