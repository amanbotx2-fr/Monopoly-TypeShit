import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const engine = require('../game/engine');
const { createRoom, createPlayerState, activeRooms, deleteRoom } = require('../game/state');
const devtools = require('../game/devtools');

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
		startingCash: room.rules.startingCash,
	});
	room.players.push(p2);
	room.started = true;
	room.turnPhase = 'awaiting-roll';
	return room;
}

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
});

// ─── setCash ─────────────────────────────────────────────────────────────────
describe('setCash', () => {
	it('sets player cash to a valid amount', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setCash(room, caller, target, 500);
		expect(r.ok).toBe(true);
		expect(target.cash).toBe(500);
	});

	it('rejects negative cash', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setCash(room, caller, target, -1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('negative-cash');
	});

	it('emits dev-set-cash event', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setCash(room, caller, target, 500);
		expect(r.events).toHaveLength(1);
		expect(r.events[0].type).toBe('dev-set-cash');
		expect(r.events[0].userId).toBe(target.userId);
		expect(r.events[0].new).toBe(500);
	});

	it('sets cash to zero', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setCash(room, caller, target, 0);
		expect(r.ok).toBe(true);
		expect(target.cash).toBe(0);
	});
});

// ─── setPosition ─────────────────────────────────────────────────────────────
describe('setPosition', () => {
	it('moves player to a valid position', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setPosition(room, caller, target, 15);
		expect(r.ok).toBe(true);
		expect(target.position).toBe(15);
	});

	it('rejects position out of range', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		expect(devtools.setPosition(room, caller, target, -1).ok).toBe(false);
		expect(devtools.setPosition(room, caller, target, 40).ok).toBe(false);
	});

	it('clears jail state when moving out of jail', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		target.inJail = true;
		target.jailTurns = 2;
		target.position = 10;
		const r = devtools.setPosition(room, caller, target, 20);
		expect(r.ok).toBe(true);
		expect(target.inJail).toBe(false);
		expect(target.jailTurns).toBe(0);
	});

	it('keeps jail state when moving to jail', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		target.inJail = true;
		target.jailTurns = 2;
		const r = devtools.setPosition(room, caller, target, 10);
		expect(r.ok).toBe(true);
		expect(target.inJail).toBe(true);
		expect(target.jailTurns).toBe(2);
	});

	it('resolves landing when resolveLand is true', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		target.position = 0;
		// Move to an unowned property (pos 1).
		const r = devtools.setPosition(room, caller, target, 1, { resolveLand: true });
		expect(r.ok).toBe(true);
		// Should trigger buying phase for the target player.
		expect(room.turnPhase).toBe('buying');
	});

	// ─── Regression: "stuck in resolving" bug ─────────────────────────────
	// The setPosition + resolveLand path was forcing turnPhase='resolving'
	// before calling resolveLanding, which left the phase stuck if the
	// landing didn't produce a debt. These tests guarantee it never happens again.

	it('resolveLand on owned property (can afford): phase is awaiting-end-turn, NOT resolving', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		// Give pos 1 (Cairo) to caller, move target there — target owes rent.
		room.tileState[1].owner = caller.userId;
		caller.owned.push(1);
		target.cash = 500;
		const r = devtools.setPosition(room, caller, target, 1, { resolveLand: true });
		expect(r.ok).toBe(true);
		// Phase must NOT be 'resolving' — player can afford the rent.
		expect(room.turnPhase).not.toBe('resolving');
		expect(room.pendingDebt).toBeNull();
		expect(room.turnPhase).toBe('awaiting-end-turn');
	});

	it('resolveLand on owned property (cannot afford): phase is resolving with pendingDebt', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		room.tileState[1].owner = caller.userId;
		caller.owned.push(1);
		target.cash = 0;
		const r = devtools.setPosition(room, caller, target, 1, { resolveLand: true });
		expect(r.ok).toBe(true);
		expect(room.turnPhase).toBe('resolving');
		expect(room.pendingDebt).toBeTruthy();
		expect(room.pendingDebt.userId).toBe(target.userId);
	});

	it('resolveLand on GO: phase is awaiting-end-turn, NOT resolving', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setPosition(room, caller, target, 0, { resolveLand: true });
		expect(r.ok).toBe(true);
		expect(room.turnPhase).not.toBe('resolving');
		expect(room.pendingDebt).toBeNull();
	});

	it('resolveLand on own property: phase is awaiting-end-turn, NOT resolving', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		// Give pos 1 to the target — they land on their own property.
		room.tileState[1].owner = target.userId;
		target.owned.push(1);
		const r = devtools.setPosition(room, caller, target, 1, { resolveLand: true });
		expect(r.ok).toBe(true);
		expect(room.turnPhase).not.toBe('resolving');
		expect(room.pendingDebt).toBeNull();
	});

	it('resolveLand on tax (can afford): phase is awaiting-end-turn, NOT resolving', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		target.cash = 500;
		const r = devtools.setPosition(room, caller, target, 4, { resolveLand: true }); // Income Tax
		expect(r.ok).toBe(true);
		expect(room.turnPhase).not.toBe('resolving');
		expect(room.pendingDebt).toBeNull();
	});

	it('resolveLand on tax (cannot afford): phase is resolving with pendingDebt', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		target.cash = 0;
		const r = devtools.setPosition(room, caller, target, 4, { resolveLand: true }); // Income Tax
		expect(r.ok).toBe(true);
		expect(room.turnPhase).toBe('resolving');
		expect(room.pendingDebt).toBeTruthy();
		expect(room.pendingDebt.creditor).toBe('bank');
	});

	it('resolveLand on Jail (just visiting): phase is NOT resolving', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.setPosition(room, caller, target, 10, { resolveLand: true });
		expect(r.ok).toBe(true);
		expect(room.turnPhase).not.toBe('resolving');
		expect(room.pendingDebt).toBeNull();
	});
});

// ─── buyProperty ─────────────────────────────────────────────────────────────
describe('buyProperty', () => {
	it('buys an unowned property for the target player', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const cashBefore = target.cash;
		const r = devtools.buyProperty(room, caller, target, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].owner).toBe(target.userId);
		expect(target.owned).toContain(1);
		expect(target.cash).toBe(cashBefore - room.board.tiles[1].price);
	});

	it('rejects if already owned', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		room.tileState[1].owner = caller.userId;
		const r = devtools.buyProperty(room, caller, target, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('already-owned');
	});

	it('rejects non-buyable tiles', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		// Pos 0 is GO.
		const r = devtools.buyProperty(room, caller, target, 0);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-buyable-tile');
	});

	it('rejects if insufficient cash', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		target.cash = 1;
		const r = devtools.buyProperty(room, caller, target, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('insufficient');
	});

	it('rejects bad position', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.buyProperty(room, caller, target, -1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-position');
	});
});

// ─── giveProperty ────────────────────────────────────────────────────────────
describe('giveProperty', () => {
	it('gives a property to the target player for free', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.giveProperty(room, caller, target, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].owner).toBe(target.userId);
		expect(target.owned).toContain(1);
	});

	it('transfers property from previous owner', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		room.tileState[1].owner = caller.userId;
		caller.owned.push(1);
		const r = devtools.giveProperty(room, caller, target, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].owner).toBe(target.userId);
		expect(caller.owned).not.toContain(1);
		expect(target.owned).toContain(1);
	});

	it('resets houses and mortgage on transfer', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		room.tileState[1].owner = caller.userId;
		room.tileState[1].houses = 3;
		room.tileState[1].mortgaged = true;
		caller.owned.push(1);
		const r = devtools.giveProperty(room, caller, target, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].houses).toBe(0);
		expect(room.tileState[1].mortgaged).toBe(false);
	});

	it('rejects non-property tiles', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.giveProperty(room, caller, target, 0);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-property');
	});

	it('rejects bad position', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const target = room.players[1];
		const r = devtools.giveProperty(room, caller, target, -1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-position');
	});
});

// ─── forceRoll ───────────────────────────────────────────────────────────────
describe('forceRoll', () => {
	it('sets the next dice roll on the room', () => {
		const room = makeRoom();
		const caller = room.players[0];
		const r = devtools.forceRoll(room, caller, 3, 4);
		expect(r.ok).toBe(true);
		expect(room._devDice).toEqual([3, 4]);
	});

	it('rollDice consumes _devDice', () => {
		const room = makeRoom();
		devtools.forceRoll(room, room.players[0], 5, 6);
		const dice = engine.rollDice(room);
		expect(dice).toEqual([5, 6]);
		expect(room._devDice).toBeNull();
	});

	it('rollDice falls back to random when no _devDice', () => {
		const room = makeRoom();
		room._devDice = null;
		const dice = engine.rollDice(room);
		expect(dice).toHaveLength(2);
		expect(dice[0]).toBeGreaterThanOrEqual(1);
		expect(dice[0]).toBeLessThanOrEqual(6);
		expect(dice[1]).toBeGreaterThanOrEqual(1);
		expect(dice[1]).toBeLessThanOrEqual(6);
	});

	it('forced roll is used by rollAndMove', () => {
		const room = makeRoom();
		const p = room.players[0];
		devtools.forceRoll(room, p, 3, 4);
		const r = engine.rollAndMove(room, p);
		expect(r.ok).toBe(true);
		// lastDice should reflect the forced values.
		expect(room.lastDice).toEqual([3, 4]);
	});
});

// ─── handleDevCommand ────────────────────────────────────────────────────────
describe('handleDevCommand', () => {
	function mockSocket(room) {
		return {
			data: {
				roomCode: room.roomCode,
				userId: room.players[0].userId,
			},
			emit: vi.fn(),
		};
	}

	function mockIo(room) {
		const roomEmit = vi.fn();
		return {
			to: vi.fn((code) => {
				expect(code).toBe(room.roomCode);
				return { emit: roomEmit };
			}),
			_roomEmit: roomEmit,
		};
	}

	it('dispatches set-cash and broadcasts state', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);
		const target = room.players[1];

		devtools.handleDevCommand(io, socket, {
			cmd: 'set-cash',
			userId: target.userId,
			amount: 999,
		});

		expect(target.cash).toBe(999);
		expect(io.to).toHaveBeenCalledWith(room.roomCode);
		expect(io._roomEmit).toHaveBeenCalled();
	});

	it('dispatches set-position and broadcasts', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);
		const target = room.players[1];

		devtools.handleDevCommand(io, socket, {
			cmd: 'set-position',
			userId: target.userId,
			pos: 20,
			resolve: false,
		});

		expect(target.position).toBe(20);
		expect(io._roomEmit).toHaveBeenCalled();
	});

	it('dispatches buy-property', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);
		const target = room.players[1];

		devtools.handleDevCommand(io, socket, {
			cmd: 'buy-property',
			userId: target.userId,
			pos: 1,
		});

		expect(room.tileState[1].owner).toBe(target.userId);
		expect(io._roomEmit).toHaveBeenCalled();
	});

	it('dispatches give-property', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);
		const target = room.players[1];

		devtools.handleDevCommand(io, socket, {
			cmd: 'give-property',
			userId: target.userId,
			pos: 1,
		});

		expect(room.tileState[1].owner).toBe(target.userId);
		expect(io._roomEmit).toHaveBeenCalled();
	});

	it('dispatches force-roll', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);

		devtools.handleDevCommand(io, socket, {
			cmd: 'force-roll',
			userId: room.players[0].userId,
			d1: 2,
			d2: 5,
		});

		expect(room._devDice).toEqual([2, 5]);
		expect(io._roomEmit).toHaveBeenCalled();
	});

	it('emits error for unknown command', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);

		devtools.handleDevCommand(io, socket, {
			cmd: 'unknown-cmd',
			userId: room.players[0].userId,
		});

		expect(socket.emit).toHaveBeenCalledWith('error-msg', 'unknown-dev-command');
	});

	it('emits error when target player not found', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);

		devtools.handleDevCommand(io, socket, {
			cmd: 'set-cash',
			userId: 'nonexistent',
			amount: 100,
		});

		expect(socket.emit).toHaveBeenCalledWith('error-msg', 'dev-target-not-found');
	});

	it('emits error when room not found', () => {
		const io = { to: vi.fn() };
		const socket = {
			data: { roomCode: 'NOSUCH', userId: 'someone' },
			emit: vi.fn(),
		};

		// Should not throw.
		devtools.handleDevCommand(io, socket, {
			cmd: 'set-cash',
			userId: 'someone',
			amount: 100,
		});

		expect(socket.emit).not.toHaveBeenCalled();
	});

	it('emits error when command fails (e.g., negative cash)', () => {
		const room = makeRoom();
		const io = mockIo(room);
		const socket = mockSocket(room);
		const target = room.players[1];

		devtools.handleDevCommand(io, socket, {
			cmd: 'set-cash',
			userId: target.userId,
			amount: -1,
		});

		expect(socket.emit).toHaveBeenCalledWith('error-msg', 'negative-cash');
		expect(io._roomEmit).not.toHaveBeenCalled();
	});
});
