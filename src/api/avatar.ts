// Profile pictures, stored in Supabase Storage (bucket "avatars", see supabase/avatars.sql).
// Pictures are cropped to a square and shrunk to 256×256 in the browser before uploading,
// so each one is only ~20–40 KB. The address of the picture is kept on the user's account.
import { supabase } from '../lib/supabase';

export const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB: the biggest picture you can pick
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_SIZE = 256; // pixels (width and height)

/** Returns a message if the file can't be used, or null if it's fine. */
export function checkAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG or WebP picture.';
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `That picture is ${mb} MB. Please choose one under 1 MB.`;
  }
  return null;
}

/** Crop the middle square of the picture and shrink it to 256×256 JPEG. */
async function shrinkToSquare(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file doesn't look like a picture we can read."));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, // the middle square
      0, 0, AVATAR_SIZE, AVATAR_SIZE,
    );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error("Couldn't prepare the picture. Please try another one.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const pathFor = (userId: string) => `${userId}/avatar.jpg`;

/** Shrinks, uploads and saves the picture on the account. Returns the picture's address. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const problem = checkAvatarFile(file);
  if (problem) throw new Error(problem);

  const blob = await shrinkToSquare(file);
  const path = pathFor(userId);
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // "?v=…" makes browsers fetch the new picture instead of showing the old one from memory.
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
  if (error) throw new Error(`Couldn't save the picture on your account: ${error.message}`);
  return url;
}

export async function removeAvatar(userId: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from('avatars').remove([pathFor(userId)]);
  if (removeError) throw new Error(`Couldn't remove the picture: ${removeError.message}`);
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
  if (error) throw new Error(`Couldn't update your account: ${error.message}`);
}
