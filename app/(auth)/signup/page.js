'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';
import GoogleButton from '@/components/GoogleButton';

export default function SignupPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', password: '', agree: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (f.name.trim().length < 2) return setErr('Please enter your name or artist name.');
    if (f.password.length < 8) return setErr('Use a password of at least 8 characters.');
    if (!f.agree) return setErr('Please accept the Terms and Privacy Policy to continue.');
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.name.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    if (data.session) { router.push('/onboarding'); router.refresh(); } else setSent(true);
  }
  if (sent) return (
    <AuthShell title="Check your email">
      <p>We’ve sent a confirmation link to <strong>{f.email}</strong>. Open it to finish creating your account.</p>
      <p className="m-muted">Nothing arrived? Check spam, or <Link className="m-link" href="/login">try logging in</Link>.</p>
    </AuthShell>
  );
  return (
    <AuthShell title="Create your account">
      <form className="m-form" onSubmit={submit}>
        <label className="m-field">Name or artist name<input autoComplete="name" required value={f.name} onChange={set('name')} maxLength={60} /></label>
        <label className="m-field">Email<input type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></label>
        <label className="m-field">Password (8+ characters)<input type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set('password')} /></label>
        <label className="m-check"><input type="checkbox" checked={f.agree} onChange={set('agree')} /> <span>I agree to the <Link className="m-link" href="/terms" target="_blank">Terms</Link> and <Link className="m-link" href="/privacy" target="_blank">Privacy Policy</Link></span></label>
        {err && <p role="alert" className="m-error">{err}</p>}
        <button className="m-btn m-btn--primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <GoogleButton label="Sign up with Google" />
        <p className="m-muted">Already have an account? <Link className="m-link" href="/login">Log in</Link></p>
      </form>
    </AuthShell>
  );
}
