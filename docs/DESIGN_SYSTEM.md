# Design System

MONOPOLY uses a dark-first interface designed for long multiplayer sessions.
The system prioritizes dense information, clear hierarchy, and restrained game
energy over decorative casino-style visuals.

## Principles

- **Readable at speed.** Players should be able to identify turn state, cash,
  ownership, auctions, trades, and chat activity without scanning the entire UI.
- **Presence is visible.** Lobbies and games surface host, connected players,
  spectators, and current turn state as first-class information.
- **Controls stay familiar.** Buttons, tabs, inputs, chips, modals, and drawers
  follow predictable web application patterns.
- **Game state has semantic color.** Auction, trade, success, warning, danger,
  and property-group colors each carry a specific meaning.
- **No decorative noise.** The product avoids generic gradients, neon gaming
  effects, oversized cards, and legacy novelty branding.

## Tokens

Core tokens live in [`client/src/theme.css`](../client/src/theme.css). They
define:

- Background, surface, border, and text colors.
- Accent, success, warning, danger, trade, auction, money, and focus colors.
- Property group colors that match the board schema.
- Radius, shadow, typography, spacing, timing, and easing values.

## Color Roles

| Role | Usage |
| --- | --- |
| Background | Full application shell and viewport base. |
| Surface | Panels, cards, modals, drawers, and repeated list items. |
| Accent | Primary actions, focus states, selected controls, and progress emphasis. |
| Success | Completed actions, ready states, and positive game outcomes. |
| Warning | Time-sensitive or cautionary states. |
| Danger | Destructive actions and invalid states. |
| Trade | Trade proposals, trade controls, and negotiation states. |
| Auction | Auction controls, bid emphasis, and auction modal highlights. |
| Money | Cash values and balance changes. |

## Typography

The application uses Inter for interface text and JetBrains Mono for numeric
or tabular game data. Headings are compact and functional; large display type is
reserved for major empty states and first-viewport branding.

## Components

Shared visual patterns are implemented through CSS classes and React
components:

- `BrandLogo` for application identity.
- `.btn` variants for action hierarchy.
- `.chip`, `.metric`, `.metric-grid` for compact status data.
- `.modal-backdrop` and `.modal-panel` for dialogs.
- `.drawer` and game panels for secondary workflows.
- Board, token, tile, auction, trade, chat, lobby, and map-builder components.

## Responsive Behavior

Desktop prioritizes the board plus side panels. Mobile collapses into stacked
views with bottom-friendly actions, compact typography, and stable board sizing.
Fixed-format elements use constrained dimensions so hover states, chips, labels,
and buttons do not shift layout.

## Accessibility

The current UI includes visible focus rings, semantic form controls, reduced
visual clutter, and sufficient contrast across primary interaction states. Future
work should add deeper keyboard coverage for game actions and formal screen
reader testing for board navigation.
