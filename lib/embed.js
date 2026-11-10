// Strict allow-list for external music links. Anything else returns null (rendered as a plain link, or not at all).
export function isSafeHttpUrl(value) {
  try {
    const u = new URL(String(value).trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.');
  } catch { return false; }
}

const PATH_OK = /^[\w\-./%]+$/;

export function parseMusicLink(value) {
  let u;
  try { u = new URL(String(value).trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'open.spotify.com') {
    const i = parts[0]?.startsWith('intl-') ? 1 : 0;
    const [type, id] = [parts[i], parts[i + 1]];
    if (['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes(type) && /^[A-Za-z0-9]{10,30}$/.test(id || ''))
      return { provider: 'Spotify', embedUrl: `https://open.spotify.com/embed/${type}/${id}`, height: type === 'track' || type === 'episode' ? 152 : 352 };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? parts[0] : u.pathname === '/watch' ? u.searchParams.get('v') : null;
    if (/^[\w-]{11}$/.test(id || '')) return { provider: 'YouTube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, height: 315 };
  }
  if (host === 'soundcloud.com' && parts.length >= 1 && PATH_OK.test(u.pathname))
    return { provider: 'SoundCloud', embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${u.pathname}`)}`, height: 166 };
  if (host === 'music.apple.com' && parts.length >= 2 && PATH_OK.test(u.pathname))
    return { provider: 'Apple Music', embedUrl: `https://embed.music.apple.com${u.pathname}`, height: 175 };
  return null;
}
