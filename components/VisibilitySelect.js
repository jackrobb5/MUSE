'use client';
import { VISIBILITY } from '@/lib/visibility';

export default function VisibilitySelect({ value, onChange, label = 'Who can see this?' }) {
  return (
    <label className="m-field">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(VISIBILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}
