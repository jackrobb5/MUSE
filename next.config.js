// Security headers. MERGE into your existing next.config.js (keep any options you already have).
const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : '*.supabase.co';
const dev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next's inline bootstrap scripts unless you adopt nonces (tighten later).
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://${supa}`,
  `media-src 'self' blob: https://${supa}`,
  `connect-src 'self' https://${supa} wss://${supa}`,
  // Only the four music providers we embed (see lib/embed.js). Add Stripe here when you build payments.
  'frame-src https://open.spotify.com https://www.youtube-nocookie.com https://w.soundcloud.com https://embed.music.apple.com',
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
module.exports = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ] }];
  },
};
