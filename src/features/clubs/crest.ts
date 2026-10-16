import { createCrestCache } from './crest-cache';
import { requireSupabase } from '@/lib/supabase';
export type ClubCrestImage = { uri: string; base64: string };
export async function pickClubCrest(): Promise<ClubCrestImage | null> {
  const Picker = await import('expo-image-picker');
  const picked = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, preferredAssetRepresentationMode: Picker.UIImagePickerPreferredAssetRepresentationMode.Current });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 512) context.resize(asset.width >= asset.height ? { width: 512 } : { height: 512 });
  const rendered = await context.renderAsync();
  try {
    const image = await rendered.saveAsync({ format: SaveFormat.PNG, base64: true });
    if (!image.base64) throw new Error('No se pudo preparar el escudo.');
    return { uri: image.uri, base64: image.base64 };
  } finally { rendered.release(); context.release(); }
}
export async function uploadClubCrest(clubId: string, image: ClubCrestImage) {
  const client = requireSupabase();
  const bytes = Uint8Array.from(atob(image.base64), character => character.charCodeAt(0));
  if (bytes.length > 5 * 1024 * 1024) throw new Error('El escudo es demasiado grande.');
  const { error } = await client.storage.from('club-crests').upload(`${clubId}/crest.png`, bytes.buffer, { contentType: 'image/png', upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const result = await client.rpc('set_club_crest', { p_club_id: clubId, p_has_crest: true });
  if (result.error) throw result.error;
  clubCrestCache.invalidate(`${clubId}/crest.png`);
}
export async function removeClubCrest(clubId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc('set_club_crest', { p_club_id: clubId, p_has_crest: false });
  if (error) throw error;
  const result = await client.storage.from('club-crests').remove([`${clubId}/crest.png`]);
  if (result.error) throw result.error;
  clubCrestCache.invalidate(`${clubId}/crest.png`);
}
export async function getClubCrestUrl(path: string) {
  const { data, error } = await requireSupabase().storage.from('club-crests').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export const clubCrestCache = createCrestCache(getClubCrestUrl);
