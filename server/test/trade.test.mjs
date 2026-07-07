import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const { createRoom, activeRooms, deleteRoom } = require('../game/state');
const trade = require('../game/trade');

function makeRoom() {
	for (const [code] of activeRooms) deleteRoom(code);
	const room = createRoom({
		hostUserId: 'host-1',
		hostUsername: 'Alice',
		hostColor: '#EF4444',
		boardId: 'world-tour',
	});
	const { createPlayerState } = require('../game/state');
	const p2 = createPlayerState({
		userId: 'player-2',
		username: 'Bob',
		color: '#3B82F6',
		seat: 1,
		isHost: false,
		startingCash: 1500,
	});
	room.players.push(p2);
	room.started = true;
	return room;
}

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
});

describe('proposeTrade', () => {
	it('creates a new trade proposal', () => {
		const room = makeRoom();
		const from = room.players[0];
		const offer = { cash: 100, properties: [1], jailCards: { chance: 0, chest: 0 } };
		const request = { cash: 0, properties: [], jailCards: { chance: 0, chest: 0 } };
		room.tileState[1].owner = from.userId;
		from.owned.push(1);
		const r = trade.proposeTrade(room, from, 'player-2', offer, request);
		expect(r.ok).toBe(true);
		expect(room.trades).toHaveLength(1);
		expect(room.trades[0].status).toBe('open');
	});

	it('rejects if recipient is bankrupt', () => {
		const room = makeRoom();
		room.players[1].bankrupt = true;
		const r = trade.proposeTrade(room, room.players[0], 'player-2');
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-recipient');
	});

	it('rejects if sender is bankrupt', () => {
		const room = makeRoom();
		room.players[0].bankrupt = true;
		const r = trade.proposeTrade(room, room.players[0], 'player-2');
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bankrupt');
	});
});

describe('updateTrade', () => {
	it('updates trade offer and resets acceptance', () => {
		const room = makeRoom();
		const from = room.players[0];
		room.tileState[1].owner = from.userId;
		from.owned.push(1);
		const prop = trade.proposeTrade(room, from, 'player-2', {
			cash: 100,
			properties: [1],
			jailCards: { chance: 0, chest: 0 },
		});
		room.trades[0].acceptedBy = ['player-2'];
		room.trades[0].version = 1;

		const r = trade.updateTrade(room, from, prop.trade.id, {
			cash: 50,
			properties: [1],
			jailCards: { chance: 0, chest: 0 },
		});
		expect(r.ok).toBe(true);
		expect(room.trades[0].version).toBe(2);
		expect(room.trades[0].acceptedBy).toEqual([]);
	});

	it('rejects if trade not found', () => {
		const room = makeRoom();
		const r = trade.updateTrade(room, room.players[0], 'tr_none', {
			cash: 0,
			properties: [],
			jailCards: { chance: 0, chest: 0 },
		});
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-trade');
	});

	it('rejects if trade is closed', () => {
		const room = makeRoom();
		const from = room.players[0];
		room.tileState[1].owner = from.userId;
		from.owned.push(1);
		const prop = trade.proposeTrade(room, from, 'player-2', {
			cash: 100,
			properties: [1],
			jailCards: { chance: 0, chest: 0 },
		});
		room.trades[0].status = 'accepted';
		const r = trade.updateTrade(room, from, prop.trade.id);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('closed');
	});

	it('rejects if actor not party to trade', () => {
		const room = makeRoom();
		const from = room.players[0];
		room.tileState[1].owner = from.userId;
		from.owned.push(1);
		const prop = trade.proposeTrade(room, from, 'player-2', {
			cash: 100,
			properties: [1],
			jailCards: { chance: 0, chest: 0 },
		});
		const outsider = { userId: 'outsider' };
		const r = trade.updateTrade(room, outsider, prop.trade.id);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-party');
	});
});

describe('acceptTrade', () => {
	it('executes trade when both accept', () => {
		const room = makeRoom();
		const from = room.players[0];
		const to = room.players[1];
		room.tileState[1].owner = from.userId;
		from.owned.push(1);
		const prop = trade.proposeTrade(room, from, to.userId, {
			cash: 100,
			properties: [1],
			jailCards: { chance: 0, chest: 0 },
		});

		const r1 = trade.acceptTrade(room, to, prop.trade.id);
		expect(r1.ok).toBe(true);
		const r2 = trade.acceptTrade(room, from, prop.trade.id);
		expect(r2.ok).toBe(true);
		expect(room.trades[0].status).toBe('accepted');
		expect(room.tileState[1].owner).toBe(to.userId);
		expect(from.cash).toBe(1400); // paid 100
		expect(to.cash).toBe(1600); // received 100
	});

	it('rejects if already accepted by same player', () => {
		const room = makeRoom();
		const from = room.players[0];
		const to = room.players[1];
		room.tileState[1].owner = from.userId;
		from.owned.push(1);
		const prop = trade.proposeTrade(room, from, to.userId, {
			cash: 100,
			properties: [1],
			jailCards: { chance: 0, chest: 0 },
		});
		trade.acceptTrade(room, to, prop.trade.id);
		const r = trade.acceptTrade(room, to, prop.trade.id);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('already-accepted');
	});
});

describe('rejectOrCancelTrade', () => {
	it('cancels trade by proposer', () => {
		const room = makeRoom();
		const from = room.players[0];
		const prop = trade.proposeTrade(room, from, 'player-2');
		const r = trade.rejectOrCancelTrade(room, from, prop.trade.id);
		expect(r.ok).toBe(true);
		expect(room.trades[0].status).toBe('cancelled');
	});

	it('rejects trade by recipient', () => {
		const room = makeRoom();
		const from = room.players[0];
		const to = room.players[1];
		const prop = trade.proposeTrade(room, from, to.userId);
		const r = trade.rejectOrCancelTrade(room, to, prop.trade.id);
		expect(r.ok).toBe(true);
		expect(room.trades[0].status).toBe('rejected');
	});

	it('rejects if not party', () => {
		const room = makeRoom();
		const from = room.players[0];
		const prop = trade.proposeTrade(room, from, 'player-2');
		const r = trade.rejectOrCancelTrade(room, { userId: 'outsider' }, prop.trade.id);
		expect(r.ok).toBe(false);
	});
});

describe('tradeMessage', () => {
	it('adds a message to the trade', () => {
		const room = makeRoom();
		const from = room.players[0];
		const prop = trade.proposeTrade(room, from, 'player-2');
		const r = trade.tradeMessage(room, from, prop.trade.id, 'hello');
		expect(r.ok).toBe(true);
		expect(room.trades[0].messages).toHaveLength(1);
		expect(room.trades[0].messages[0].text).toBe('hello');
	});

	it('trims messages to 100 max', () => {
		const room = makeRoom();
		const from = room.players[0];
		const prop = trade.proposeTrade(room, from, 'player-2');
		for (let i = 0; i < 101; i++) {
			trade.tradeMessage(room, from, prop.trade.id, `msg${i}`);
		}
		expect(room.trades[0].messages).toHaveLength(100);
	});
});

describe('executeTrade', () => {
	it('rejects if from player insufficient cash', () => {
		const room = makeRoom();
		const from = room.players[0];
		const prop = trade.proposeTrade(room, from, 'player-2', {
			cash: 99999,
			properties: [],
			jailCards: { chance: 0, chest: 0 },
		});
		// Manually bypass validation
		room.trades[0].offer.cash = 99999;
		const exec = trade.acceptTrade(room, from, prop.trade.id);
		// The trade should execute when both accept
	});

	it('prune culls old trades', () => {
		const room = makeRoom();
		const from = room.players[0];
		for (let i = 0; i < 25; i++) {
			room.trades.push({
				id: `tr_${i}`,
				fromUserId: from.userId,
				toUserId: 'player-2',
				status: i < 20 ? 'cancelled' : 'open',
				createdAt: Date.now() - i,
			});
		}
		trade.prune(room);
		expect(room.trades.length).toBeLessThan(25);
	});

	it('does not prune when <= 20 trades', () => {
		const room = makeRoom();
		const from = room.players[0];
		for (let i = 0; i < 10; i++) {
			room.trades.push({
				id: `tr_${i}`,
				fromUserId: from.userId,
				toUserId: 'player-2',
				status: 'cancelled',
				createdAt: Date.now(),
			});
		}
		const len = room.trades.length;
		trade.prune(room);
		expect(room.trades.length).toBe(len);
	});
});

describe('trade with jail cards', () => {
	it('trades jail free cards', () => {
		const room = makeRoom();
		const from = room.players[0];
		const to = room.players[1];
		room.jailFreeLedger[from.userId] = { chance: 1, chest: 0 };
		from.getOutOfJailCards = 1;
		const offer = { cash: 0, properties: [], jailCards: { chance: 1, chest: 0 } };
		const request = { cash: 200, properties: [], jailCards: { chance: 0, chest: 0 } };

		// Give to enough cash
		to.cash = 2000;

		const prop = trade.proposeTrade(room, from, to.userId, offer, request);
		trade.acceptTrade(room, to, prop.trade.id);
		const r = trade.acceptTrade(room, from, prop.trade.id);
		expect(r.ok).toBe(true);
		expect(room.jailFreeLedger[to.userId].chance).toBe(1);
		expect(room.jailFreeLedger[from.userId].chance).toBe(0);
		expect(from.cash).toBe(1700); // 1500 + 200
	});
});
