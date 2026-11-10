'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase/client';
let cache;
export function useTaxonomy() {
  const [t, setT] = useState(cache || { roles: [], genres: [], loading: true, error: '' });
  useEffect(() => {
    if (cache) return;
    const sb = supabaseBrowser();
    Promise.all([sb.from('musical_roles').select('id,name').order('name'), sb.from('genres').select('id,name').order('name')]).then(([r, g]) => {
      const error = r.error?.message || g.error?.message || '';
      const next = { roles: r.data || [], genres: g.data || [], loading: false, error };
      if (!error) cache = next;
      setT(next);
    });
  }, []);
  return t;
}
