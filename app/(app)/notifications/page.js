'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { State } from '@/components/ui';
import { safeInternalPath, timeAgo } from '@/lib/format';

export default function NotificationsPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [items, setItems] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [prefs, setPrefs] = useState({ requests: true, messages: true, projects: true });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await sb.from('notifications').select('id,type,content,link,read_at,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) setErr(error.message); else setItems(data);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      setMe(user.id);
      load();
      const { data } = await sb.from('notification_prefs').select('requests,messages,projects').eq('user_id', user.id).maybeSingle();
      if (data) setPrefs(data);
    })();
  }, [load]);

  useEffect(() => {
    if (!me) return;
    const ch = sb.channel('notif-page').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
      (p) => setItems((i) => [p.new, ...(i || [])])).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [me]);

  async function open(n) {
    if (!n.read_at) {
      await sb.rpc('mark_notifications_read', { p_ids: [n.id] });
      setItems((i) => i.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.link) router.push(safeInternalPath(n.link));
  }
  async function markAll() {
    const { error } = await sb.rpc('mark_notifications_read', { p_ids: null });
    if (error) return setErr(error.message);
    setItems((i) => i.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
  }
  async function togglePref(k) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    const { error } = await sb.from('notification_prefs').upsert({ user_id: me, ...next });
    if (error) { setErr(error.message); setPrefs(prefs); }
  }

  const shown = items?.filter((n) => !unreadOnly || !n.read_at);
  return (
    <main className="m-page">
      <header className="m-pagehead">
        <h1>Notifications</h1>
        <div className="m-actions">
          <label className="m-check"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only</label>
          <button className="m-btn m-btn--ghost" onClick={markAll}>Mark all as read</button>
        </div>
      </header>
      <State loading={!items && !err} error={!items ? err : ''} empty={items && shown.length === 0} emptyTitle="You’re all caught up"
        emptyText="You’ll be notified about collaboration requests, messages and project updates.">
        <ul className="m-plain">
          {shown?.map((n) => (
            <li key={n.id}><button className={`m-notif${n.read_at ? '' : ' is-unread'}`} onClick={() => open(n)}>
              <span>{n.content}</span><span className="m-muted">{timeAgo(n.created_at)}</span></button></li>
          ))}
        </ul>
      </State>
      <section className="m-card" aria-labelledby="np">
        <h2 id="np">Notification preferences</h2>
        <p className="m-muted">In-app only for now. Email and push notifications are not built yet.</p>
        {[['requests', 'Collaboration requests and responses'], ['messages', 'New messages'], ['projects', 'Project invitations and updates']].map(([k, label]) => (
          <label className="m-check" key={k}><input type="checkbox" checked={prefs[k]} onChange={() => togglePref(k)} /> {label}</label>
        ))}
      </section>
    </main>
  );
}
