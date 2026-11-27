export function normalizePhone(input: string): string | null {
  // WhatsApp/contact apps may wrap copied numbers in invisible direction markers.
  // Remove presentation characters only: never infer a country or strip other text.
  const value = input.replace(/[\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim();
  if (!value) return null;
  const phone = value.replace(/[\s().\-\u2010-\u2015\u2212]/g, '').replace(/^00/, '+');
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) throw new Error('Introduce el teléfono con prefijo internacional, por ejemplo +34 612 345 678.');
  return phone;
}
export function whatsappUrl(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Introduce un teléfono.');
  return `https://wa.me/${normalized.slice(1)}`;
}
