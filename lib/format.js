const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function timeAgo(iso) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  for (const [unit, n] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  return 'just now';
}
export const initials = (name = '?') => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const safeInternalPath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/');
export const stripFilterChars = (s) => s.replace(/[,()%*\\]/g, ' ').trim();   // for PostgREST .or() filters
