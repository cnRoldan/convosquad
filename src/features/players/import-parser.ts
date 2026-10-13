import { isPosition } from './positions.ts';
import type { PlayerPosition } from './positions.ts';

export type ImportRow = {
  id: string;
  lineNumber: number;
  raw: string;
  jerseyText: string;
  eaId: string;
  positionText: string;
  selected: boolean;
};
export type ImportPlayer = { eaId: string; jerseyNumber: number; position: PlayerPosition };
export type ExistingPlayer = { eaId: string; jerseyNumber: number | null };
export type CheckedImportRow = { row: ImportRow; errors: string[]; warnings: string[]; player: ImportPlayer | null };

export function parseRosterText(text: string): { rows: ImportRow[]; error: string | null } {
  if (text.length > 20_000) return { rows: [], error: 'El texto es demasiado largo. Divide la plantilla en lotes de hasta 100 jugadores.' };
  const lines = text.split(/\r\n?|\n/).map((raw, index) => ({ raw, lineNumber: index + 1 })).filter((line) => line.raw.trim());
  if (lines.length > 100) return { rows: [], error: 'Puedes importar hasta 100 jugadores por lote.' };
  const rows = lines.map(({ raw, lineNumber }) => {
    const cleaned = raw.trim().replace(/^[•●▪◦]\s*/, '').replace(/[*`]/g, '').trim();
    const start = /^#?\s*(\d{1,3})(?:\s*[-–—.:)]\s*|\s+)(.+)$/.exec(cleaned);
    const tail = start?.[2]?.trim();
    const end = tail ? /^(.*?)\s*(?:\(\s*([a-z]{2,3})\s*\)|\[\s*([a-z]{2,3})\s*\]|(?:\s*[-–—/,]\s*|\s+)([a-z]{2,3}))$/i.exec(tail) : null;
    return {
      id: `line-${lineNumber}`, lineNumber, raw,
      jerseyText: start?.[1] ?? '', eaId: end?.[1]?.trim() ?? tail ?? '',
      positionText: (end?.[2] ?? end?.[3] ?? end?.[4] ?? '').toUpperCase(), selected: true,
    };
  });
  return { rows, error: rows.length ? null : 'Pega al menos una línea de plantilla.' };
}

export function validateImportRows(rows: readonly ImportRow[], existing: readonly ExistingPlayer[]): CheckedImportRow[] {
  const selected = rows.filter((row) => row.selected);
  const existingIds = new Set(existing.map((player) => player.eaId.trim().toLowerCase()));
  const existingNumbers = new Set(existing.flatMap((player) => player.jerseyNumber === null ? [] : [player.jerseyNumber]));
  const counts = new Map<string, number>();
  const numberCounts = new Map<number, number>();
  for (const row of selected) {
    const id = row.eaId.trim().toLowerCase();
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const number = Number(row.jerseyText);
    numberCounts.set(number, (numberCounts.get(number) ?? 0) + 1);
  }
  return rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const eaId = row.eaId.trim();
    const jerseyNumber = Number(row.jerseyText);
    const position = row.positionText.trim().toUpperCase();
    if (!/^[0-9]{1,2}$/.test(row.jerseyText.trim()) || jerseyNumber < 1 || jerseyNumber > 99) errors.push('El dorsal debe estar entre 1 y 99.');
    if (!eaId || eaId.length > 64) errors.push('Introduce un EA ID de 1 a 64 caracteres.');
    if (!isPosition(position)) errors.push('Selecciona una posición válida.');
    if (row.selected && existingIds.has(eaId.toLowerCase())) errors.push('Ese EA ID ya está en la plantilla, incluso si está inactivo.');
    if (row.selected && (counts.get(eaId.toLowerCase()) ?? 0) > 1) errors.push('EA ID duplicado en este lote.');
    if (row.selected && ((numberCounts.get(jerseyNumber) ?? 0) > 1 || existingNumbers.has(jerseyNumber))) warnings.push('Dorsal repetido. Revísalo antes de confirmar.');
    const player = errors.length === 0 && isPosition(position) ? { eaId, jerseyNumber, position } : null;
    return { row, errors, warnings, player };
  });
}
