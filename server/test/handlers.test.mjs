import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
	createRoom,
	activeRooms,
	deleteRoom,
	createPlayerState,
	stripTransient,
	hydrateRestoredRoom,
} = require('../game/state');

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

// ─── stripTransient ──────────────────────────────────────────────────────────
describe('stripTransient', () => {
	it('strips socketId from players and spectators', () => {
		const room = makeRoom();
		room.players[0].socketId = 'sock-1';
		room.players[1].socketId = 'sock-2';
		room.spectators.push({ userId: 'spec-1', username: 'Watcher', socketId: 'sock-3' });

		const stripped = stripTransient(room);
		expect(stripped.players[0].socketId).toBeNull();
		expect(stripped.players[1].socketId).toBeNull();
		expect(stripped.spectators[0].socketId).toBeNull();
	});

	it('sets connected to true for all players', () => {
		const room = makeRoom();
		room.players[0].connected = false;
		room.players[1].connected = false;

		const stripped = stripTransient(room);
		expect(stripped.players[0].connected).toBe(true);
		expect(stripped.players[1].connected).toBe(true);
	});

	it('preserves all other room state', () => {
		const room = makeRoom();
		room.parkingPot = 500;
		room.turnIndex = 1;

		const stripped = stripTransient(room);
		expect(stripped.parkingPot).toBe(500);
		expect(stripped.turnIndex).toBe(1);
		expect(stripped.roomCode).toBe(room.roomCode);
		expect(stripped.started).toBe(true);
	});
});

// ─── hydrateRestoredRoom ─────────────────────────────────────────────────────
describe('hydrateRestoredRoom', () => {
	it('returns hydrated room for in-progress state', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.lifecycle = 'in-progress';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result).toBeTruthy();
		expect(result.roomCode).toBe(room.roomCode);
		expect(result.lifecycle).toBe('in-progress');
	});

	it('resets transport-only state on restored room while preserving game state', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.players[0].connected = true;
		stripped.players[0].socketId = 'old-socket';
		stripped.spectators = [{ userId: 'spec', username: 'W', socketId: 'x' }];
		stripped.auction = { propertyPos: 5 };
		stripped.trades = [{ id: 'tr_1' }];
		stripped.lifecycle = 'in-progress';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result.players[0].connected).toBe(false);
		expect(result.players[0].socketId).toBeNull();
		expect(result.spectators).toEqual([]);
		expect(result.auction).toEqual({ propertyPos: 5 });
		expect(result.trades).toEqual([{ id: 'tr_1' }]);
	});

	it('does not mutate the Mongo document state while hydrating', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.lifecycle = 'in-progress';
		stripped.players[0].socketId = 'old-socket';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result.players[0].socketId).toBeNull();
		expect(doc.state.players[0].socketId).toBe('old-socket');
	});

	it('normalizes legacy missing lifecycle from started flag', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		delete stripped.lifecycle;

		const result = hydrateRestoredRoom({ state: stripped });
		expect(result).toBeTruthy();
		expect(result.lifecycle).toBe('in-progress');
	});

	it('normalizes malformed optional arrays on restored room', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.lifecycle = 'in-progress';
		stripped.spectators = null;
		stripped.trades = null;

		const result = hydrateRestoredRoom({ state: stripped });
		expect(result.spectators).toEqual([]);
		expect(result.trades).toEqual([]);
	});

	it('clears cleanupAt on restored room', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.lifecycle = 'empty-grace';
		stripped.cleanupAt = Date.now() + 5000;
		stripped.cleanupReason = 'idle-timeout';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result.cleanupAt).toBeNull();
		expect(result.cleanupReason).toBeNull();
	});

	it('returns null for rooms that have ended', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.ended = true;
		stripped.lifecycle = 'finished';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result).toBeNull();
	});

	it('returns null for null/empty state', () => {
		expect(hydrateRestoredRoom({ state: null })).toBeNull();
		expect(hydrateRestoredRoom({ state: {} })).toBeNull();
		expect(hydrateRestoredRoom({})).toBeNull();
	});

	it('returns null for non-restorable lifecycles', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.lifecycle = 'deleting';
		const doc = { state: stripped };

		expect(hydrateRestoredRoom(doc)).toBeNull();
	});

	it('returns null for finished lifecycle', () => {
		const room = makeRoom();
		const stripped = stripTransient(room);
		stripped.lifecycle = 'finished';
		const doc = { state: stripped };

		expect(hydrateRestoredRoom(doc)).toBeNull();
	});

	it('restores waiting-for-players room', () => {
		const room = makeRoom();
		room.started = false;
		room.lifecycle = 'waiting-for-players';
		const stripped = stripTransient(room);
		stripped.lifecycle = 'waiting-for-players';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result).toBeTruthy();
		expect(result.started).toBe(false);
		expect(result.lifecycle).toBe('waiting-for-players');
	});

	it('restores empty-grace room as in-progress', () => {
		const room = makeRoom();
		room.lifecycle = 'empty-grace';
		const stripped = stripTransient(room);
		stripped.lifecycle = 'empty-grace';
		const doc = { state: stripped };

		const result = hydrateRestoredRoom(doc);
		expect(result).toBeTruthy();
		expect(result.lifecycle).toBe('in-progress');
	});
});
