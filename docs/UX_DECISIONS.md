# UX Decisions

Last updated: 2026-06-29

## Decision Log

### Product Identity

Use `MONOPOLY` plus the subtitle `Multiplayer Strategy Platform` for product-facing UI and public metadata.

Reason:

- The user provided a new logo asset and requested it replace the old dice logo everywhere.
- It removes personal maintainer branding from the app experience.
- It makes the product feel like a platform rather than a personal project.
- It still preserves repository ownership documentation elsewhere.

Implementation notes:

- The compact MONOPOLY mark is used in dense game chrome, loading states, empty states, favicons, and app icons.
- The full wordmark lockup is used on Home, Lobby, and other page-level headers where space permits.
- On mobile lobby, the header wraps the logo onto its own row so room controls do not clip the wordmark.

### Redesign Strategy

Use an incremental visual and interaction-system pass instead of rewriting screens.

Reason:

- Existing gameplay and socket interactions must be preserved.
- Most stateful behavior is already wired through `useRoom`, `api`, and `socket`.
- Replacing components wholesale would risk multiplayer regressions.

### Design Direction

Use a restrained dark strategy-platform interface with readable surfaces, compact controls, visible status, and strong interaction feedback.

Reason:

- Long play sessions benefit from reduced glare and strong hierarchy.
- Multiplayer board games need clear turn, host, identity, and decision states.
- The UI should feel commercial rather than decorative.

### Home

Home now prioritizes:

- product identity
- guest session state
- board count
- player name/color
- board selector
- create room
- join room
- public rooms
- map workspace

Reason:

- The first screen should be the usable experience, not a marketing landing page.
- Existing create/join/map flows remain visible.

### Lobby

Lobby now adds a top status card with:

- connection status
- role
- player count
- selected board

Reason:

- Host/non-host confusion has been a recurring product risk.
- The lobby must make role and readiness obvious before start.

### Game Shell

Desktop game layout remains:

- left player rail
- center board
- right action log
- floating trade/chat controls

Mobile game layout remains:

- compact header
- horizontal player strip
- board
- floating chat/log/trade controls

Reason:

- Existing layout preserves gameplay affordances.
- Improvements are focused on hierarchy, container rhythm, and readability.

### Modals

Property, auction, trade, card, and victory surfaces now use shared modal primitives.

Reason:

- Decision-heavy flows need consistent framing.
- Shared modal primitives improve future maintainability.

### Map Builder

Map Builder remains a table-oriented power-user editor.

Reason:

- It exposes dense structured data across all 40 tiles.
- Replacing it with a visual builder would be a separate feature risk.

### My Maps

My Maps remains a management list with inline rename and action buttons.

Reason:

- Existing functionality is complete and should not be hidden.
- The redesign makes actions wrap responsively instead of removing them.

## Current UX Gaps

- Map Builder is still dense and may need a responsive card editor for mobile.
- Native confirms in Map Builder/My Maps do not match the modal system.
- Spectator entry exists server-side but is not clearly exposed as a user flow.
- Game onboarding remains minimal.
- Trade UI still does not expose jail-card selection despite backend support.
- Action feedback is improved visually but not yet audited with screen readers.
- Mobile game board rendering is functional at 390px with no horizontal overflow, but readability is dense because the full 40-tile board is preserved in one viewport.

### Visual QA Workflow

Use browser automation before committing UI work.

Reason:

- Static build success did not catch the no-payload socket emit regression that blocked Start Game.
- Screenshots confirmed layout, modal stacking, responsive states, and console health across the major flows.
- When the integrated browser connector is unavailable, a headless Chrome/CDP fallback is acceptable for local visual evidence.
- For logo replacement QA, screenshots were captured in `/private/tmp/monopoly-brand-screens` and every screen reported no old dice-brand nodes.
