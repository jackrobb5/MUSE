'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';

export default function ResetPassword() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [ready, setReady] = useState(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { sb.auth.getUser().then(({ data }) => setReady(!!data.user)); }, []);
  async function submit(e) {
    e.preventDefault(); setErr('');
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    router.push('/'); router.refresh();
  }
  if (ready === false) return <AuthShell title="Link expired"><p>This reset link is no longer valid.</p><Link className="m-link" href="/forgot-password">Request a new one</Link></AuthShell>;
  return (
    <AuthShell title="Choose a new password">
      <form className="m-form" onSubmit={submit}>
        <label className="m-field">New password<input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {err && <p role="alert" className="m-error">{err}</p>}
        <button className="m-btn m-btn--primary" disabled={ready === null}>Update password</button>
      </form>
    </AuthShell>
  );
}
