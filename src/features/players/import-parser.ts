import { isPosition } from './positions.ts';
import { isCategory, legacyCategory } from './categories.ts';
import type { RosterCategory } from './categories.ts';

type Availability = 'available' | 'unavailable' | 'backup' | null;
export type ImportRow = {
  id: string; lineNumber: number; raw: string; kind: 'player' | 'trial' | 'aid';
  jerseyText: string; eaId: string; positionText: string; category: string; notes: string;
  availability: Availability; selected: boolean; requiresReview: boolean;
};
export type ImportPlayer = { eaId: string; jerseyNumber: number | null; category: RosterCategory };
export type ImportTrial = { eaId: string; jerseyNumber: number | null; position: string | null; notes: string | null };
export type ExistingPlayer = { eaId: string; jerseyNumber: number | null };
export type CheckedImportRow = { row: ImportRow; errors: string[]; warnings: string[]; player: ImportPlayer | null; trial: ImportTrial | null };
const cleanEmoji = (value: string) => value.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\uFE0F\u200D\u20E3]/gu, '').trim();
function header(value: string): RosterCategory | 'trial' | 'aid' | null {
  const text = cleanEmoji(value).replace(/[*`]/g, '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[\s/\-]+/g, ' ').trim();
  if (/^(PORTEROS?|POR)$/.test(text)) return 'goalkeepers';
  if (/^(CENTRALES?|DFC)$/.test(text)) return 'centre_backs';
  if (/^(LATERALES?( CARRILEROS?)?|CARRILEROS?|LI|LD)$/.test(text)) return 'wide_backs';
  if (/^(CENTROCAMPISTAS?|MCDS?( VOLANTES?)?|VOLANTES?|MCOS?|MCS?|MCD|MCO|MI|MD)$/.test(text)) return 'midfielders';
  if (/^(ATACANTES?|DELANTEROS?|EXTREMOS?|EI|ED|DC)$/.test(text)) return 'attackers';
  if (/^BACK ?UPS?$/.test(text)) return 'backups';
  if (text === 'PRUEBAS') return 'trial';
  if (text === 'AYUDAS') return 'aid';
  return null;
}
export function parseRosterText(text: string): { rows: ImportRow[]; error: string | null; metadata: string[] } {
  if (text.length > 20_000) return { rows: [], metadata: [], error: 'El texto es demasiado largo. Divide la plantilla en lotes de hasta 100 entradas.' };
  const rows: ImportRow[] = []; const metadata: string[] = [];
  let section: RosterCategory | 'trial' | 'aid' | null = null;
  for (const [index, raw] of text.split(/\r\n?|\n/).entries()) {
    if (!raw.trim()) continue;
    const found = header(raw);
    if (found) { section = found; continue; }
    const cleaned = cleanEmoji(raw.replace(/([0-9])\uFE0F?\u20E3/g, '$1')).replace(/^[•●▪◦]\s*/, '').replace(/[*`]/g, '').trim();
    if (/^(FC\s*\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|(?:Lunes|Martes|Miercoles|Miércoles|Jueves|Viernes|Sabado|Sábado|Domingo)\s+\d{1,2}:\d{2})$/i.test(cleaned) && section === null) { metadata.push(raw); continue; }
    const kind = section === 'trial' || section === 'aid' ? section : 'player';
    const emojiMatch = /^((?:[0-9]\uFE0F?\u20E3)+)\s*[-–—.:)]?\s*(.*)$/.exec(raw.trim().replace(/^[•●▪◦]\s*/, '').replace(/[*`]/g, ''));
    const start = emojiMatch ? [emojiMatch[0], emojiMatch[1]?.replace(/([0-9])\uFE0F?\u20E3/g, '$1'), cleanEmoji(emojiMatch[2] ?? '')] : /^#?\s*(\d{1,3})(?:\s*[-–—.:)]\s*|\s+)(.+)$/.exec(cleaned);
    let eaId = start?.[2]?.trim() ?? cleaned;
    const tail = /^(.*?)\s*(?:\(\s*([a-z]{2,3})\s*\)|\[\s*([a-z]{2,3})\s*\]|(?:\s*[-–—/,]\s*|\s+)([a-z]{2,3}))$/i.exec(eaId);
    const position = (tail?.[2] ?? tail?.[3] ?? tail?.[4] ?? '').toUpperCase();
    const hasPosition = isPosition(position) && Boolean(tail?.[1]) && (!section || section === 'trial' || Boolean(tail?.[2] || tail?.[3]) || /[-–—/,]\s*[a-z]{2,3}$/i.test(eaId));
    if (hasPosition && tail?.[1]) eaId = tail[1].trim();
    const category = section && isCategory(section) ? section : isPosition(position) ? legacyCategory[position] : '';
    const trialPosition = kind === 'trial' ? /^(.*?)\s*\(([^()]{1,80})\)$/.exec(eaId) : null;
    if (trialPosition?.[1]) eaId = trialPosition[1].trim();
    const unknownHeading = !start && !hasPosition && cleaned === cleaned.toUpperCase() && /^\p{Letter}[\p{Letter}\s/]+$/u.test(cleaned);
    const ambiguous = /^\d+\s+(?:jugador(?:es)?(?:\s+externos?)?|dfc|mc|mcd|mco|dc|por|li|ld)(?:\s|$)/i.test(cleaned);
    rows.push({ id: `line-${index + 1}`, lineNumber: index + 1, raw, kind, jerseyText: kind === 'aid' ? '' : start?.[1] ?? '',
      eaId: kind === 'aid' ? cleaned : eaId, positionText: trialPosition?.[2]?.trim() ?? (hasPosition ? position : ''), category,
      notes: '', availability: raw.includes('✅') ? 'available' : raw.includes('❌') ? 'unavailable' : raw.includes('🟡') ? 'backup' : null,
      selected: kind !== 'aid', requiresReview: kind !== 'aid' && (ambiguous || unknownHeading || (!start && /^\d+(?:\p{Letter}|\/)/u.test(cleaned)) || (!start && !category && kind !== 'trial')) });
  }
  return { rows, metadata, error: rows.length > 100 ? 'Puedes importar hasta 100 entradas por lote.' : rows.length ? null : 'Pega al menos una línea de plantilla.' };
}
export function validateImportRows(rows: readonly ImportRow[], existing: readonly ExistingPlayer[], existingTrials: readonly { eaId: string }[] = []): CheckedImportRow[] {
  const ids = new Set(existing.map(player => player.eaId.trim().toLowerCase()));
  const trials = new Set(existingTrials.map(player => player.eaId.trim().toLowerCase()));
  const numbers = new Set(existing.flatMap(player => player.jerseyNumber === null ? [] : [player.jerseyNumber]));
  const counts = new Map<string, number>(); const numberCounts = new Map<number, number>();
  for (const row of rows.filter(row => row.selected && row.kind !== 'aid')) {
    const id = row.eaId.trim().toLowerCase(); counts.set(id, (counts.get(id) ?? 0) + 1);
    if (row.jerseyText.trim()) { const number = Number(row.jerseyText); numberCounts.set(number, (numberCounts.get(number) ?? 0) + 1); }
  }
  return rows.map(row => {
    const errors: string[] = []; const warnings: string[] = [];
    const eaId = row.eaId.trim(); const number = row.jerseyText.trim() ? Number(row.jerseyText) : null;
    const category = row.category || (isPosition(row.positionText.trim().toUpperCase()) ? legacyCategory[row.positionText.trim().toUpperCase() as keyof typeof legacyCategory] : '');
    if (row.kind === 'aid') return { row, errors, warnings: ['AYUDAS no se importa a la plantilla. Añádela explícitamente a una convocatoria.'], player: null, trial: null };
    if (number !== null && (!/^\d{1,2}$/.test(row.jerseyText.trim()) || number < 1 || number > 99)) errors.push('El dorsal debe estar entre 1 y 99 o quedar vacío.');
    if (!eaId || eaId.length > 64) errors.push('Introduce un EA ID de 1 a 64 caracteres.');
    if (row.requiresReview) errors.push('Entrada ambigua: corrige el nombre y confirma su interpretación.');
    if (row.kind === 'player' && !isCategory(category)) errors.push('Selecciona una categoría válida.');
    if (row.positionText.length > 80 || row.notes.length > 1000) errors.push('La posición o las observaciones son demasiado largas.');
    if (row.selected && (counts.get(eaId.toLowerCase()) ?? 0) > 1) errors.push('EA ID duplicado en este lote.');
    if (row.selected && ids.has(eaId.toLowerCase())) errors.push('Ese EA ID ya está en la plantilla, incluso si está inactivo.');
    if (row.selected && trials.has(eaId.toLowerCase())) errors.push('Ese EA ID ya tiene una prueba activa. Incorpora o retira su ficha existente.');
    if (row.selected && number !== null && (numbers.has(number) || (numberCounts.get(number) ?? 0) > 1)) warnings.push('Dorsal repetido. Revísalo antes de confirmar.');
    if (row.availability) warnings.push('Disponibilidad detectada solo en la vista previa; no se guarda.');
    return { row, errors, warnings, player: errors.length === 0 && row.kind === 'player' && isCategory(category) ? { eaId, jerseyNumber: number, category } : null,
      trial: errors.length === 0 && row.kind === 'trial' ? { eaId, jerseyNumber: number, position: row.positionText.trim() || null, notes: row.notes.trim() || null } : null };
  });
}
