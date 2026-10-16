import { t } from '../i18n/runtime.ts';
export function jerseyLabel(jersey: number | null) { return jersey === null ? t('Sin dorsal') : `#${jersey}`; }
export function jerseyAccessibilityLabel(jersey: number | null) { return jersey === null ? t('Sin dorsal') : t('Dorsal {{v0}}', { v0: jersey }); }
