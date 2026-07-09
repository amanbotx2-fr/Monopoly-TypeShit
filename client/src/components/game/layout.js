// Board geometry — single source of truth for CSS Grid + token positioning.
// All position logic is derived from the tiles array so custom maps just work.
//
// Grid layout (matches board.css grid-template-areas):
//   "go         top      jail"
//   "left       center   right"
//   "gotoprison bottom   parking"
//
// Corner tiles are identified by type ('go','jail','parking','gotojail').
// Side tiles are everything between corners.

export const CORNER_PCT = 13;

// ─── Board analysis (call once per room) ─────────────────────────────────────
export function analyzeBoard(tiles) {
	if (!Array.isArray(tiles) || tiles.length === 0) return null;

	const byType = {};
	const byPos = {};
	for (const t of tiles) {
		byPos[t.pos] = t;
		byType[t.type] = t;
	}

	const go = byType.go;
	const jail = byType.jail;
	const parking = byType.parking;
	const gotojail = byType.gotojail;

	if (!go || !jail || !parking || !gotojail) return null;

	const goPos = go.pos;
	const jailPos = jail.pos;
	const parkingPos = parking.pos;
	const gotoprisonPos = gotojail.pos;
	const sideCount = jailPos - goPos - 1; // tiles per side

	return {
		tiles,
		byPos,
		goPos,
		jailPos,
		parkingPos,
		gotoprisonPos,
		sideCount,
		sidePct: (100 - 2 * CORNER_PCT) / sideCount,
	};
}

// ─── Side of board ──────────────────────────────────────────────────────────
export function tileSide(pos, board) {
	if (!board) return 'corner';
	if (pos === board.goPos) return 'corner';
	if (pos === board.jailPos) return 'corner';
	if (pos === board.parkingPos) return 'corner';
	if (pos === board.gotoprisonPos) return 'corner';
	if (pos > board.goPos && pos < board.jailPos) return 'top';
	if (pos > board.jailPos && pos < board.parkingPos) return 'right';
	if (pos > board.parkingPos && pos < board.gotoprisonPos) return 'bottom';
	return 'left';
}

// ─── Grid area name (only corners get a grid area; sides return null) ────────
export function gridArea(pos, board) {
	if (!board) return null;
	if (pos === board.goPos) return 'go';
	if (pos === board.jailPos) return 'jail';
	if (pos === board.parkingPos) return 'parking';
	if (pos === board.gotoprisonPos) return 'gotoprison';
	return null; // side tiles don't need a grid area — they live in flex containers
}

// ─── Tile rectangle (percentages) for overlay effects ───────────────────────
export function tileRect(pos, board) {
	if (!board) return { left: 0, top: 0, width: 0, height: 0, side: 'corner' };

	const C = CORNER_PCT;
	const S = board.sidePct;
	const side = tileSide(pos, board);

	if (pos === board.goPos)          return { left: 0, top: 0, width: C, height: C, side };
	if (pos === board.jailPos)        return { left: 100 - C, top: 0, width: C, height: C, side };
	if (pos === board.parkingPos)     return { left: 100 - C, top: 100 - C, width: C, height: C, side };
	if (pos === board.gotoprisonPos)  return { left: 0, top: 100 - C, width: C, height: C, side };

	if (side === 'top') {
		const idx = pos - board.goPos - 1;
		return { left: C + idx * S, top: 0, width: S, height: C, side };
	}
	if (side === 'right') {
		const idx = pos - board.jailPos - 1;
		return { left: 100 - C, top: C + idx * S, width: C, height: S, side };
	}
	if (side === 'bottom') {
		const idx = pos - board.parkingPos - 1;
		return { left: 100 - C - (idx + 1) * S, top: 100 - C, width: S, height: C, side };
	}
	// left side — tiles with pos > gotoprisonPos or pos < goPos
	const leftCount = board.sideCount;
	let idx;
	if (pos > board.gotoprisonPos) {
		idx = pos - board.gotoprisonPos - 1;
	} else {
		idx = leftCount - 1 - (board.goPos - pos - 1);
	}
	return { left: 0, top: 100 - C - (idx + 1) * S, width: C, height: S, side };
}

// ─── Geometric center ───────────────────────────────────────────────────────
export function tileCenter(pos, board) {
	const r = tileRect(pos, board);
	return [r.left + r.width / 2, r.top + r.height / 2];
}

// ─── Token center ──────────────────────────────────────────────────────────
const TOKEN_INSET = 0.29;

export function tokenCenter(pos, board) {
	const r = tileRect(pos, board);
	const cx = r.left + r.width / 2;
	const cy = r.top + r.height / 2;
	const k = TOKEN_INSET;
	if (r.side === 'top') return [cx, r.top + r.height * (1 - k)];
	if (r.side === 'bottom') return [cx, r.top + r.height * k];
	if (r.side === 'left') return [r.left + r.width * (1 - k), cy];
	if (r.side === 'right') return [r.left + r.width * k, cy];
	return [cx, cy];
}

export function innerEdge(side) {
	if (side === 'top') return 'bottom';
	if (side === 'bottom') return 'top';
	if (side === 'left') return 'right';
	if (side === 'right') return 'left';
	return null;
}

// Legacy exports for compatibility.
export const BAR_PCT = 20;
export const TOKEN_STRIP_END_PCT = 38;
export const TOKEN_INNER_OFFSET = TOKEN_INSET;

