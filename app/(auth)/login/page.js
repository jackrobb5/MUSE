'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';
import GoogleButton from '@/components/GoogleButton';
import { safeInternalPath } from '@/lib/format';

export default function LoginPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (new URLSearchParams(location.search).get('error') === 'link') setErr('That link has expired or was already used. Please try again.'); }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      return setErr(/confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox.' : 'Email or password is incorrect.');
    }
    router.push(safeInternalPath(new URLSearchParams(location.search).get('next') || '/'));
    router.refresh();
  }
  return (
    <AuthShell title="Log in">
      <form className="m-form" onSubmit={submit}>
        <label className="m-field">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="m-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p role="alert" className="m-error">{err}</p>}
        <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <GoogleButton />
        <p className="m-muted"><Link className="m-link" href="/forgot-password">Forgot your password?</Link> · <Link className="m-link" href="/signup">Create an account</Link></p>
      </form>
    </AuthShell>
  );
}
