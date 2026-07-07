import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const { activeRooms, deleteRoom, createRoom } = require('../game/state');
const {
	configurePendingRoomCleanup,
	schedulePendingRoomCleanup,
	clearPendingRoomCleanup,
	shutdownPendingRoomCleanup,
	pendingRoomStats,
	PENDING_HOST_CONNECT_MS,
} = require('../abuse/pendingRooms');

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
	shutdownPendingRoomCleanup();
	vi.restoreAllMocks();
});

function makeRoom(hostUserId = 'host-1') {
	const room = createRoom({
		hostUserId,
		hostUsername: 'Alice',
		hostColor: '#EF4444',
		boardId: 'world-tour',
	});
	return room;
}

describe('configurePendingRoomCleanup', () => {
	it('sets cleanup function', () => {
		const fn = vi.fn();
		configurePendingRoomCleanup(fn);
		// Should not throw
	});

	it('handles non-function gracefully', () => {
		configurePendingRoomCleanup(null);
		configurePendingRoomCleanup(undefined);
		configurePendingRoomCleanup('not-a-function');
	});
});

describe('schedulePendingRoomCleanup', () => {
	it('schedules cleanup for a room', () => {
		const cleanupFn = vi.fn();
		configurePendingRoomCleanup(cleanupFn);
		const room = makeRoom();
		schedulePendingRoomCleanup(room);
		expect(room.cleanupReason).toBe('pending-host-connect');
		expect(room.cleanupAt).toBeGreaterThan(Date.now());
	});

	it('does not schedule if room is null/undefined', () => {
		schedulePendingRoomCleanup(null);
		schedulePendingRoomCleanup(undefined);
	});

	it('does not double-schedule', () => {
		const room = makeRoom();
		schedulePendingRoomCleanup(room);
		const firstCleanupAt = room.cleanupAt;
		schedulePendingRoomCleanup(room);
		expect(room.cleanupAt).toBe(firstCleanupAt);
	});

	it('does not cleanup room that has started', async () => {
		vi.useFakeTimers();
		const cleanupFn = vi.fn();
		configurePendingRoomCleanup(cleanupFn);
		const room = makeRoom();
		schedulePendingRoomCleanup(room);
		room.started = true;

		vi.advanceTimersByTime(PENDING_HOST_CONNECT_MS + 100);
		expect(cleanupFn).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('does not cleanup room where host has connected', async () => {
		vi.useFakeTimers();
		const cleanupFn = vi.fn();
		configurePendingRoomCleanup(cleanupFn);
		const room = makeRoom();
		schedulePendingRoomCleanup(room);
		room.players[0].socketId = 'socket-1';

		vi.advanceTimersByTime(PENDING_HOST_CONNECT_MS + 100);
		expect(cleanupFn).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('calls deleteRoom when no cleanup function set', async () => {
		vi.useFakeTimers();
		configurePendingRoomCleanup(null);
		const room = makeRoom();
		schedulePendingRoomCleanup(room);

		vi.advanceTimersByTime(PENDING_HOST_CONNECT_MS + 100);
		expect(activeRooms.has(room.roomCode)).toBe(false);
		vi.useRealTimers();
	});
});

describe('clearPendingRoomCleanup', () => {
	it('clears the pending timer', () => {
		const room = makeRoom();
		schedulePendingRoomCleanup(room);
		expect(room.cleanupReason).toBe('pending-host-connect');

		clearPendingRoomCleanup(room.roomCode);
		expect(room.cleanupAt).toBeNull();
		expect(room.cleanupReason).toBeNull();
	});

	it('handles unknown room code', () => {
		clearPendingRoomCleanup('ZZZZZZ');
	});
});

describe('shutdownPendingRoomCleanup', () => {
	it('clears all pending timers', () => {
		const r1 = makeRoom('host-1');
		const r2 = makeRoom('host-2');
		schedulePendingRoomCleanup(r1);
		schedulePendingRoomCleanup(r2);
		expect(pendingRoomStats().pendingHostTimers).toBe(2);

		shutdownPendingRoomCleanup();
		expect(pendingRoomStats().pendingHostTimers).toBe(0);
	});
});

describe('pendingRoomStats', () => {
	it('returns zero when no pending timers', () => {
		expect(pendingRoomStats()).toEqual({ pendingHostTimers: 0 });
	});

	it('returns correct count', () => {
		const room = makeRoom();
		schedulePendingRoomCleanup(room);
		expect(pendingRoomStats().pendingHostTimers).toBe(1);
	});
});
