import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const { createRoom, activeRooms, deleteRoom } = require('../game/state');
const property = require('../game/property');

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

// ─── Mortgage ────────────────────────────────────────────────────────────────
describe('mortgage', () => {
	it('mortgages an owned unimproved property', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		p.owned.push(1);
		const cashBefore = p.cash;
		const r = property.mortgage(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].mortgaged).toBe(true);
		expect(p.cash).toBe(cashBefore + 30); // mortgage = floor(60/2) = 30
	});

	it('rejects if not owner', () => {
		const room = makeRoom();
		const r = property.mortgage(room, room.players[0], 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-owner');
	});

	it('rejects if already mortgaged', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		room.tileState[1].mortgaged = true;
		p.owned.push(1);
		const r = property.mortgage(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('already-mortgaged');
	});

	it('rejects property with houses (must sell first)', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		room.tileState[1].houses = 2;
		p.owned.push(1);
		const r = property.mortgage(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('sell-buildings-first');
	});

	it('rejects if any sibling in group has buildings', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		room.tileState[3].owner = p.userId;
		room.tileState[3].houses = 1;
		p.owned = [1, 3];
		const r = property.mortgage(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('group-has-buildings');
	});
});

// ─── Unmortgage ──────────────────────────────────────────────────────────────
describe('unmortgage', () => {
	it('unmortgages a property', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		room.tileState[1].mortgaged = true;
		p.owned.push(1);
		const cashBefore = p.cash;
		const r = property.unmortgage(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].mortgaged).toBe(false);
		expect(p.cash).toBe(cashBefore - Math.ceil(30 * 1.1));
	});

	it('rejects if not owner', () => {
		const room = makeRoom();
		const r = property.unmortgage(room, room.players[0], 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-owner');
	});

	it('rejects if not mortgaged', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		p.owned.push(1);
		const r = property.unmortgage(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-mortgaged');
	});

	it('rejects if insufficient funds', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 5;
		room.tileState[1].owner = p.userId;
		room.tileState[1].mortgaged = true;
		p.owned.push(1);
		const r = property.unmortgage(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('insufficient');
	});
});

// ─── Build house ─────────────────────────────────────────────────────────────
describe('buildHouse', () => {
	function giveMonopoly(room, p, group) {
		const tiles = room.board.tiles;
		for (let i = 0; i < 40; i++) {
			if (tiles[i].type === 'property' && tiles[i].group === group) {
				room.tileState[i].owner = p.userId;
				p.owned.push(i);
			}
		}
	}

	it('builds a house on a property in a full group', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].houses).toBe(1);
		expect(p.stats.housesBuilt).toBe(1);
		expect(room.bank.houses).toBe(31);
	});

	it('rejects if not owner', () => {
		const room = makeRoom();
		const r = property.buildHouse(room, room.players[0], 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-owner');
	});

	it('rejects non-property tiles', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[5].owner = p.userId;
		p.owned.push(5);
		const r = property.buildHouse(room, p, 5); // station, not buildable
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-buildable');
	});

	it('rejects mortgaged properties', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].mortgaged = true;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('mortgaged');
	});

	it('rejects if max built (hotel)', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 5;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('max-built');
	});

	it('rejects without monopoly', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		p.owned.push(1);
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-monopoly');
	});

	it('rejects group with mortgaged tiles (allowDevOnMortgaged=false)', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[3].mortgaged = true;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('group-has-mortgaged');
	});

	it('allows when group has mortgaged but rule allows it', () => {
		const room = makeRoom();
		room.rules.allowDevOnMortgaged = true;
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[3].mortgaged = true;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(true);
	});

	it('rejects uneven build (building on tile ahead of min)', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 1;
		// pos 3 has 0 houses, pos 1 has 1. Building on pos 1 would make it 2 vs 0 → uneven
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('uneven-build');
	});

	it('rejects if no houses in bank', () => {
		const room = makeRoom();
		room.bank.houses = 0;
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-houses');
	});

	it('rejects if no hotels in bank', () => {
		const room = makeRoom();
		room.bank.hotels = 0;
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 4;
		room.tileState[3].houses = 4;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-hotels');
	});

	it('rejects if insufficient cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 10;
		giveMonopoly(room, p, 'brown');
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('insufficient');
	});

	it('builds hotel (houses 4→5) and returns houses to bank', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 4;
		room.tileState[3].houses = 4;
		const bankHousesBefore = room.bank.houses;
		const bankHotelsBefore = room.bank.hotels;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].houses).toBe(5);
		expect(room.bank.houses).toBe(bankHousesBefore + 4);
		expect(room.bank.hotels).toBe(bankHotelsBefore - 1);
	});

	it('even build allowed (houses at same level)', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 1;
		room.tileState[3].houses = 1;
		const r = property.buildHouse(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].houses).toBe(2);
	});
});

// ─── Sell house ──────────────────────────────────────────────────────────────
describe('sellHouse', () => {
	function giveMonopoly(room, p, group) {
		const tiles = room.board.tiles;
		for (let i = 0; i < 40; i++) {
			if (tiles[i].type === 'property' && tiles[i].group === group) {
				room.tileState[i].owner = p.userId;
				p.owned.push(i);
			}
		}
	}

	it('sells a house for half price', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 2;
		room.tileState[3].houses = 1;
		const cashBefore = p.cash;
		const r = property.sellHouse(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].houses).toBe(1);
		expect(p.cash).toBe(cashBefore + 25); // 50/2 = 25
	});

	it('rejects if not owner', () => {
		const room = makeRoom();
		const r = property.sellHouse(room, room.players[0], 1);
		expect(r.ok).toBe(false);
	});

	it('rejects if no houses', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		const r = property.sellHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-houses');
	});

	it('rejects if uneven sell', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 1;
		room.tileState[3].houses = 2;
		const r = property.sellHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('uneven-sell');
	});

	it('demolishes hotel when houses=5', () => {
		const room = makeRoom();
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 5;
		const r = property.sellHouse(room, p, 1);
		expect(r.ok).toBe(true);
		expect(room.tileState[1].houses).toBe(4);
		expect(room.bank.hotels).toBe(13); // returned
		expect(room.bank.houses).toBe(28); // 32 - 4 given
	});

	it('rejects hotel demolish when no houses in bank', () => {
		const room = makeRoom();
		room.bank.houses = 2;
		const p = room.players[0];
		giveMonopoly(room, p, 'brown');
		room.tileState[1].houses = 5;
		const r = property.sellHouse(room, p, 1);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-houses-to-replace-hotel');
	});
});
