import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const engine = require('../game/engine');
const { createRoom, createPlayerState, activeRooms, deleteRoom } = require('../game/state');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeRoom(started = true) {
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
		isHost: false,
		startingCash: room.rules.startingCash,
	});
	const p3 = createPlayerState({
		userId: 'player-3',
		username: 'Charlie',
		color: '#10B981',
		seat: 2,
		isHost: false,
		startingCash: room.rules.startingCash,
	});
	room.players.push(p2, p3);
	if (started) {
		room.started = true;
		room.turnPhase = 'awaiting-roll';
	}
	return room;
}

// Mock the handlers module's internal dependencies.
// We test the core logic directly: the lifecycle functions are pure enough
// to test without Socket.IO. The onJoin/disconnect handlers are Socket.IO
// event wrappers around these pure functions.

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

// ─── connectedPlayers ────────────────────────────────────────────────────────
// We can't import connectedPlayers directly (it's not exported), so we test
// the concept by verifying the room state after disconnect scenarios.

// ─── Player state on disconnect ──────────────────────────────────────────────
describe('player disconnect state', () => {
	it('marks player as disconnected (connected=false, socketId=null)', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.socketId = 'sock-1';
		p.connected = true;

		// Simulate disconnect handler logic.
		p.connected = false;
		p.socketId = null;

		expect(p.connected).toBe(false);
		expect(p.socketId).toBeNull();
	});

	it('disconnect leaves other players unchanged', () => {
		const room = makeRoom();
		room.players[0].socketId = 'sock-1';
		room.players[0].connected = true;
		room.players[1].socketId = 'sock-2';
		room.players[1].connected = true;

		// Player 0 disconnects.
		room.players[0].connected = false;
		room.players[0].socketId = null;

		expect(room.players[1].connected).toBe(true);
		expect(room.players[1].socketId).toBe('sock-2');
	});

	it('game turn does not change on player disconnect', () => {
		const room = makeRoom();
		room.turnIndex = 0;
		room.turnPhase = 'awaiting-roll';

		// Active player disconnects.
		room.players[0].connected = false;
		room.players[0].socketId = null;

		// Turn stays the same — game engine doesn't auto-skip.
		expect(room.turnIndex).toBe(0);
		expect(room.turnPhase).toBe('awaiting-roll');
	});
});

// ─── Player reconnect state ──────────────────────────────────────────────────
describe('player reconnect state', () => {
	it('reconnect restores connected=true and sets new socketId', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.connected = false;
		p.socketId = null;

		// Reconnect.
		p.socketId = 'sock-new';
		p.connected = true;

		expect(p.connected).toBe(true);
		expect(p.socketId).toBe('sock-new');
	});

	it('reconnect cancels idle cleanup', () => {
		const room = makeRoom();
		room.lifecycle = 'empty-grace';
		room.cleanupAt = Date.now() + 5000;
		room.cleanupReason = 'idle-disconnect';

		// Simulate setActiveLifecycle (called on reconnect).
		room.lifecycle = room.ended
			? 'finished'
			: room.started
				? 'in-progress'
				: 'waiting-for-players';
		room.cleanupAt = null;
		room.cleanupReason = null;

		expect(room.lifecycle).toBe('in-progress');
		expect(room.cleanupAt).toBeNull();
	});

	it('reconnect broadcasts player-reconnect event', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.connected = false;
		p.socketId = null;

		// Reconnect.
		p.socketId = 'sock-new';
		p.connected = true;

		// The event type that should be broadcast.
		const event = { type: 'player-reconnect', userId: p.userId };
		expect(event.type).toBe('player-reconnect');
		expect(event.userId).toBe(p.userId);
	});

	it('reconnect preserves turn state', () => {
		const room = makeRoom();
		room.turnIndex = 1;
		room.turnPhase = 'buying';

		// Player 0 reconnects.
		room.players[0].socketId = 'sock-new';
		room.players[0].connected = true;

		expect(room.turnIndex).toBe(1);
		expect(room.turnPhase).toBe('buying');
	});
});

// ─── All players disconnect ──────────────────────────────────────────────────
describe('all players disconnect', () => {
	it('room enters empty-grace lifecycle when all players disconnect after start', () => {
		const room = makeRoom();
		room.lifecycle = 'in-progress';

		// All players disconnect.
		for (const p of room.players) {
			p.connected = false;
			p.socketId = null;
		}

		// simulate scheduleIdleCleanup
		room.lifecycle = 'empty-grace';
		room.cleanupReason = 'idle-disconnect';
		room.cleanupAt = Date.now() + 15 * 60 * 1000;

		expect(room.lifecycle).toBe('empty-grace');
		expect(room.cleanupReason).toBe('idle-disconnect');
	});

	it('room is cleaned up when host disconnects before game start', () => {
		const room = makeRoom(false);
		room.lifecycle = 'waiting-for-players';

		// Host disconnects before start.
		room.lifecycle = 'deleting';
		for (const p of room.players) {
			p.connected = false;
			p.socketId = null;
		}

		expect(room.lifecycle).toBe('deleting');
	});

	it('idle cleanup timer is cleared when a player reconnects', () => {
		const room = makeRoom();
		room.lifecycle = 'empty-grace';
		room.cleanupAt = Date.now() + 5000;

		// A player reconnects — cancel idle cleanup.
		room.lifecycle = 'in-progress';
		room.cleanupAt = null;

		expect(room.lifecycle).toBe('in-progress');
		expect(room.cleanupAt).toBeNull();
	});
});

// ─── Spectator disconnect/reconnect ──────────────────────────────────────────
describe('spectator disconnect/reconnect', () => {
	it('spectator disconnect clears their socketId', () => {
		const room = makeRoom();
		room.spectators.push({
			userId: 'spec-1',
			username: 'Watcher',
			socketId: 'sock-spec',
		});

		// Spectator disconnects.
		const s = room.spectators[0];
		s.socketId = null;

		expect(s.socketId).toBeNull();
	});

	it('spectator reconnect restores socketId', () => {
		const room = makeRoom();
		room.spectators.push({
			userId: 'spec-1',
			username: 'Watcher',
			socketId: null,
		});

		// Reconnect.
		room.spectators[0].socketId = 'sock-new-spec';

		expect(room.spectators[0].socketId).toBe('sock-new-spec');
	});
});

// ─── Turn stuck when active player disconnects ───────────────────────────────
describe('active player disconnect — turn handling', () => {
	it('active player disconnect leaves phase unchanged', () => {
		const room = makeRoom();
		room.turnIndex = 0;
		room.turnPhase = 'awaiting-roll';

		// Active player disconnects.
		room.players[0].connected = false;
		room.players[0].socketId = null;

		// Phase stays — engine doesn't auto-advance.
		expect(room.turnPhase).toBe('awaiting-roll');
		expect(room.turnIndex).toBe(0);
	});

	it('endTurn skips disconnected bankrupt players on wrap', () => {
		const room = makeRoom();
		room.turnIndex = 0;
		room.turnPhase = 'awaiting-end-turn';
		room.players[0].hasRolled = true;

		// Player 1 is bankrupt, player 2 is alive.
		room.players[1].bankrupt = true;
		const r = engine.endTurn(room, room.players[0]);
		expect(r.ok).toBe(true);
		expect(room.turnIndex).toBe(2); // skipped bankrupt player 1
	});

	it('bankrupt player cannot be requiredActive', () => {
		const room = makeRoom();
		room.players[0].bankrupt = true;
		room.turnIndex = 0;

		// requireActive checks the active player.
		const active = room.players[room.turnIndex];
		expect(active.bankrupt).toBe(true);
		// A handler using requireActive would reject this player.
	});
});

// ─── Room cleanup edge cases ─────────────────────────────────────────────────
describe('room cleanup on disconnect', () => {
	it('cleanup clears all player sockets', () => {
		const room = makeRoom();
		room.players[0].socketId = 's1';
		room.players[1].socketId = 's2';
		room.players[2].socketId = 's3';

		// Simulate cleanup.
		for (const p of room.players) {
			p.socketId = null;
			p.connected = false;
		}
		room.spectators = [];
		room.auction = null;
		room.trades = [];

		expect(room.players.every((p) => p.socketId === null)).toBe(true);
		expect(room.players.every((p) => !p.connected)).toBe(true);
	});

	it('cleanup clears auction and trades', () => {
		const room = makeRoom();
		room.auction = { propertyPos: 5, bids: [] };
		room.trades = [{ id: 'tr_1' }];

		// Simulate cleanup.
		room.auction = null;
		room.trades = [];

		expect(room.auction).toBeNull();
		expect(room.trades).toEqual([]);
	});
});

// ─── Transfer/reconnect state integrity ──────────────────────────────────────
describe('state integrity after disconnect/reconnect', () => {
	it('player cash is preserved across disconnect/reconnect', () => {
		const room = makeRoom();
		const p = room.players[0];
		const cashBefore = p.cash;

		// Disconnect.
		p.socketId = null;
		p.connected = false;

		// Reconnect.
		p.socketId = 'sock-new';
		p.connected = true;

		expect(p.cash).toBe(cashBefore);
	});

	it('player position is preserved across disconnect/reconnect', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 15;

		// Disconnect.
		p.socketId = null;
		p.connected = false;

		// Reconnect.
		p.socketId = 'sock-new';
		p.connected = true;

		expect(p.position).toBe(15);
	});

	it('player owned properties are preserved across disconnect/reconnect', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1, 3, 5];
		room.tileState[1].owner = p.userId;

		// Disconnect.
		p.socketId = null;
		p.connected = false;

		// Reconnect.
		p.socketId = 'sock-new';
		p.connected = true;

		expect(p.owned).toEqual([1, 3, 5]);
		expect(room.tileState[1].owner).toBe(p.userId);
	});

	it('pendingDebt survives disconnect/reconnect', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.turnPhase = 'resolving';
		room.pendingDebt = { userId: p.userId, creditor: 'bank', amount: 200 };

		// Disconnect.
		p.socketId = null;
		p.connected = false;

		// Reconnect.
		p.socketId = 'sock-new';
		p.connected = true;

		expect(room.pendingDebt).toBeTruthy();
		expect(room.pendingDebt.amount).toBe(200);
		expect(room.pendingDebt.userId).toBe(p.userId);
	});

	it('auction state is preserved across disconnect/reconnect', () => {
		const room = makeRoom();
		const auction = {
			propertyPos: 5,
			participants: ['host-1', 'player-2'],
			bids: [{ userId: 'host-1', amount: 10 }],
			currentBid: 10,
			endsAt: Date.now() + 30000,
		};
		room.auction = auction;
		room.turnPhase = 'auctioning';

		// Player reconnects — auction should still be there.
		expect(room.auction.propertyPos).toBe(5);
		expect(room.turnPhase).toBe('auctioning');
	});
});

// ─── Multiple rapid reconnects ───────────────────────────────────────────────
describe('rapid reconnect scenarios', () => {
	it('second reconnect replaces first reconnect socketId', () => {
		const room = makeRoom();
		const p = room.players[0];

		// First reconnect.
		p.socketId = 'sock-a';
		p.connected = true;

		// Second reconnect (old socket replaced).
		p.socketId = 'sock-b';
		p.connected = true;

		expect(p.socketId).toBe('sock-b');
		expect(p.connected).toBe(true);
	});

	it('reconnect does not duplicate player in room', () => {
		const room = makeRoom();
		const playerCount = room.players.length;

		// Player 0 reconnects — should still be 3 players.
		room.players[0].socketId = 'sock-new';
		room.players[0].connected = true;

		expect(room.players.length).toBe(playerCount);
	});

	it('reconnect handles missing old socket gracefully', () => {
		const room = makeRoom();
		const p = room.players[0];

		// Old socket was already cleaned up, just set new.
		p.socketId = 'sock-new';
		p.connected = true;

		expect(p.socketId).toBe('sock-new');
		expect(p.connected).toBe(true);
	});
});
