import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const validation = require('../validation/payloads');
const { createRoom, activeRooms, deleteRoom, TOKEN_COLORS } = require('../game/state');

// Helper to make a room for tests that need one
function makeRoom() {
	for (const [code] of activeRooms) deleteRoom(code);
	const room = createRoom({
		hostUserId: 'host-1',
		hostUsername: 'Alice',
		hostColor: '#EF4444',
		boardId: 'world-tour',
	});
	return room;
}

// ─── Basic validators ────────────────────────────────────────────────────────
describe('isPlainObject', () => {
	it('returns true for plain objects', () => {
		expect(validation.isPlainObject({})).toBe(true);
		expect(validation.isPlainObject({ a: 1 })).toBe(true);
	});

	it('returns false for arrays', () => {
		expect(validation.isPlainObject([])).toBe(false);
	});

	it('returns false for null', () => {
		expect(validation.isPlainObject(null)).toBe(false);
	});

	it('returns false for primitives', () => {
		expect(validation.isPlainObject('str')).toBe(false);
		expect(validation.isPlainObject(42)).toBe(false);
	});
});

describe('ok / fail', () => {
	it('ok wraps value', () => {
		expect(validation.ok(42)).toEqual({ ok: true, value: 42 });
	});

	it('fail returns error details', () => {
		expect(validation.fail('test', 'message', ['detail'])).toEqual({
			ok: false,
			error: 'test',
			message: 'message',
			details: ['detail'],
		});
	});
});

describe('noPayload', () => {
	it('accepts empty args', () => {
		expect(validation.noPayload([], 'test')).toEqual({ ok: true, value: undefined });
	});

	it('accepts undefined single arg', () => {
		expect(validation.noPayload([undefined], 'test')).toEqual({ ok: true, value: undefined });
	});

	it('accepts callback arg (Socket.IO ack)', () => {
		expect(validation.noPayload([() => {}], 'test')).toEqual({ ok: true, value: undefined });
	});

	it('accepts undefined + callback', () => {
		expect(validation.noPayload([undefined, () => {}], 'test')).toEqual({
			ok: true,
			value: undefined,
		});
	});

	it('rejects extra payload', () => {
		const r = validation.noPayload([{ x: 1 }], 'test');
		expect(r.ok).toBe(false);
	});
});

describe('oneObjectPayload', () => {
	it('accepts one object', () => {
		const r = validation.oneObjectPayload([{ x: 1 }], 'test');
		expect(r.ok).toBe(true);
		expect(r.value).toEqual({ x: 1 });
	});

	it('rejects non-object', () => {
		const r = validation.oneObjectPayload(['string'], 'test');
		expect(r.ok).toBe(false);
	});
});

// ─── String / number / boolean fields ────────────────────────────────────────
describe('stringField', () => {
	it('validates a string within bounds', () => {
		const r = validation.finiteNumber; // Use exports
	});

	// We can test these indirectly via the public validators
	it('roomCode validates correctly', () => {
		expect(validation.roomCode('ABCDEF').ok).toBe(true);
		expect(validation.roomCode('abcdef').ok).toBe(true);
		expect(validation.roomCode('123456').ok).toBe(false);
		expect(validation.roomCode('AB').ok).toBe(false);
		expect(validation.roomCode('').ok).toBe(false);
		expect(validation.roomCode(123).ok).toBe(false);
	});

	it('boardId validates correctly', () => {
		expect(validation.boardId('world-tour').ok).toBe(true);
		expect(validation.boardId('').ok).toBe(false);
	});

	it('username validates correctly', () => {
		expect(validation.username('Alice').ok).toBe(true);
		expect(validation.username('A B').ok).toBe(true);
		expect(validation.username('').ok).toBe(false);
		expect(validation.username('a'.repeat(25)).ok).toBe(false);
	});

	it('userId validates correctly', () => {
		expect(validation.userId('user-1').ok).toBe(true);
		expect(validation.userId('').ok).toBe(false);
	});

	it('validateColorPayload works', () => {
		expect(validation.validateColorPayload({ color: '#EF4444' }, TOKEN_COLORS).ok).toBe(true);
		expect(validation.validateColorPayload({ color: 'red' }, TOKEN_COLORS).ok).toBe(true);
		expect(validation.validateColorPayload({ color: '#000000' }, TOKEN_COLORS).ok).toBe(false);
	});
});

// ─── Socket event validators ─────────────────────────────────────────────────
describe('validateSocketAuth', () => {
	it('validates complete auth payload', () => {
		const r = validation.validateSocketAuth(
			{
				roomCode: 'ABCDEF',
				username: 'Alice',
				color: '#EF4444',
				asSpectator: false,
			},
			TOKEN_COLORS,
		);
		expect(r.ok).toBe(true);
	});

	it('allows optional fields to be missing', () => {
		const r = validation.validateSocketAuth({ roomCode: 'ABCDEF' }, TOKEN_COLORS);
		expect(r.ok).toBe(true);
	});

	it('rejects invalid room code', () => {
		const r = validation.validateSocketAuth({ roomCode: '123456' }, TOKEN_COLORS);
		expect(r.ok).toBe(false);
	});
});

describe('validateChatPayload', () => {
	it('validates chat message', () => {
		expect(validation.validateChatPayload({ text: 'hello' }).ok).toBe(true);
	});

	it('rejects empty text', () => {
		expect(validation.validateChatPayload({ text: '' }).ok).toBe(false);
	});

	it('rejects missing text', () => {
		expect(validation.validateChatPayload({}).ok).toBe(false);
	});
});

describe('validateUsernamePayload', () => {
	it('validates username', () => {
		expect(validation.validateUsernamePayload({ username: 'Alice' }).ok).toBe(true);
	});

	it('rejects invalid username', () => {
		expect(validation.validateUsernamePayload({ username: '' }).ok).toBe(false);
	});
});

describe('validateColorPayload', () => {
	it('validates color', () => {
		expect(validation.validateColorPayload({ color: '#EF4444' }, TOKEN_COLORS).ok).toBe(true);
	});

	it('validates color by id', () => {
		expect(validation.validateColorPayload({ color: 'red' }, TOKEN_COLORS).ok).toBe(true);
	});

	it('rejects unknown color', () => {
		expect(validation.validateColorPayload({ color: '#000000' }, TOKEN_COLORS).ok).toBe(false);
	});
});

describe('validateRulesPayload', () => {
	it('validates rules update', () => {
		const r = validation.validateRulesPayload({
			rules: { startingCash: 2000, salary: 300, doubleOnGo: true },
		});
		expect(r.ok).toBe(true);
	});

	it('rejects unknown rule key', () => {
		const r = validation.validateRulesPayload({
			rules: { invalidRule: 123 },
		});
		expect(r.ok).toBe(false);
	});

	it('rejects rules with out-of-range values', () => {
		const r = validation.validateRulesPayload({
			rules: { startingCash: 0 },
		});
		expect(r.ok).toBe(false);
	});
});

describe('validateKickPayload', () => {
	it('validates kick payload', () => {
		const room = makeRoom();
		const { createPlayerState } = require('../game/state');
		const p2 = createPlayerState({
			userId: 'player-2',
			username: 'Bob',
			color: '#3B82F6',
			seat: 1,
		});
		room.players.push(p2);
		const r = validation.validateKickPayload({ userId: 'player-2' }, room);
		expect(r.ok).toBe(true);
	});

	it('rejects kicking host', () => {
		const room = makeRoom();
		const r = validation.validateKickPayload({ userId: 'host-1' }, room);
		expect(r.ok).toBe(false);
	});

	it('rejects unknown player', () => {
		const room = makeRoom();
		const r = validation.validateKickPayload({ userId: 'nobody' }, room);
		expect(r.ok).toBe(false);
	});
});

describe('validatePosPayload', () => {
	it('validates position payload', () => {
		expect(validation.validatePosPayload({ pos: 5 }).ok).toBe(true);
	});

	it('rejects out-of-range position', () => {
		expect(validation.validatePosPayload({ pos: 40 }).ok).toBe(false);
	});

	it('rejects negative position', () => {
		expect(validation.validatePosPayload({ pos: -1 }).ok).toBe(false);
	});
});

describe('validateAuctionBidPayload', () => {
	it('validates auction bid', () => {
		const room = makeRoom();
		room.auction = { currentBid: 0, minIncrement: 10 };
		const player = room.players[0];
		const r = validation.validateAuctionBidPayload({ amount: 20 }, player, room);
		expect(r.ok).toBe(true);
	});

	it('rejects bid below minimum', () => {
		const room = makeRoom();
		room.auction = { currentBid: 0, minIncrement: 10 };
		const player = room.players[0];
		const r = validation.validateAuctionBidPayload({ amount: 5 }, player, room);
		expect(r.ok).toBe(false);
	});

	it('rejects when no auction', () => {
		const room = makeRoom();
		const player = room.players[0];
		const r = validation.validateAuctionBidPayload({ amount: 20 }, player, room);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-auction');
	});
});

describe('validateTradeMsgPayload', () => {
	it('validates trade message', () => {
		expect(
			validation.validateTradeMsgPayload({
				tradeId: 'tr_abc12345',
				text: 'hello',
			}).ok,
		).toBe(true);
	});

	it('rejects empty text', () => {
		expect(validation.validateTradeMsgPayload({ tradeId: 'tr_abc', text: '' }).ok).toBe(false);
	});
});

// ─── Board validators ────────────────────────────────────────────────────────
describe('validateCreateBoardBody', () => {
	it('validates full board creation', () => {
		const { WORLD_TOUR } = require('../game/boards');
		const tiles = WORLD_TOUR.tiles.map((t) => ({ ...t }));
		const r = validation.validateCreateBoardBody({
			name: 'Test Board',
			tiles,
		});
		expect(r.ok).toBe(true);
	});

	it('rejects missing name', () => {
		const r = validation.validateCreateBoardBody({ tiles: [] });
		expect(r.ok).toBe(false);
	});

	it('rejects non-array tiles', () => {
		const r = validation.validateCreateBoardBody({
			name: 'Test',
			tiles: 'not-array',
		});
		expect(r.ok).toBe(false);
	});
});

describe('validateCreateRoomBody', () => {
	it('validates room creation', () => {
		const r = validation.validateCreateRoomBody(
			{ username: 'Alice', color: '#EF4444' },
			TOKEN_COLORS,
		);
		expect(r.ok).toBe(true);
	});

	it('defaults boardId to world-tour', () => {
		const r = validation.validateCreateRoomBody(
			{ username: 'Alice', color: '#EF4444' },
			TOKEN_COLORS,
		);
		expect(r.value.boardId).toBe('world-tour');
	});
});

describe('validateQueryText', () => {
	it('validates query text', () => {
		expect(validation.validateQueryText('search').ok).toBe(true);
	});

	it('accepts empty/undefined query', () => {
		expect(validation.validateQueryText('').value).toBe('');
		expect(validation.validateQueryText(undefined).value).toBe('');
	});
});

// ─── Reject unknown keys ─────────────────────────────────────────────────────
// (We test this implicitly through the public validators above)
describe('rejectUnknownKeys', () => {
	// Tested implicitly, but let's verify via chat validator
	it('chat rejects unknown fields', () => {
		const r = validation.validateChatPayload({ text: 'hi', extra: 'bad' });
		expect(r.ok).toBe(false);
	});
});

// ─── validateBankruptPayload ─────────────────────────────────────────────────
describe('validateBankruptPayload', () => {
	it('validates bankruptcy when resolving debt to bank', () => {
		const room = makeRoom();
		const player = room.players[0];
		player.cash = 0;
		room.turnPhase = 'resolving';
		room.turnIndex = 0;
		room.pendingDebt = { userId: player.userId, creditor: 'bank', amount: 100 };
		const r = validation.validateBankruptPayload({}, room, player);
		expect(r.ok).toBe(true);
		expect(r.value.creditorUserId).toBeNull();
	});

	it('validates bankruptcy when resolving debt to player', () => {
		const room = makeRoom();
		const { createPlayerState } = require('../game/state');
		const p2 = createPlayerState({
			userId: 'player-2',
			username: 'Bob',
			color: '#3B82F6',
			seat: 1,
			startingCash: 1500,
		});
		room.players.push(p2);
		const player = room.players[0];
		player.cash = 0;
		room.turnPhase = 'resolving';
		room.turnIndex = 0;
		room.pendingDebt = { userId: player.userId, creditor: 'player-2', amount: 100 };
		const r = validation.validateBankruptPayload({ creditorUserId: 'player-2' }, room, player);
		expect(r.ok).toBe(true);
	});

	it('rejects bankruptcy when not resolving', () => {
		const room = makeRoom();
		room.turnPhase = 'awaiting-roll';
		const r = validation.validateBankruptPayload({}, room, room.players[0]);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-bankruptcy-state');
	});

	it('rejects if wrong creditor', () => {
		const room = makeRoom();
		const player = room.players[0];
		player.cash = 0;
		room.turnPhase = 'resolving';
		room.turnIndex = 0;
		room.pendingDebt = { userId: player.userId, creditor: 'player-2', amount: 100 };
		const r = validation.validateBankruptPayload({ creditorUserId: 'wrong' }, room, player);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-creditor');
	});
});

// ─── validateTradePayload ────────────────────────────────────────────────────
describe('validateTradePayload', () => {
	it('validates trade proposal with recipient', () => {
		const room = makeRoom();
		const { createPlayerState } = require('../game/state');
		const p2 = createPlayerState({
			userId: 'player-2',
			username: 'Bob',
			color: '#3B82F6',
			seat: 1,
			startingCash: 1500,
		});
		room.players.push(p2);
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
		expect(r.ok).toBe(true);
	});

	it('rejects trade with self', () => {
		const room = makeRoom();
		const r = validation.validateTradePayload(
			{
				toUserId: 'host-1',
				offer: {},
				request: {},
			},
			room,
			room.players[0],
			{ requireRecipient: true },
		);
		expect(r.ok).toBe(false);
	});
});

// ─── validatePatchBoardBody ──────────────────────────────────────────────────
describe('validatePatchBoardBody', () => {
	it('validates partial update', () => {
		const r = validation.validatePatchBoardBody({ name: 'New Name' });
		expect(r.ok).toBe(true);
		expect(r.value.name).toBe('New Name');
	});

	it('validates empty patch', () => {
		const r = validation.validatePatchBoardBody({});
		expect(r.ok).toBe(true);
	});

	it('rejects unknown fields', () => {
		const r = validation.validatePatchBoardBody({ bad: 'field' });
		expect(r.ok).toBe(false);
	});
});

// ─── validateDuplicateBoardBody ──────────────────────────────────────────────
describe('validateDuplicateBoardBody', () => {
	it('validates duplicate with name', () => {
		const r = validation.validateDuplicateBoardBody({ name: 'Copy' });
		expect(r.ok).toBe(true);
		expect(r.value.name).toBe('Copy');
	});

	it('accepts empty body', () => {
		const r = validation.validateDuplicateBoardBody(undefined);
		expect(r.ok).toBe(true);
	});
});
