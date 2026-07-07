import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const { createRoom, activeRooms, deleteRoom } = require('../game/state');
const auction = require('../game/auction');

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

describe('startAuction', () => {
	it('starts an auction on an unowned property', () => {
		const room = makeRoom();
		const r = auction.startAuction(room, 1); // Cairo
		expect(r.ok).toBe(true);
		expect(room.auction).not.toBeNull();
		expect(room.auction.pos).toBe(1);
		expect(room.auction.currentBid).toBe(0);
		expect(room.auction.participants).toHaveLength(2);
		expect(room.turnPhase).toBe('auctioning');
	});

	it('rejects on already-owned property', () => {
		const room = makeRoom();
		room.tileState[1].owner = 'player-2';
		const r = auction.startAuction(room, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('already-owned');
	});

	it('rejects when auction already active', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		const r = auction.startAuction(room, 3);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('auction-busy');
	});

	it('excludes bankrupt players', () => {
		const room = makeRoom();
		room.players[1].bankrupt = true;
		const r = auction.startAuction(room, 1);
		expect(r.ok).toBe(true);
		expect(room.auction.participants).toEqual(['host-1']);
	});
});

describe('placeBid', () => {
	it('places a valid bid', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		const r = auction.placeBid(room, room.players[0], 20);
		expect(r.ok).toBe(true);
		expect(room.auction.currentBid).toBe(20);
		expect(room.auction.currentBidder).toBe('host-1');
	});

	it('rejects bid below minimum increment', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		const r = auction.placeBid(room, room.players[0], 5);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('below-min');
	});

	it('rejects when no auction active', () => {
		const room = makeRoom();
		const r = auction.placeBid(room, room.players[0], 20);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-auction');
	});

	it('rejects non-participant', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		const r = auction.placeBid(room, { userId: 'outsider', cash: 999 }, 20);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-participant');
	});

	it('rejects if already passed', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		auction.pass(room, room.players[0]);
		const r = auction.placeBid(room, room.players[0], 20);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('already-passed');
	});

	it('rejects if insufficient cash', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		room.players[0].cash = 5;
		const r = auction.placeBid(room, room.players[0], 100);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('insufficient');
	});
});

describe('pass', () => {
	it('player passes successfully', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		const r = auction.pass(room, room.players[0]);
		expect(r.ok).toBe(true);
	});

	it('rejects if not participant', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		const r = auction.pass(room, { userId: 'outsider' });
		expect(r.ok).toBe(false);
	});

	it('resolves auction when all pass (no bids)', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		auction.pass(room, room.players[0]);
		const r = auction.pass(room, room.players[1]);
		expect(r.ok).toBe(true);
		expect(room.auction).toBeNull();
	});

	it('resolves auction when all but top bidder pass', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		auction.placeBid(room, room.players[0], 100);
		const r = auction.pass(room, room.players[1]);
		expect(r.ok).toBe(true);
		expect(room.auction).toBeNull();
	});
});

describe('resolveAuction', () => {
	it('transfers property to highest bidder', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		auction.placeBid(room, room.players[0], 100);
		auction.pass(room, room.players[1]);
		expect(room.auction).toBeNull();
		expect(room.tileState[1].owner).toBe('host-1');
		expect(room.players[0].owned).toContain(1);
		expect(room.players[0].stats.auctionWins).toBe(1);
	});

	it('no winner if no bids placed', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		auction.pass(room, room.players[0]);
		auction.pass(room, room.players[1]);
		expect(room.turnPhase).not.toBe('auctioning');
	});

	it('returns error if no auction', () => {
		const room = makeRoom();
		const r = auction.resolveAuction(room);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-auction');
	});

	it('sets turnPhase to awaiting-roll after doubles', () => {
		const room = makeRoom();
		room.lastDice = [3, 3]; // doubles
		auction.startAuction(room, 1);
		auction.pass(room, room.players[0]);
		auction.pass(room, room.players[1]);
		expect(room.turnPhase).toBe('awaiting-roll');
	});

	it('sets turnPhase to awaiting-end-turn after non-doubles', () => {
		const room = makeRoom();
		room.lastDice = [2, 3]; // not doubles
		auction.startAuction(room, 1);
		auction.pass(room, room.players[0]);
		auction.pass(room, room.players[1]);
		expect(room.turnPhase).toBe('awaiting-end-turn');
	});

	it('sets awaiting-end-turn when active player is in jail', () => {
		const room = makeRoom();
		room.players[0].inJail = true;
		room.lastDice = [3, 3]; // doubles but jailed — no extra roll
		auction.startAuction(room, 1);
		auction.pass(room, room.players[0]);
		auction.pass(room, room.players[1]);
		expect(room.turnPhase).toBe('awaiting-end-turn');
	});
});

describe('maybeCloseOnTimeout', () => {
	it('returns null when no auction', () => {
		const room = makeRoom();
		expect(auction.maybeCloseOnTimeout(room)).toBeNull();
	});

	it('returns null before timeout', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		room.auction.endsAt = Date.now() + 5000;
		expect(auction.maybeCloseOnTimeout(room)).toBeNull();
	});

	it('resolves auction after timeout', () => {
		const room = makeRoom();
		auction.startAuction(room, 1);
		room.auction.endsAt = Date.now() - 1;
		const result = auction.maybeCloseOnTimeout(room);
		expect(result).not.toBeNull();
		expect(result.ok).toBe(true);
	});
});
