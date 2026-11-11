// Small celebratory burst (accepted request, new project, finished onboarding). Skipped for reduced-motion users.
export function confetti() {
  if (typeof document === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#9875FF', '#C5A5FF', '#ff9be6', '#5b8cff', '#8de0a5', '#ffd479'];
  const wrap = document.createElement('div');
  wrap.className = 'm-confetti';
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('i');
    s.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--dx:${(Math.random() - 0.5) * 240}px;--rot:${Math.random() * 720}deg;` +
      `animation-delay:${Math.random() * 0.25}s;animation-duration:${1.2 + Math.random() * 0.9}s;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2800);
}
