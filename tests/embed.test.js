import { describe, it, expect } from 'vitest';
import { parseMusicLink, isSafeHttpUrl } from '../lib/embed.js';

describe('parseMusicLink', () => {
  it('embeds Spotify tracks and playlists', () => {
    expect(parseMusicLink('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc').embedUrl).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(parseMusicLink('https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M').height).toBe(352);
  });
  it('embeds YouTube (watch and short links) via the no-cookie domain', () => {
    expect(parseMusicLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(parseMusicLink('https://youtu.be/dQw4w9WgXcQ').provider).toBe('YouTube');
  });
  it('embeds SoundCloud and Apple Music', () => {
    expect(parseMusicLink('https://soundcloud.com/artist/track').embedUrl).toContain('https://w.soundcloud.com/player/?url=');
    expect(parseMusicLink('https://music.apple.com/gb/album/some-album/12345').embedUrl).toBe('https://embed.music.apple.com/gb/album/some-album/12345');
  });
  it('rejects unsafe or unknown links', () => {
    expect(parseMusicLink('javascript:alert(1)')).toBeNull();
    expect(parseMusicLink('http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(parseMusicLink('https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC')).toBeNull();
    expect(parseMusicLink('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseMusicLink('not a url')).toBeNull();
  });
});

describe('isSafeHttpUrl', () => {
  it('only allows http(s) URLs', () => {
    expect(isSafeHttpUrl('https://example.com/x')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
  });
});
