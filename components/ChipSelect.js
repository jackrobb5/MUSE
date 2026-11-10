'use client';
export default function ChipSelect({ label, options, value, onChange, max }) {
  const toggle = (id) => {
    const has = value.includes(id);
    if (!has && max && value.length >= max) return;
    onChange(has ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <fieldset className="m-field">
      <legend>{label}</legend>
      <div className="m-chips">
        {options.map((o) => (
          <button type="button" key={o.id} className="m-chip" aria-pressed={value.includes(o.id)} onClick={() => toggle(o.id)}>{o.name}</button>
        ))}
      </div>
    </fieldset>
  );
}
