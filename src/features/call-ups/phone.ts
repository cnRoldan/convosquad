export function normalizePhone(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const phone = value.replace(/[\s().-]/g, '').replace(/^00/, '+');
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) throw new Error('Introduce el teléfono con prefijo internacional, por ejemplo +34 612 345 678.');
  return phone;
}
export function whatsappUrl(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Introduce un teléfono.');
  return `https://wa.me/${normalized.slice(1)}`;
}
