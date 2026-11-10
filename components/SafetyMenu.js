'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { REPORT_REASONS } from '@/lib/labels';

// Report a profile/listing and (optionally) block a user.
export default function SafetyMenu({ targetType, targetId, blockUserId }) {
  const sb = supabaseBrowser();
  const [blocked, setBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!blockUserId) return;
    sb.from('blocks').select('blocked_id').eq('blocked_id', blockUserId).maybeSingle().then(({ data }) => setBlocked(!!data));
  }, [blockUserId]);

  async function toggleBlock() {
    const { data: { user } } = await sb.auth.getUser();
    const { error } = blocked
      ? await sb.from('blocks').delete().match({ blocker_id: user.id, blocked_id: blockUserId })
      : await sb.from('blocks').insert({ blocker_id: user.id, blocked_id: blockUserId });
    if (error) return setMsg(error.message);
    setBlocked(!blocked);
    setMsg(blocked ? 'User unblocked.' : 'User blocked. They can no longer message you or send requests.');
  }
  async function report(e) {
    e.preventDefault();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('reports').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details: details.trim() || null });
    if (error) return setMsg(error.message);
    setOpen(false); setDetails(''); setMsg('Thanks — your report was sent to our moderators.');
  }
  return (
    <div className="m-safety">
      <details className="m-menu">
        <summary className="m-btn m-btn--ghost" aria-label="More actions">⋯</summary>
        <div className="m-menu__panel">
          <button className="m-btn m-btn--ghost" onClick={() => setOpen(true)}>Report</button>
          {blockUserId && <button className="m-btn m-btn--ghost" onClick={toggleBlock}>{blocked ? 'Unblock' : 'Block'}</button>}
        </div>
      </details>
      {open && (
        <form className="m-card m-form" onSubmit={report}>
          <label className="m-field">Reason<select value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(REPORT_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="m-field">Details (optional)<textarea maxLength={2000} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
          <div className="m-actions"><button type="button" className="m-btn m-btn--ghost" onClick={() => setOpen(false)}>Cancel</button><button className="m-btn m-btn--primary">Send report</button></div>
        </form>
      )}
      {msg && <p role="status" className="m-muted">{msg}</p>}
    </div>
  );
}
