import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/terms', '/privacy', '/welcome', '/design'];

// Refreshes the session cookie on every request and redirects signed-out visitors to /login.
// (Next 16 renames this file convention to proxy.js; if your Next version warns, rename the file and the export.)
export async function middleware(request) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.search = '';
    if (path === '/') url.pathname = '/welcome';          // signed-out visitors see the landing page
    else { url.pathname = '/login'; url.searchParams.set('next', path); }
    return NextResponse.redirect(url);
  }
  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/'; url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'] };
