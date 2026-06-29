# Design System

Last updated: 2026-06-30

## Product Identity

The in-app product identity is `MONOPOLY` with the subtitle `Multiplayer Strategy Platform`.

Primary implementation:

- `client/src/components/common/BrandLogo.js`
- `client/public/brand-logo.png`
- `client/public/brand-mark.png`

The root `image.png` is the source logo asset. The app uses a cropped mark for compact navigation, favicons, apple touch icons, PWA icons, loading states, and empty states.

Design target:

- Premium
- Professional
- Focused
- Readable
- Fast
- Approachable
- Suitable for long multiplayer sessions

Avoid:

- Personal portfolio branding
- Casino-like visual treatment
- Childish styling
- Decorative clutter
- One-note dark blue/slate or purple-heavy palettes

## Current Implementation

Primary design-system implementation lives in:

- `client/src/theme.css`

Board-specific styling lives in:

- `client/src/components/game/board.css`

Most React components still use inline style objects, but the active redesign introduced shared classes and tokens to reduce one-off styling.

Branding guidance:

- Desktop logo mark: 30-36px where the product header has room.
- Mobile logo mark: 24-28px where the header is dense.
- Use 12-16px spacing between mark and wordmark.
- Let the logo breathe; avoid squeezing it into action-heavy control rows.
- Hide the subtitle on narrow control bars when needed, but keep the MONOPOLY wordmark visible where space allows.

## Tokens

### Color

Core tokens are OKLCH-based in `theme.css`:

- `--bg`
- `--bg-1`
- `--surface`
- `--surface-2`
- `--surface-3`
- `--surface-elevated`
- `--border`
- `--border-2`
- `--text`
- `--text-2`
- `--text-3`
- `--text-4`
- `--accent`
- `--accent-2`
- `--accent-soft`
- `--accent-strong`
- `--info`
- `--success`
- `--warning`
- `--danger`
- `--danger-soft`
- `--trade`
- `--trade-soft`
- `--auction`
- `--auction-soft`
- `--money`
- `--focus`

Property group colors intentionally remain aligned with board definitions:

- `--g-brown`
- `--g-lblue`
- `--g-pink`
- `--g-orange`
- `--g-red`
- `--g-yellow`
- `--g-green`
- `--g-dblue`

### Typography

Fonts:

- UI: `Inter`
- Numeric/code values: `JetBrains Mono`

Principles:

- Avoid viewport-scaled font sizes for UI text.
- Do not use negative letter spacing.
- Keep game-state text compact but readable.
- Use monospace for room codes, money-like tabular values, and ids.

### Spacing

Spacing tokens:

- `--space-1: 4px`
- `--space-2: 8px`
- `--space-3: 12px`
- `--space-4: 16px`
- `--space-5: 20px`
- `--space-6: 24px`
- `--space-8: 32px`
- `--space-10: 40px`

### Radius

Current radius tokens:

- `--radius-sm: 5px`
- `--radius: 7px`
- `--radius-lg: 8px`

Guideline: keep cards at 8px radius or below unless there is a strong component-specific reason.

### Elevation

Tokens:

- `--shadow`
- `--shadow-lg`
- `--shadow-glow`

Use elevation for meaningful stacking:

- base cards
- modals
- floating chat/trade buttons
- active player emphasis

### Motion

Tokens:

- `--duration-fast`
- `--duration`
- `--duration-slow`
- `--ease`
- `--ease-out`

Existing animation helpers:

- `.fade-in`
- `.slide-up`
- `.slide-in-right`

Reduced motion is supported globally through `prefers-reduced-motion`.

## Shared Classes

Page/layout:

- `.app-page`
- `.page-shell`
- `.page-shell.wide`
- `.topbar`
- `.brand-lockup`
- `.brand-logo`
- `.brand-logo-mark`
- `.brand-logo-copy`
- `.brand-logo-title`
- `.brand-logo-subtitle`
- `.brand-title`
- `.brand-subtitle`
- `.page-title`

Content primitives:

- `.card`
- `.chip`
- `.dot`
- `.section-title`
- `.muted`
- `.subtle`
- `.field`
- `.stack`
- `.cluster`
- `.divider`
- `.metric-grid`
- `.metric`
- `.metric-label`
- `.metric-value`
- `.empty-state`
- `.empty-state-title`
- `.empty-state-copy`
- `.status-line`
- `.lobby-presence-card`
- `.lobby-avatar-stack`
- `.lobby-avatar`

Controls:

- `.btn`
- `.btn.primary`
- `.btn.secondary`
- `.btn.soft`
- `.btn.success`
- `.btn.trade`
- `.btn.auction`
- `.btn.danger`
- `.btn.ghost`
- `.btn.icon`
- `.btn.sm`
- `.btn.lg`

Overlays:

- `.modal-backdrop`
- `.modal-panel`
- `.modal-header`
- `.modal-title`
- `.floating-button`

## Accessibility Rules

- Every non-obvious icon button needs an `aria-label` or title-backed visible context.
- Inputs without associated visible labels need `aria-label`.
- Do not rely on color alone; pair status with labels or icons where possible.
- Focus-visible styles must remain obvious.
- Touch targets should generally be 40px minimum.
- Motion should respect reduced-motion preferences.

## Open Design-System Work

- Convert more inline styles into reusable primitives.
- Continue moving lobby-specific inline layout details into reusable multiplayer presence primitives if similar patterns appear elsewhere.
- Replace native `window.confirm` dialogs with app modal variants.
- Add a formal modal footer/button layout pattern.
- Add loading skeleton primitives.
- Add responsive table/card alternatives for Map Builder.
- Explore a mobile board readability treatment that keeps the existing board renderer and full 40-tile information intact.
- Add accessible toast semantics.
- Decide whether OKLCH needs fallback colors for older browser support.
