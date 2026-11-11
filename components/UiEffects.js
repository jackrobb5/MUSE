'use client';
import { useEffect } from 'react';

// Pointer-driven glow: a soft light follows the cursor across the page, and cards light up under it.
export default function UiEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty('--px', `${e.clientX}px`);
        root.style.setProperty('--py', `${e.clientY}px`);
        const card = e.target instanceof Element ? e.target.closest('.m-card') : null;
        if (card) {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - r.left}px`);
          card.style.setProperty('--my', `${e.clientY - r.top}px`);
        }
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
