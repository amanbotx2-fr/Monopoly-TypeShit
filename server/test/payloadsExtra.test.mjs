import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const validation = require('../validation/payloads');
const {
	createRoom,
	createPlayerState,
	activeRooms,
	deleteRoom,
	TOKEN_COLORS,
} = require('../game/state');
const { WORLD_TOUR } = require('../game/boards');

function makeRoom() {
	for (const [code] of activeRooms) deleteRoom(code);
	const room = createRoom({
		hostUserId: 'host-1',
		hostUsername: 'Alice',
		hostColor: '#EF4444',
		boardId: 'world-tour',
	});
	const p2 = createPlayerState({
		userId: 'player-2',
		username: 'Bob',
		color: '#3B82F6',
		seat: 1,
		startingCash: 1500,
	});
	room.players.push(p2);
	room.started = true;
	return room;
}

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
});

// ─── validateTradePayload edge cases ─────────────────────────────────────────
describe('validateTradePayload edge cases', () => {
	it('rejects trade update with non-open trade', () => {
		const room = makeRoom();
		room.trades.push({
			id: 'tr_closed',
			fromUserId: 'host-1',
			toUserId: 'player-2',
			status: 'cancelled',
			createdAt: Date.now(),
		});
		const r = validation.validateTradePayload(
			{ tradeId: 'tr_closed', offer: {}, request: {} },
			room,
			room.players[0],
			{ requireRecipient: false },
		);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-trade-id');
	});

	it('rejects trade with offer cash exceeding available', () => {
		const room = makeRoom();
		room.players[0].cash = 50;
		room.players[1].cash = 2000;
		const r = validation.validateTradePayload(
			{
				toUserId: 'player-2',
				offer: { cash: 100, properties: [], jailCards: {} },
				request: {},
			},
			room,
			room.players[0],
			{ requireRecipient: true },
		);
		expect(r.ok).toBe(false);
	});

	it('rejects trade with non-ownable tile in properties', () => {
		const room = makeRoom();
		const r = validation.validateTradePayload(
			{
				toUserId: 'player-2',
				offer: { cash: 0, properties: [0], jailCards: {} },
				request: {},
			},
			room,
			room.players[0],
			{ requireRecipient: true },
		);
		expect(r.ok).toBe(false);
	});

	it('rejects trade with property not owned by player', () => {
		const room = makeRoom();
		const r = validation.validateTradePayload(
			{
				toUserId: 'player-2',
				offer: { cash: 0, properties: [1], jailCards: {} },
				request: {},
			},
			room,
			room.players[0],
			{ requireRecipient: true },
		);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-property-owner');
	});

	it('rejects trade with jail cards exceeding available', () => {
		const room = makeRoom();
		const r = validation.validateTradePayload(
			{
				toUserId: 'player-2',
				offer: { cash: 0, properties: [], jailCards: { chance: 1, chest: 0 } },
				request: {},
			},
			room,
			room.players[0],
			{ requireRecipient: true },
		);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-jail-card');
	});
});

// ─── validateBankruptPayload extra ───────────────────────────────────────────
describe('validateBankruptPayload extra', () => {
	it('rejects bankruptcy when not active debtor', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.turnPhase = 'resolving';
		room.turnIndex = 1; // Bob is active, not Alice
		room.pendingDebt = { userId: 'host-1', creditor: 'bank', amount: 100 };
		const r = validation.validateBankruptPayload({}, room, p);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-bankruptcy-state');
	});

	it('rejects when sufficient resources are available', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 500;
		room.turnPhase = 'resolving';
		room.turnIndex = 0;
		room.pendingDebt = { userId: 'host-1', creditor: 'bank', amount: 50 };
		const r = validation.validateBankruptPayload({}, room, p);
		expect(r.ok).toBe(false);
	});

	it('rejects when creditor does not match', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 0;
		room.turnPhase = 'resolving';
		room.turnIndex = 0;
		room.pendingDebt = { userId: 'host-1', creditor: 'player-2', amount: 100 };
		const r = validation.validateBankruptPayload({ creditorUserId: 'host-1' }, room, p); // wrong creditor
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-creditor');
	});

	it('rejects when creditor player is bankrupt', () => {
		const room = makeRoom();
		room.players[1].bankrupt = true;
		const p = room.players[0];
		p.cash = 0;
		room.turnPhase = 'resolving';
		room.turnIndex = 0;
		room.pendingDebt = { userId: 'host-1', creditor: 'player-2', amount: 100 };
		const r = validation.validateBankruptPayload({ creditorUserId: 'player-2' }, room, p);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-creditor');
	});
});

// ─── validateRulesPayload extra ──────────────────────────────────────────────
describe('validateRulesPayload extra', () => {
	it('validates all rule types (int, bool, number)', () => {
		const r = validation.validateRulesPayload({
			rules: {
				startingCash: 2000,
				salary: 300,
				doubleOnGo: true,
				auctionUnbought: false,
				noRentInJail: false,
				evenBuild: false,
				mortgageRebuyRate: 1.2,
				jailFine: 100,
				jailTurnsMax: 5,
				xDoubles: 4,
				turnClockSeconds: 60,
				allowDevOnMortgaged: true,
				randomTurnOrder: false,
			},
		});
		expect(r.ok).toBe(true);
	});

	it('rejects non-boolean for boolean rule', () => {
		const r = validation.validateRulesPayload({ rules: { doubleOnGo: 'yes' } });
		expect(r.ok).toBe(false);
	});

	it('rejects non-integer for integer rule', () => {
		const r = validation.validateRulesPayload({ rules: { startingCash: 1000.5 } });
		expect(r.ok).toBe(false);
	});
});

// ─── validateCreateBoardBody extra ───────────────────────────────────────────
describe('validateCreateBoardBody extra', () => {
	it('rejects invalid id format', () => {
		const tiles = WORLD_TOUR.tiles.map((t) => ({ ...t }));
		const r = validation.validateCreateBoardBody({
			id: 'INVALID!!!',
			name: 'Test',
			tiles,
		});
		expect(r.ok).toBe(false);
	});

	it('rejects bad description', () => {
		const tiles = WORLD_TOUR.tiles.map((t) => ({ ...t }));
		const r = validation.validateCreateBoardBody({
			name: 'Test',
			tiles,
			description: 'x'.repeat(501),
		});
		expect(r.ok).toBe(false);
	});

	it('rejects invalid groupColors', () => {
		const tiles = WORLD_TOUR.tiles.map((t) => ({ ...t }));
		const r = validation.validateCreateBoardBody({
			name: 'Test',
			tiles,
			groupColors: 'not-an-object',
		});
		expect(r.ok).toBe(false);
	});
});

// ─── validatePatchBoardBody extra ────────────────────────────────────────────
describe('validatePatchBoardBody extra', () => {
	it('rejects invalid description in patch', () => {
		const r = validation.validatePatchBoardBody({ description: 'x'.repeat(501) });
		expect(r.ok).toBe(false);
	});

	it('rejects non-boolean isPublic', () => {
		const r = validation.validatePatchBoardBody({ isPublic: 'yes' });
		expect(r.ok).toBe(false);
	});

	it('rejects invalid groupColors in patch', () => {
		const r = validation.validatePatchBoardBody({ groupColors: 'bad' });
		expect(r.ok).toBe(false);
	});
});

// ─── validateDuplicateBoardBody extra ────────────────────────────────────────
describe('validateDuplicateBoardBody extra', () => {
	it('rejects invalid name', () => {
		const r = validation.validateDuplicateBoardBody({ name: 'x'.repeat(81) });
		expect(r.ok).toBe(false);
	});

	it('rejects invalid description', () => {
		const r = validation.validateDuplicateBoardBody({ description: 'x'.repeat(501) });
		expect(r.ok).toBe(false);
	});

	it('rejects non-boolean isPublic', () => {
		const r = validation.validateDuplicateBoardBody({ isPublic: 'yes' });
		expect(r.ok).toBe(false);
	});
});

// ─── validateCreateRoomBody extra ────────────────────────────────────────────
describe('validateCreateRoomBody extra', () => {
	it('allows customBoardId', () => {
		const r = validation.validateCreateRoomBody(
			{ username: 'Alice', color: '#EF4444', customBoardId: 'my-board-1' },
			TOKEN_COLORS,
		);
		expect(r.ok).toBe(true);
		expect(r.value.customBoardId).toBe('my-board-1');
	});

	it('rejects invalid customBoardId', () => {
		const r = validation.validateCreateRoomBody(
			{ username: 'Alice', color: '#EF4444', customBoardId: 'INVALID!!!' },
			TOKEN_COLORS,
		);
		expect(r.ok).toBe(false);
	});
});

// ─── validateSocketAuth extra ────────────────────────────────────────────────
describe('validateSocketAuth extra', () => {
	it('rejects non-boolean asSpectator', () => {
		const r = validation.validateSocketAuth(
			{ roomCode: 'ABCDEF', asSpectator: 'yes' },
			TOKEN_COLORS,
		);
		expect(r.ok).toBe(false);
	});

	it('rejects unknown fields', () => {
		const r = validation.validateSocketAuth(
			{ roomCode: 'ABCDEF', extraField: true },
			TOKEN_COLORS,
		);
		expect(r.ok).toBe(false);
	});
	it('validatePatchBoardBody: tiles in patch', () => {
		const { WORLD_TOUR } = require('../game/boards');
		const tiles = WORLD_TOUR.tiles.map((t) => ({ ...t }));
		const r = validation.validatePatchBoardBody({ tiles });
		expect(r.ok).toBe(true);
		expect(r.value.tiles).toBeDefined();
	});

	it('validateDuplicateBoardBody: with description and isPublic', () => {
		const r = validation.validateDuplicateBoardBody({ description: 'A copy', isPublic: false });
		expect(r.ok).toBe(true);
		expect(r.value.description).toBe('A copy');
		expect(r.value.isPublic).toBe(false);
	});
});
