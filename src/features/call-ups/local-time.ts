export function clubLocalTimeToInstant(date: string, time: string, timezone: string): string {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Introduce una fecha AAAA-MM-DD y una hora HH:mm válidas.');
  const tentative = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(tentative) || new Date(tentative).toISOString().slice(0, 10) !== date) throw new Error('La fecha no es válida.');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = tentative + offset * 60_000;
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === time) matches.push(instant);
  }
  if (matches.length !== 1) throw new Error('Esa hora no existe o se repite por el cambio de horario. Elige otra hora.');
  return new Date(matches[0]!).toISOString();
}

export function clubLocalDateTime(timezone: string, instant = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
