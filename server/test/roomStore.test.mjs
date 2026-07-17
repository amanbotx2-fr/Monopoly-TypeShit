import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const GameRoom = require('../models/GameRoom');
const {
	activeRooms,
	createPlayerState,
	createRoom,
	deleteRoom,
	stripTransient,
} = require('../game/state');
const {
	deleteRoomSnapshot,
	restoreRecentRooms,
	restoreRoomByCode,
	saveRoomSnapshot,
} = require('../game/roomStore');

function clearRooms() {
	for (const [code] of activeRooms) deleteRoom(code);
}

function makeRoom({ started = true } = {}) {
	clearRooms();
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
	const p3 = createPlayerState({
		userId: 'player-3',
		username: 'Charlie',
		color: '#10B981',
		seat: 2,
		startingCash: room.rules.startingCash,
	});
	room.players.push(p2, p3);
	room.started = started;
	room.lifecycle = started ? 'in-progress' : 'waiting-for-players';
	room.turnPhase = started ? 'awaiting-roll' : 'waiting';
	return room;
}

function docFromRoom(room) {
	return {
		roomCode: room.roomCode,
		hostUserId: room.hostUserId,
		state: stripTransient(room),
		lastActivity: new Date(),
	};
}

function mockFindOne(doc) {
	const lean = vi.fn().mockResolvedValue(doc);
	const findOne = vi.spyOn(GameRoom, 'findOne').mockReturnValue({ lean });
	return { findOne, lean };
}

beforeEach(() => {
	clearRooms();
});

afterEach(() => {
	clearRooms();
	vi.restoreAllMocks();
});

describe('saveRoomSnapshot', () => {
	it('upserts a stripped room snapshot', async () => {
		const room = makeRoom();
		room.players[0].socketId = 'socket-host';
		room.players[0].connected = true;
		const update = vi.spyOn(GameRoom, 'findOneAndUpdate').mockResolvedValue({});

		await expect(saveRoomSnapshot(room)).resolves.toBe(true);

		expect(update).toHaveBeenCalledWith(
			{ roomCode: room.roomCode },
			expect.objectContaining({
				roomCode: room.roomCode,
				hostUserId: 'host-1',
				state: expect.objectContaining({ roomCode: room.roomCode }),
				lastActivity: expect.any(Date),
			}),
			{ upsert: true },
		);
		const state = update.mock.calls[0][1].state;
		expect(state.players[0].socketId).toBeNull();
		expect(state.players[0].connected).toBe(true);
	});

	it('returns false when Mongo write fails or room is missing', async () => {
		vi.spyOn(GameRoom, 'findOneAndUpdate').mockRejectedValue(new Error('down'));
		await expect(saveRoomSnapshot(makeRoom())).resolves.toBe(false);
		await expect(saveRoomSnapshot(null)).resolves.toBe(false);
	});
});

describe('deleteRoomSnapshot', () => {
	it('deletes snapshot by room code', async () => {
		const del = vi.spyOn(GameRoom, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
		await expect(deleteRoomSnapshot('ABC234')).resolves.toBe(true);
		expect(del).toHaveBeenCalledWith({ roomCode: 'ABC234' });
	});

	it('returns false for missing code or Mongo failure', async () => {
		await expect(deleteRoomSnapshot()).resolves.toBe(false);
		vi.spyOn(GameRoom, 'deleteOne').mockRejectedValue(new Error('down'));
		await expect(deleteRoomSnapshot('ABC234')).resolves.toBe(false);
	});
});

describe('restoreRoomByCode', () => {
	it('returns active room without querying Mongo', async () => {
		const room = makeRoom();
		const findOne = vi.spyOn(GameRoom, 'findOne');

		await expect(restoreRoomByCode(room.roomCode)).resolves.toBe(room);
		expect(findOne).not.toHaveBeenCalled();
	});

	it('restores exactly one persisted room by code', async () => {
		const room = makeRoom();
		const doc = docFromRoom(room);
		clearRooms();
		const { findOne } = mockFindOne(doc);

		const restored = await restoreRoomByCode(room.roomCode);

		expect(findOne).toHaveBeenCalledWith({ roomCode: room.roomCode });
		expect(restored.roomCode).toBe(room.roomCode);
		expect(activeRooms.get(room.roomCode)).toBe(restored);
		expect(restored.players).toHaveLength(3);
		expect(restored.players.every((p) => p.connected === false)).toBe(true);
	});

	it('deduplicates concurrent restores for the same code', async () => {
		const room = makeRoom();
		const doc = docFromRoom(room);
		clearRooms();
		let resolveDoc;
		const lean = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveDoc = () => resolve(doc);
				}),
		);
		const findOne = vi.spyOn(GameRoom, 'findOne').mockReturnValue({ lean });

		const first = restoreRoomByCode(room.roomCode);
		const second = restoreRoomByCode(room.roomCode);
		resolveDoc();
		const [a, b] = await Promise.all([first, second]);

		expect(findOne).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
		expect(activeRooms.get(room.roomCode)).toBe(a);
	});

	it('returns null for missing, ended, invalid, or failed snapshots', async () => {
		const missing = mockFindOne(null);
		await expect(restoreRoomByCode('ABC234')).resolves.toBeNull();
		missing.findOne.mockRestore();

		const mismatchedRoom = makeRoom();
		const mismatched = docFromRoom(mismatchedRoom);
		mismatched.state.roomCode = 'ZZZ999';
		clearRooms();
		const mismatchedMock = mockFindOne(mismatched);
		await expect(restoreRoomByCode(mismatchedRoom.roomCode)).resolves.toBeNull();
		expect(activeRooms.has('ZZZ999')).toBe(false);
		mismatchedMock.findOne.mockRestore();

		const endedRoom = makeRoom();
		const ended = docFromRoom(endedRoom);
		ended.state.ended = true;
		clearRooms();
		const endedMock = mockFindOne(ended);
		await expect(restoreRoomByCode(endedRoom.roomCode)).resolves.toBeNull();
		endedMock.findOne.mockRestore();

		const invalidMock = mockFindOne({ state: {} });
		await expect(restoreRoomByCode('DEF345')).resolves.toBeNull();
		invalidMock.findOne.mockRestore();

		vi.spyOn(GameRoom, 'findOne').mockImplementation(() => {
			throw new Error('down');
		});
		await expect(restoreRoomByCode('GHI456')).resolves.toBeNull();
	});
});

describe('restoreRecentRooms', () => {
	it('does not query Mongo when startup limit is zero', async () => {
		const find = vi.spyOn(GameRoom, 'find');
		await expect(restoreRecentRooms()).resolves.toBe(0);
		await expect(restoreRecentRooms({ limit: 0 })).resolves.toBe(0);
		expect(find).not.toHaveBeenCalled();
	});

	it('restores newest restorable rooms up to the configured limit', async () => {
		const r1 = makeRoom();
		const d1 = docFromRoom(r1);
		clearRooms();
		const r2 = makeRoom({ started: false });
		const d2 = docFromRoom(r2);
		const ended = docFromRoom(r2);
		ended.state.roomCode = 'ENDED1';
		ended.state.lifecycle = 'finished';
		clearRooms();

		const lean = vi.fn().mockResolvedValue([d1, d2, ended]);
		const limit = vi.fn().mockReturnValue({ lean });
		const sort = vi.fn().mockReturnValue({ limit });
		const find = vi.spyOn(GameRoom, 'find').mockReturnValue({ sort });

		await expect(restoreRecentRooms({ limit: 2 })).resolves.toBe(2);

		expect(find).toHaveBeenCalledWith({
			'state.ended': { $ne: true },
			'state.lifecycle': { $in: ['waiting-for-players', 'in-progress', 'empty-grace'] },
		});
		expect(sort).toHaveBeenCalledWith({ lastActivity: -1 });
		expect(limit).toHaveBeenCalledWith(2);
		expect(activeRooms.has(d1.roomCode)).toBe(true);
		expect(activeRooms.has(d2.roomCode)).toBe(true);
		expect(activeRooms.has('ENDED1')).toBe(false);
	});

	it('skips rooms already active and returns zero on Mongo failure', async () => {
		const room = makeRoom();
		const doc = docFromRoom(room);
		const lean = vi.fn().mockResolvedValue([doc]);
		const limit = vi.fn().mockReturnValue({ lean });
		const sort = vi.fn().mockReturnValue({ limit });
		const find = vi.spyOn(GameRoom, 'find').mockReturnValue({ sort });

		await expect(restoreRecentRooms({ limit: 1 })).resolves.toBe(0);

		find.mockRestore();
		vi.spyOn(GameRoom, 'find').mockImplementation(() => {
			throw new Error('down');
		});
		await expect(restoreRecentRooms({ limit: 1 })).resolves.toBe(0);
	});
});
