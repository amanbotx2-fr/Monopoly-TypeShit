# TODO

Last updated: 2026-06-29

## Critical Next Tasks

- [x] Replace the old product dice logo with the new MONOPOLY branding.
- [x] Refresh favicon, apple touch icon, and PWA icon assets with the new mark.
- [x] Verify no old dice logo remains in `client/src` or `client/public`.
- [x] Re-run `npm run build` in `client/` after documentation is added.
- [x] Start backend locally with approved permissions.
- [x] Start frontend locally with approved permissions.
- [x] Run HTTP smoke checks for frontend shell and backend REST.
- [x] Run direct Socket.IO smoke check for host join without duplicate player.
- [x] Browser-verify Home.
- [x] Browser-verify Lobby.
- [x] Browser-verify Game.
- [x] Browser-verify Property modal.
- [x] Browser-verify Auction modal.
- [x] Browser-verify Trade modal.
- [x] Browser-verify Chat.
- [x] Browser-verify Map Builder.
- [x] Browser-verify My Maps.
- [x] Browser-verify mobile Home.
- [x] Browser-verify mobile Lobby.
- [x] Browser-verify mobile Game.
- [x] Fix visual/runtime regressions found in browser verification.

## Active Redesign Cleanup

- [ ] Decide whether to remove `console.log("API_BASE =", API_BASE)` from `client/src/config.js`.
- [x] Check `PlayerStrip.js` formatting around token text color.
- [ ] Review OKLCH/color-mix browser support for the target deployment.
- [ ] Replace native `window.confirm` dialogs with app modal patterns.
- [ ] Add accessible toast roles/announcements.
- [ ] Consider labels for remaining editor table inputs.
- [ ] Verify mobile layout of Map Builder table.
- [ ] Improve mobile game board readability without rewriting the board renderer.
- [ ] Review logo replacement screenshot set in `/private/tmp/monopoly-brand-screens` before committing.

## Documentation TODOs

- [ ] Add production frontend URL to `README.md`.
- [ ] Add screenshots to `README.md`.
- [ ] Add license file.
- [ ] Replace deployment TODO placeholders when production infrastructure is known.
- [ ] Update `REPORT.md` or mark it as historical/stale where it conflicts with current backend code.

## Known Existing Warnings

- [ ] `client/src/components/game/AuctionModal.js` React hook dependency warning.
- [ ] `client/src/sound.js` unused `chord` helper warning.

## Known Unused / Possibly Removable Later

- [ ] `client/src/components/game/Chat.js`
- [ ] `howler`
- [ ] `@dnd-kit/core`
- [ ] `@dnd-kit/utilities`

## Do Not Break

- [ ] Create room
- [ ] Join room
- [ ] Lobby host controls
- [ ] Rule editing
- [ ] Multiplayer sockets
- [ ] Board rendering
- [ ] Dice rolling
- [ ] Property buying
- [ ] Rent
- [ ] Auctions
- [ ] Trades
- [ ] Mortgages
- [ ] Building/selling houses
- [ ] Jail mechanics
- [ ] Bankruptcy
- [ ] Chat
- [ ] Spectators
- [ ] Sound
- [ ] Victory flow
- [ ] Map Builder
- [ ] My Maps
- [ ] Built-in boards
- [ ] Custom boards
