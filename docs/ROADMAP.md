# Roadmap

Last updated: 2026-06-30

## Immediate

1. Let the user visually review logo replacement screenshots in `/private/tmp/monopoly-brand-screens`.
2. Let the user visually review the latest lobby presence pass in `/private/tmp/monopoly-design-lobby-pass`.
3. Address any requested visual changes.
4. Commit the frontend redesign, logo replacement, and documentation as logical commits only after review approval.

## Frontend Redesign Phase

1. Remove or gate the temporary `API_BASE` console log if production debugging is no longer needed.
2. Finalize README screenshot assets once the MONOPOLY branding is approved.
3. Expand the multiplayer presence language beyond Lobby if future flows need it:
   - current turn transitions
   - recent joins/leaves
   - spectator clarity
4. Replace native confirm dialogs with app modals:
   - reset board
   - discard unsaved changes
   - change template
   - delete map
5. Improve mobile game board readability without changing gameplay or board rendering responsibilities.
6. Add a responsive Map Builder fallback for narrow screens.
7. Add accessible toast semantics.

## Product UX Phase

1. Add clearer spectator user flow.
2. Improve onboarding for first-time guest players.
3. Add explicit empty/error states for failed backend connection.
4. Add trade jail-card controls to match backend capability.
5. Add rematch/new game flow after victory.
6. Add room privacy controls if public rooms remain enabled.

## Engineering Quality Phase

1. Add automated tests for:
   - room creation
   - room join/reconnect
   - host start
   - custom board create/use
   - trade validation
   - auction validation
   - bankruptcy validation
2. Add UI smoke tests for key routes.
3. Remove unused code/dependencies after verifying they are not planned soon:
   - `client/src/components/game/Chat.js`
   - `howler`
   - `@dnd-kit/*`
4. Consider migrating from Create React App to Vite.

## Production Phase

1. Add a license.
2. Add production frontend URL.
3. Add screenshots to README.
4. Replace deployment TODOs with real infrastructure values.
5. Add CI/CD.
6. Add observability:
   - request logging
   - socket event logging
   - room count metrics
   - error metrics
7. Add MongoDB backup/restore notes.
8. Add startup recovery from `GameRoom` snapshots if durable room restore is required.
