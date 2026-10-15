export const reminderOptions = [
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 día antes' },
] as const;

export function reminderMinutes(enabled: boolean, value: string): number | null {
  if (!enabled) return null;
  if (!reminderOptions.some(option => option.value === value)) throw new Error('Antelación no válida.');
  return Number(value);
}
