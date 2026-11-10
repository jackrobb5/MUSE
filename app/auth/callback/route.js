import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Landing point for email-confirmation links, password-reset links and Google sign-in.
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safe, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
