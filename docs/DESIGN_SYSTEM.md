# MUSE design system (Step 2)

All values live in `app/tokens.css`. Never hard-code a colour, spacing or radius in a component; use a token.

## Colour
bg `#101014` · bg-2 `#181820` · card `#20202A` · border `#30303B` · accent `#9875FF` · accent-2 `#C5A5FF` · text `#FFFFFF` · muted `#A5A5B5`. Status colours: success, warning, danger. Text on accent buttons uses `--color-on-accent`. Contrast: white and muted text on the dark surfaces, and dark text on the accent, meet WCAG AA for normal text in this palette (re-check if you change values).

## Type
Inter (via `next/font`), scale `--text-xs` to `--text-2xl`, weights 400 to 800. Headings use tight leading; body 1.5.

## Spacing, shape, depth, motion
4px spacing scale (`--space-1` … `--space-16`), radii `sm` to `pill`, shadows `sm` / `md` / `lg` / `glow`, glass effect (`--glass-bg` + `--glass-blur`) on the mobile bars, transitions 160ms / 240ms.

## Components (class names)
- Layout: `m-page`, `m-card`, `m-grid`, `m-list`, `m-stack`, `m-row`, `m-actions`, `m-tabs`
- Controls: `m-btn` (`--primary`, `--ghost`), `m-chip`, `m-field`, `m-check`, `m-dialog`
- Feedback: `m-state` (loading / empty / error, via `<State>`), `m-error`, `m-notice`, `m-badge`, `m-spinner`
- Domain: `m-artist`, `m-collab`, `m-bubble`, `m-notif`, `m-score`

## Responsive rules
- Mobile (<768px): top bar + bottom navigation, single column, 44px minimum touch targets, messaging switches between list and thread, no horizontal overflow (wide tables scroll in their own container).
- Tablet/desktop: sticky sidebar, multi-column grids.

## Accessibility
Visible focus rings, labelled controls, `role="status"` / `role="alert"` on async states, `aria-current` on navigation, `aria-pressed` on toggles, native `<dialog>` for focus trapping, reduced-motion support.

## Style guide page
Run `npm run dev` and open `/design` to see every token and component (hidden in production).
