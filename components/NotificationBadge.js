'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

// Drop next to the Notifications link in your sidebar / bottom nav.
export default function NotificationBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sb = supabaseBrowser();
    let ch; let live = true;
    const refresh = async () => {
      const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      if (live) setN(count || 0);
    };
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
          if (!user || !live) return;
      refresh();
      ch = sb.channel(`notif-badge-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, refresh).subscribe();
    })();
    return () => { live = false; if (ch) sb.removeChannel(ch); };
  }, []);
  if (!n) return null;
  return <span className="m-badge" aria-label={`${n} unread notifications`}>{n > 99 ? '99+' : n}</span>;
}
