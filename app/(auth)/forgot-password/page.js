'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
    setBusy(false); setDone(true);   // same message whether or not the email exists (avoids revealing accounts)
  }
  return (
    <AuthShell title="Reset your password">
      {done ? <p role="status">If an account exists for that email, a reset link is on its way.</p> : (
        <form className="m-form" onSubmit={submit}>
          <label className="m-field">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>)}
      <p className="m-muted"><Link className="m-link" href="/login">Back to log in</Link></p>
    </AuthShell>
  );
}
