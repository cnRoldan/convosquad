export function weeklyDays(locale: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 0, 5 + index)); // Monday first, independent of the device zone.
    return { value: index + 1,
      label: locale.toLowerCase().startsWith('es') ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'][index]!
        : locale.toLowerCase().startsWith('pt') ? ['2.ª', '3.ª', '4.ª', '5.ª', '6.ª', 'sáb', 'dom'][index]!
        : new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(day).replace(/\.$/, ''),
      name: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(day),
    };
  });
}
export function localWeekday(date: string) {
  return ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}
export function firstRecurringDate(from: string, days: readonly number[]) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(from) || !days.length || days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) return null;
  const date = new Date(`${from}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== from) return null;
  for (let offset = 0; offset < 7; offset++) {
    const candidate = date.toISOString().slice(0, 10);
    if (days.includes(localWeekday(candidate))) return candidate;
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return null;
}
