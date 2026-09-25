// Passwords: change it while logged in (Account page). Supabase does the work.
import { supabase } from '../lib/supabase';

export const MIN_PASSWORD = 8;

/** Checks the current password first (so someone at an unlocked computer can't change it), then sets the new one. */
export async function changePassword(email: string, current: string, next: string): Promise<void> {
  const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: current });
  if (wrong) throw new Error('Your current password is not right.');
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(error.message);
}

/** The same checks for every "new password" box. Returns a problem to show, or '' if it's fine. */
export function checkNewPassword(next: string, repeat: string): string {
  if (next.length < MIN_PASSWORD) return `The new password needs at least ${MIN_PASSWORD} characters.`;
  if (next !== repeat) return "The two new passwords don't match.";
  return '';
}
