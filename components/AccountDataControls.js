'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

// Put this on your Settings page: GDPR / UK GDPR access (export) and erasure (delete account).
export default function AccountDataControls() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function del() {
    setBusy(true); setErr('');
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmText }) });
    if (!res.ok) { setBusy(false); return setErr((await res.json().catch(() => ({}))).error || 'Couldn’t delete your account. Try again.'); }
    await supabaseBrowser().auth.signOut();
    router.push('/');
  }
  return (
    <section className="m-card" aria-labelledby="acct">
      <h2 id="acct">Your data</h2>
      <p>Download a copy of the data MUSE holds about you.</p>
      <a className="m-btn m-btn--ghost" href="/api/account/export" download>Download my data (JSON)</a>
      <h3>Delete account</h3>
      <p className="m-muted">This permanently deletes your profile, listings, messages you sent, and projects you own. Collaborators on your projects lose access. It can’t be undone.</p>
      <label className="m-field">Type DELETE to confirm<input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></label>
      {err && <p role="alert" className="m-error">{err}</p>}
      <button className="m-btn m-btn--primary" disabled={confirmText !== 'DELETE' || busy} onClick={del}>{busy ? 'Deleting…' : 'Delete my account'}</button>
    </section>
  );
}
