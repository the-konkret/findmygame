// How prices and dates are shown around the app.

export const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** A date-and-time as dd.mm.yyyy, in your own time zone. */
export function formatDay(when: string | Date): string {
  const d = new Date(when);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", then dd.mm.yyyy. */
export function timeAgo(when: string | Date): string {
  const minutes = Math.round((Date.now() - new Date(when).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return 'yesterday';
  return formatDay(when);
}
