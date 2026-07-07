import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
	TOKEN_COLORS,
	activeRooms,
	defaultRules,
	createRoom,
	createPlayerState,
	getRoom,
	deleteRoom,
	getPlayer,
	getSpectator,
	getOccupant,
	publicView,
	bumpVersion,
	appendLog,
	appendChat,
	generateRoomCode,
} = require('../game/state');

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
});

describe('generateRoomCode', () => {
	it('generates a 6-char uppercase code', () => {
		const code = generateRoomCode();
		expect(code).toHaveLength(6);
		expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
	});

	it('generates unique codes', () => {
		const codes = new Set();
		for (let i = 0; i < 100; i++) {
			const code = generateRoomCode();
			activeRooms.set(code, {}); // Simulate occupancy
			codes.add(code);
		}
		expect(codes.size).toBe(100);
	});
});

describe('createRoom', () => {
	it('creates a room with default board', () => {
		const room = createRoom({
			hostUserId: 'host-1',
			hostUsername: 'Alice',
			hostColor: '#EF4444',
		});
		expect(room.roomCode).toBeDefined();
		expect(room.hostUserId).toBe('host-1');
		expect(room.board.id).toBe('world-tour');
		expect(room.players).toHaveLength(1);
		expect(room.players[0].isHost).toBe(true);
		expect(room.players[0].cash).toBe(1500);
		expect(room.tileState).toHaveLength(40);
		expect(room.started).toBe(false);
		expect(room.ended).toBe(false);
		expect(room.version).toBe(0);
	});

	it('creates a room with a different builtin board', () => {
		const room = createRoom({
			hostUserId: 'host-1',
			hostUsername: 'Alice',
			hostColor: '#EF4444',
			boardId: 'classic-usa',
		});
		expect(room.board.id).toBe('classic-usa');
	});

	it('creates a room with a custom board', () => {
		const customBoard = {
			id: 'custom-1',
			name: 'Test Board',
			tiles: require('../game/boards').WORLD_TOUR.tiles,
		};
		const room = createRoom({
			hostUserId: 'host-1',
			hostUsername: 'Alice',
			hostColor: '#EF4444',
			boardId: 'world-tour',
			customBoard,
		});
		expect(room.board.id).toBe('custom-1');
	});

	it('throws for unknown board', () => {
		expect(() =>
			createRoom({
				hostUserId: 'host-1',
				hostUsername: 'Alice',
				hostColor: '#EF4444',
				boardId: 'nonexistent',
			}),
		).toThrow(/Unknown board/);
	});
});

describe('defaultRules', () => {
	it('returns default rule values', () => {
		const rules = defaultRules();
		expect(rules.startingCash).toBe(1500);
		expect(rules.salary).toBe(200);
		expect(rules.doubleOnGo).toBe(false);
		expect(rules.freeParkingPot).toBe(false);
		expect(rules.auctionUnbought).toBe(true);
		expect(rules.noRentInJail).toBe(true);
		expect(rules.evenBuild).toBe(true);
		expect(rules.mortgageRebuyRate).toBe(1.1);
		expect(rules.maxHouses).toBe(32);
		expect(rules.maxHotels).toBe(12);
		expect(rules.jailFine).toBe(50);
		expect(rules.jailTurnsMax).toBe(3);
		expect(rules.xDoubles).toBe(3);
		expect(rules.turnClockSeconds).toBe(0);
		expect(rules.allowDevOnMortgaged).toBe(false);
		expect(rules.randomTurnOrder).toBe(true);
	});
});

describe('createPlayerState', () => {
	it('creates player with correct defaults', () => {
		const p = createPlayerState({
			userId: 'user-1',
			username: 'Alice',
			color: '#EF4444',
			seat: 0,
			isHost: true,
		});
		expect(p.userId).toBe('user-1');
		expect(p.username).toBe('Alice');
		expect(p.color).toBe('#EF4444');
		expect(p.seat).toBe(0);
		expect(p.isHost).toBe(true);
		expect(p.position).toBe(0);
		expect(p.cash).toBe(1500);
		expect(p.inJail).toBe(false);
		expect(p.bankrupt).toBe(false);
		expect(p.owned).toEqual([]);
		expect(p.socketId).toBeNull();
		expect(p.connected).toBe(true);
	});

	it('accepts custom startingCash', () => {
		const p = createPlayerState({
			userId: 'user-1',
			username: 'Alice',
			color: '#EF4444',
			seat: 0,
			startingCash: 2000,
		});
		expect(p.cash).toBe(2000);
	});
});

describe('room lookup', () => {
	it('getRoom returns room by code', () => {
		const room = createRoom({ hostUserId: 'h', hostUsername: 'A', hostColor: '#EF4444' });
		expect(getRoom(room.roomCode)).toBe(room);
	});

	it('getRoom returns undefined for unknown code', () => {
		expect(getRoom('ZZZZZZ')).toBeUndefined();
	});

	it('deleteRoom removes room', () => {
		const room = createRoom({ hostUserId: 'h', hostUsername: 'A', hostColor: '#EF4444' });
		deleteRoom(room.roomCode);
		expect(getRoom(room.roomCode)).toBeUndefined();
	});
});

describe('player lookup', () => {
	it('getPlayer finds player', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		expect(getPlayer(room, 'host-1')).toBe(room.players[0]);
	});

	it('getPlayer returns null for unknown user', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		expect(getPlayer(room, 'nobody')).toBeNull();
	});

	it('getSpectator finds spectator', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		room.spectators.push({ userId: 'spec-1', username: 'Watcher', socketId: null });
		expect(getSpectator(room, 'spec-1').username).toBe('Watcher');
	});

	it('getOccupant finds player or spectator', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		room.spectators.push({ userId: 'spec-1', username: 'Watcher', socketId: null });
		expect(getOccupant(room, 'host-1').username).toBe('A');
		expect(getOccupant(room, 'spec-1').username).toBe('Watcher');
		expect(getOccupant(room, 'nobody')).toBeNull();
	});
});

describe('publicView', () => {
	it('strips socket ids from players', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		room.players[0].socketId = 'socket-123';
		const view = publicView(room);
		expect(view.players[0].socketId).toBeUndefined();
		expect(view.roomCode).toBe(room.roomCode);
		expect(view.board).toBeDefined();
		expect(view.tileState).toHaveLength(40);
	});

	it('caps actionLog at 200 entries', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		for (let i = 0; i < 300; i++) {
			appendLog(room, { kind: 'test', n: i });
		}
		const view = publicView(room);
		expect(view.actionLog.length).toBeLessThanOrEqual(200);
	});
});

describe('bumpVersion', () => {
	it('increments version and updates lastActivity', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		const v1 = room.version;
		bumpVersion(room);
		expect(room.version).toBe(v1 + 1);
		expect(room.lastActivity).toBeGreaterThan(0);
	});
});

describe('appendLog', () => {
	it('adds a log entry with id and timestamp', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		const entry = appendLog(room, { kind: 'roll', userId: 'host-1', dice: [3, 4] });
		expect(entry.id).toBeDefined();
		expect(entry.ts).toBeDefined();
		expect(entry.kind).toBe('roll');
		expect(room.actionLog).toHaveLength(1);
	});

	it('caps at 1000 entries', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		for (let i = 0; i < 1100; i++) {
			appendLog(room, { kind: 'test', n: i });
		}
		expect(room.actionLog.length).toBe(1000);
	});
});

describe('appendChat', () => {
	it('adds a chat message', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		const msg = appendChat(room, { userId: 'host-1', username: 'Alice', text: 'hello' });
		expect(msg.text).toBe('hello');
		expect(msg.system).toBe(false);
		expect(room.chat).toHaveLength(1);
	});

	it('adds system message', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		const msg = appendChat(room, {
			userId: null,
			username: 'System',
			text: 'Game started',
			system: true,
		});
		expect(msg.system).toBe(true);
		expect(msg.userId).toBeNull();
		expect(msg.username).toBe('System');
	});

	it('truncates text to 500 chars', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		const msg = appendChat(room, { userId: 'host-1', username: 'A', text: 'x'.repeat(600) });
		expect(msg.text.length).toBe(500);
	});

	it('caps at 500 messages', () => {
		const room = createRoom({ hostUserId: 'host-1', hostUsername: 'A', hostColor: '#EF4444' });
		for (let i = 0; i < 600; i++) {
			appendChat(room, { userId: 'host-1', username: 'A', text: `msg${i}` });
		}
		expect(room.chat.length).toBe(500);
	});
});

describe('TOKEN_COLORS', () => {
	it('has 19 colors', () => {
		expect(TOKEN_COLORS).toHaveLength(19);
	});

	it('each has id, hex, name', () => {
		for (const c of TOKEN_COLORS) {
			expect(c.id).toBeTruthy();
			expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
			expect(c.name).toBeTruthy();
		}
	});
});
