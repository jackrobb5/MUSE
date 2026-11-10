'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

// Works only after you enable the Google provider in Supabase (see SETUP.md).
export default function GoogleButton({ label = 'Continue with Google' }) {
  const [err, setErr] = useState('');
  async function go() {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=/` } });
    if (error) setErr('Google sign-in isn’t available right now.');
  }
  return (<><button type="button" className="m-btn" onClick={go}>{label}</button>{err && <p role="alert" className="m-error">{err}</p>}</>);
}
