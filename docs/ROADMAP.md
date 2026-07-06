# Roadmap

This roadmap tracks high-value work for the open-source project after v1.0.

The goal is not to turn the game into a complicated economy simulator. The priority is to keep the current simple browser-first experience, while adding optional rules and tools that create more negotiation, planning, and player interaction.

Checked against the repository state on 2026-07-06.

## Reliability

- [ ] Add automated multiplayer integration tests for create, join, reconnect, spectator, auction, trade, bankruptcy, victory, and custom-rule flows.
- [ ] Persist active room recovery across backend restarts with a durable store.
- [ ] Add structured production logging and request tracing.
- [ ] Add graceful degradation messaging when MongoDB or Socket.IO connectivity is unavailable.
- [x] Add reconnect-safe turn recovery so disconnected players can return without freezing the room.
- [ ] Add optional bot replacement for disconnected players after a configurable timeout.

## Security

- [x] Move production session storage from `MemoryStore` to Redis or Mongo-backed storage.
- [x] Add CSRF protection for credentialed REST mutations.
- [ ] Add tighter production rate-limit tuning based on real traffic.
- [ ] Add dependency vulnerability triage and scheduled dependency updates.
- [ ] Add server-side validation for every custom rule, custom board value, and editor-created card effect.
- [ ] Add moderation controls for public rooms, including kick limits, host transfer, and abuse-safe player removal.

## Gameplay

- [ ] Add rule presets: Classic, Fast Game, Negotiation, Advanced Economy, and Custom.
- [x] Add optional house rules without changing default gameplay.
- [ ] Add a configurable speed-dice mode for shorter games.
- [ ] Add optional strategy cards that affect movement, rent, auctions, jail, or trades in limited and predictable ways.
- [ ] Add shares for completed color groups, allowing owners to sell limited rent participation to other players.
- [ ] Add bonds as player-to-player debt agreements with amount, interest, due turn, and default handling.
- [ ] Expand trade offers to support shares, bonds, mortgaged properties, and multi-party negotiation notes.
- [ ] Add team mode with shared victory conditions and limited internal transfers.
- [ ] Add short-game win conditions based on net worth, rent collected, or timed capital lead.
- [ ] Improve utility and railway/station strategy with configurable rent formulas and upgrade-free scaling.
- [ ] Add post-game summaries with final standings, net worth, rent collected, biggest trades, bankruptcies, and key turning points.
- [ ] Improve spectator tools for following active trades, auctions, turns, shares, bonds, and player net worth.

## Boards and Map Editor

- [ ] Expand custom board templates and validation helpers.
- [ ] Add advanced editor support for card decks, including text, money values, movement targets, jail effects, and delete/disable controls.
- [ ] Add editable rent tables for every property upgrade level.
- [ ] Add editable house and hotel prices per property group.
- [ ] Add editable station and utility rent formulas.
- [ ] Add custom special tiles such as wheel, tax, teleport, forced auction, bonus, penalty, and move-to-next-unowned.
- [ ] Add board balance warnings for extreme rent, price, card, or tile distributions.
- [ ] Add a board preview simulator that estimates game length, cash pressure, and high-risk tiles.
- [ ] Add import/export for custom boards as portable JSON.
- [ ] Add public custom-board discovery with “official,” “community,” and “experimental” labels.
- [ ] Add a warning before joining rooms that use non-default boards or advanced rules.

## Product Experience

- [x] Preserve the current guest-first flow with no forced account system.
- [ ] Add guided first-game onboarding.
- [ ] Add a clearer room creation flow with simple/advanced rule tabs.
- [ ] Improve keyboard navigation for board inspection and modal workflows.
- [ ] Add richer empty states for new installations without public rooms or maps.
- [ ] Add optional reduced-motion settings for long play sessions.
- [ ] Add stronger sound design for dice, movement, rent, auctions, trades, bankruptcy, and victory, with per-category volume controls.
- [ ] Add player inventory panels so opponents’ properties, cash, mortgages, shares, and bonds are easy to inspect without opening a trade.
- [ ] Add mobile-first turn action shortcuts for roll, buy, auction, build, mortgage, trade, and end turn.

## Bots and Solo Play

- [ ] Add basic AI bots for local testing and casual solo games.
- [ ] Add bot difficulty levels focused on simple buying, set completion, auctions, and trade decisions.
- [ ] Add bot takeover for disconnected players when the room allows it.
- [ ] Add seeded solo scenarios for testing bankruptcies, auctions, trades, shares, bonds, and custom boards.

## Competitive and Community

- [ ] Add room history with last games, winners, duration, and final standings.
- [ ] Add optional public profiles without requiring accounts for private guest games.
- [ ] Add lightweight karma/reputation for public-room behavior.
- [ ] Add anti-griefing rules for suspicious trades, intentional asset dumping, and repeated kick abuse.
- [ ] Add tournament mode later, after timed win conditions and spectator tools are stable.

## Developer Experience

- [x] Add lint and formatting scripts for both client and server.
- [ ] Add a root-level workspace script for installing, building, and running both packages.
- [ ] Add seeded local fixtures for boards, rooms, sample custom maps, and advanced-rule scenarios.
- [ ] Add CI for install, build, tests, and security checks.
- [ ] Add Storybook or isolated UI previews for game modals, board tiles, editor forms, and player panels.
- [ ] Add deterministic game-engine tests using seeded dice and scripted player actions.
- [ ] Add contributor docs for implementing new rule modules without touching unrelated engine code.
