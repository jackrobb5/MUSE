'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { State } from '@/components/ui';
import { confetti } from '@/lib/confetti';
import { PROJECT_STATUS } from '@/lib/labels';

export default function ProjectsPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('active');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('projects').select('id,title,description,status,progress,created_at,project_members(count)').order('created_at', { ascending: false });
    if (error) setErr(error.message); else setRows(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!form.title.trim()) return setErr('Give your project a name.');
    setCreating(true);
    const { data: { user } } = await sb.auth.getUser();
    console.log("USER ID:", user.id);
console.log("AUTH SESSION:", (await sb.auth.getSession()).data.session?.user?.id);
    const { data, error } = await sb.from('projects').insert({ title: form.title.trim(), description: form.description.trim() || null, creator_id: user.id }).select('id').single();
    setCreating(false);
    if (error) return setErr(error.message);
    confetti();
    router.push(`/projects/${data.id}`);
  }

  const shown = rows?.filter((p) => (filter === 'active' ? !['completed', 'archived'].includes(p.status) : p.status === filter || filter === 'all'));
  return (
    <main className="m-page">
      <h1>My projects</h1>
      <form className="m-card m-form" onSubmit={create}>
        <h2>Start a project</h2>
        <div className="m-row">
          <label className="m-field">Project name<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} /></label>
          <label className="m-field">Description (optional)<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={4000} /></label>
          <button className="m-btn m-btn--primary" disabled={creating}>Create project</button>
        </div>
        {err && <p role="alert" className="m-error">{err}</p>}
      </form>
      <label className="m-field m-inline">Show
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="active">Active</option><option value="all">All</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <State loading={!rows && !err} empty={rows && shown.length === 0} emptyTitle="No projects here"
        emptyText="Accept a collaboration request and choose Start a project, or create one above.">
        <div className="m-grid">
          {shown?.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="m-card m-project">
              <h3>{p.title}</h3>
              <span className="m-chip">{PROJECT_STATUS[p.status]}</span>
              <progress value={p.progress} max="100" aria-label={`${p.progress}% complete`} />
              <p className="m-muted">{p.project_members?.[0]?.count ?? 1} member{(p.project_members?.[0]?.count ?? 1) === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      </State>
    </main>
  );
}
