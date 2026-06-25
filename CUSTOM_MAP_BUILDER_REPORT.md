# Custom Map Builder Report

## Architecture Changes

The board editor was expanded into a first-class custom map workflow without changing the game engine, socket handlers, auctions, trades, mortgages, board rendering, or built-in board definitions.

The new flow keeps the same 40-tile board contract that `server/game/engine.js` expects. Custom boards still persist as `CustomBoard` documents, but room creation now treats a non-built-in `boardId` as a custom board id. This makes saved custom maps work from the existing Home board dropdown without requiring `customBoardId`.

Custom board group sizes are computed at room creation if a custom board document does not store them. This preserves full-set ownership and building rules without changing engine logic.

## Files Modified

| File | Change |
|---|---|
| `server/game/boards.js` | Strengthened custom board validation for legal 40-tile engine-compatible maps. Built-ins remain unchanged. |
| `server/game/state.js` | Computes `groupSizes` for custom boards before room state is created. |
| `server/routes/rooms.js` | Added board ownership APIs, custom-board visibility checks, built-in read-only protection, duplicate/delete/update support, and custom-board loading by `boardId`. |
| `client/src/api.js` | Added client API helpers for My Maps, update, delete, and duplicate. |
| `client/src/App.js` | Added `/maps` and `/editor/:boardId` routes. |
| `client/src/components/home/Home.js` | Added My Maps navigation and custom map optgroup in the board dropdown. |
| `client/src/components/editor/MapEditor.js` | Replaced remix-only editor with full custom map builder. |
| `client/src/components/editor/MyMaps.js` | Added My Maps management page. |
| `CUSTOM_MAP_BUILDER_REPORT.md` | Added this report. |

## New APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/boards` | Now returns `builtin`, `mine`, and `community` board lists. |
| `GET` | `/api/boards/my` | Lists boards owned by the current browser identity. Supports optional `q`. |
| `GET` | `/api/boards/:id` | Loads built-in boards, public custom boards, or private custom boards owned by the caller. |
| `POST` | `/api/boards` | Creates or updates an owned custom board. Built-in ids are rejected. |
| `PATCH` | `/api/boards/:id` | Renames, publishes/unpublishes, updates description, or updates board content for owned custom boards. |
| `DELETE` | `/api/boards/:id` | Deletes an owned custom board. Built-ins are rejected. |
| `POST` | `/api/boards/:id/duplicate` | Duplicates a visible board into a new private custom board. |
| `POST` | `/api/rooms` | Existing endpoint now also loads custom boards when `boardId` is not built-in. |

## Database Changes

No MongoDB schema migration was required. The existing `CustomBoard` model is reused.

Behavioral changes:

- Private and public custom boards are both listed under `mine` for their owner.
- Public custom boards owned by other users are listed under `community`.
- Built-in board ids cannot be overwritten through save/update/delete APIs.
- `timesPlayed` increments when a custom board is used to create a room.
- `groupSizes` are computed in memory for custom boards when creating a room.

## UI Changes

- Home now includes a `My maps` button.
- Home board dropdown now includes:
  - Built-in boards
  - My Maps
  - Community maps
- Map editor is now a Custom Map Builder.
- Added New Map modal with:
  - Map Name
  - Description
  - Private/Public visibility
  - Blank, Classic USA, World Tour, and World Capitals templates
- Blank maps generate a legal 40-tile board compatible with the existing engine.
- Editor now supports:
  - Property names, groups, prices, house costs, and six rent levels
  - Station names and prices
  - Utility names and prices
  - Tax names and amounts
  - GO, Jail, Free Parking, Go To Jail, Chance, and Community Chest names
- Added editor UX:
  - Unsaved changes warning
  - Autosaved draft
  - Restore/discard draft
  - Validation errors
  - Success toasts
  - Loading and saving states
  - Duplicate/paste tile
  - Reset tile
  - Reset board
- Added My Maps page with:
  - Search
  - Duplicate
  - Rename
  - Delete
  - Edit
  - Publish
  - Unpublish

## Migration Notes

- Existing built-in boards continue to resolve from `BUILTIN_BOARDS`.
- Existing room creation with built-in `boardId` continues to work.
- Existing custom board documents remain compatible.
- Custom boards that were previously listed but could not start a game now work through the normal `boardId` path.
- No engine, socket, auction, trade, mortgage, or board renderer migration is needed.

## Verification

Ran:

```bash
./node_modules/.bin/eslint src/components/editor/MapEditor.js src/components/editor/MyMaps.js src/components/home/Home.js src/App.js src/api.js
node -c server/routes/rooms.js && node -c server/game/boards.js && node -c server/game/state.js
node -e "const {BUILTIN_BOARDS,validateBoard}=require('./server/game/boards'); if (!validateBoard(null).length) process.exit(1); for (const [id,b] of Object.entries(BUILTIN_BOARDS)) { const e=validateBoard(b); if (e.length) { console.error(id,e); process.exit(1); } } console.log('board validation ok');"
```

All checks passed.

## Future Improvements

- Add server-side pagination for large community map lists.
- Add map preview thumbnails.
- Add collaborative editing or map import/export.
- Add richer validation for balance warnings, such as too many high-rent tiles in one group.
- Add ownership transfer or sharing controls.
- Add automated API tests for custom board create/update/delete/use-in-room flows.
