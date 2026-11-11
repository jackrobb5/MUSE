'use client';
import { useTaxonomy } from '@/lib/useTaxonomy';
import { CREATIVE_ROLES, PROJECT_ROLES } from '@/lib/projectRoles';

// Drop-down only: people can't type a role, they pick one.
export default function ProjectRoleSelect({ value, onChange, label = 'Their role' }) {
  const { roles } = useTaxonomy();
  const music = roles.map((r) => r.name);
  const known = [...PROJECT_ROLES, ...music, ...CREATIVE_ROLES];
  return (
    <label className="m-field">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {value && !known.includes(value) && <option value={value}>{value}</option>}
        <optgroup label="Project roles">{PROJECT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
        <optgroup label="Music roles">{music.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
        <optgroup label="Creative roles">{CREATIVE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</optgroup>
      </select>
    </label>
  );
}
