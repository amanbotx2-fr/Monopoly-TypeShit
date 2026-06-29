# Roadmap

This roadmap tracks high-value work for the open-source project after v1.0.
Items are intentionally scoped so contributors can pick up meaningful pieces
without needing to rewrite the game engine.

## Reliability

- Add automated multiplayer integration tests for create, join, reconnect,
  spectator, auction, trade, bankruptcy, and victory flows.
- Persist active room recovery across backend restarts with a durable store.
- Add structured production logging and request tracing.
- Add graceful degradation messaging when MongoDB or Socket.IO connectivity is
  unavailable.

## Security

- Move production session storage from `MemoryStore` to Redis or Mongo-backed
  storage.
- Add CSRF protection for credentialed REST mutations.
- Add tighter production rate-limit tuning based on real traffic.
- Add dependency vulnerability triage and scheduled dependency updates.

## Gameplay

- Expand custom board templates and validation helpers.
- Add optional house rules without changing default gameplay.
- Add post-game summaries with final standings and key transactions.
- Improve spectator tools for following active trades, auctions, and turns.

## Product Experience

- Add guided first-game onboarding.
- Improve keyboard navigation for board inspection and modal workflows.
- Add richer empty states for new installations without public rooms or maps.
- Add optional reduced-motion settings for long play sessions.

## Developer Experience

- Add lint and formatting scripts for both client and server.
- Add a root-level workspace script for installing, building, and running both
  packages.
- Add seeded local fixtures for boards, rooms, and sample custom maps.
- Add CI for install, build, tests, and security checks.
