import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const engine = require('../game/engine');
const { createRoom, createPlayerState, activeRooms, deleteRoom } = require('../game/state');

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
		isHost: false,
		startingCash: room.rules.startingCash,
	});
	room.players.push(p2);
	room.started = true;
	room.turnPhase = 'awaiting-roll';
	return room;
}

function addPlayer(room, id, name, color = '#10B981') {
	const p = createPlayerState({
		userId: id,
		username: name,
		color,
		seat: room.players.length,
		startingCash: room.rules.startingCash,
	});
	room.players.push(p);
	return p;
}

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
});

// ─── Dice ────────────────────────────────────────────────────────────────────
describe('dice', () => {
	it('rollDie returns 1-6', () => {
		for (let i = 0; i < 200; i++) {
			const d = engine.rollDie();
			expect(d).toBeGreaterThanOrEqual(1);
			expect(d).toBeLessThanOrEqual(6);
		}
	});

	it('rollDice returns two 1-6 values', () => {
		for (let i = 0; i < 200; i++) {
			const [a, b] = engine.rollDice();
			expect(a).toBeGreaterThanOrEqual(1);
			expect(a).toBeLessThanOrEqual(6);
			expect(b).toBeGreaterThanOrEqual(1);
			expect(b).toBeLessThanOrEqual(6);
		}
	});
});

// ─── Transfer ────────────────────────────────────────────────────────────────
describe('transfer', () => {
	it('transfers money from a player to the bank', () => {
		const room = makeRoom();
		const p = room.players[0];
		const r = engine.transfer(room, p.userId, 'bank', 500, 'test');
		expect(r.ok).toBe(true);
		expect(p.cash).toBe(1000);
		expect(p.stats.moneySpent).toBe(500);
		expect(r.events).toHaveLength(1);
		expect(r.events[0].type).toBe('money');
	});

	it('transfers money from the bank to a player', () => {
		const room = makeRoom();
		const p = room.players[0];
		const r = engine.transfer(room, 'bank', p.userId, 200, 'salary');
		expect(r.ok).toBe(true);
		expect(p.cash).toBe(1700);
		expect(p.stats.moneyEarned).toBe(200);
	});

	it('allows negative balance (goes into debt)', () => {
		const room = makeRoom();
		const p = room.players[0];
		const cashBefore = p.cash;
		const r = engine.transfer(room, p.userId, 'bank', 99999, 'test');
		expect(r.ok).toBe(true);
		expect(p.cash).toBe(cashBefore - 99999);
		expect(p.cash).toBeLessThan(0);
	});

	it('rejects transfer from unknown player', () => {
		const room = makeRoom();
		const r = engine.transfer(room, 'ghost', 'bank', 100, 'test');
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-from');
	});

	it('rejects transfer to unknown player', () => {
		const room = makeRoom();
		const r = engine.transfer(room, 'bank', 'ghost', 100, 'test');
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-to');
	});

	it('transfer amount <= 0 is a no-op', () => {
		const room = makeRoom();
		const r = engine.transfer(room, 'bank', room.players[0].userId, 0, 'test');
		expect(r.ok).toBe(true);
		expect(r.events).toHaveLength(0);
	});

	it('transfers to/from parking pot', () => {
		const room = makeRoom();
		room.parkingPot = 100;
		const r = engine.transfer(room, 'pot', room.players[1].userId, 100, 'parking');
		expect(r.ok).toBe(true);
		expect(room.parkingPot).toBe(0);
		expect(room.players[1].cash).toBe(1600);
	});

	it('transfers from player to pot', () => {
		const room = makeRoom();
		const p = room.players[0];
		const r = engine.transfer(room, p.userId, 'pot', 100, 'tax');
		expect(r.ok).toBe(true);
		expect(room.parkingPot).toBe(100);
		expect(p.cash).toBe(1400);
	});
});

// ─── Ownership helpers ───────────────────────────────────────────────────────
describe('ownership helpers', () => {
	it('ownedInGroup counts properties in a color group', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1, 3];
		expect(engine.ownedInGroup(room, p, 'brown')).toBe(2);
	});

	it('ownedInGroup returns 0 for empty group', () => {
		const room = makeRoom();
		const p = room.players[0];
		expect(engine.ownedInGroup(room, p, 'brown')).toBe(0);
	});

	it('ownsFullGroup returns true when player owns entire group', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1, 3];
		expect(engine.ownsFullGroup(room, p, 'brown')).toBe(true);
	});

	it('ownsFullGroup returns false for partial group', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1];
		expect(engine.ownsFullGroup(room, p, 'brown')).toBe(false);
	});

	it('ownedStations counts stations correctly', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [5, 15, 25, 35];
		expect(engine.ownedStations(room, p)).toBe(4);
	});

	it('ownedStations returns 0 when none owned', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1, 3];
		expect(engine.ownedStations(room, p)).toBe(0);
	});

	it('ownedUtilities counts utilities', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [12, 28];
		expect(engine.ownedUtilities(room, p)).toBe(2);
	});

	it('tileDef returns tile definition', () => {
		const room = makeRoom();
		expect(engine.tileDef(room, 0).type).toBe('go');
		expect(engine.tileDef(room, 1).type).toBe('property');
	});

	it('tileSt returns tile state', () => {
		const room = makeRoom();
		room.tileState[1].owner = 'host-1';
		expect(engine.tileSt(room, 1).owner).toBe('host-1');
	});
});

// ─── Rent calculation ────────────────────────────────────────────────────────
describe('rentOwed', () => {
	it('returns 0 for unowned property', () => {
		const room = makeRoom();
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(0);
	});

	it('returns base rent for owned property without houses', () => {
		const room = makeRoom();
		room.tileState[1].owner = room.players[1].userId;
		room.players[1].owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(2);
	});

	it('returns double base rent for full color group without houses', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[1].owner = p.userId;
		room.tileState[3].owner = p.userId;
		p.owned = [1, 3];
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(4);
	});

	it('returns house rent for property with houses', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[1].owner = p.userId;
		room.tileState[1].houses = 2;
		p.owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(30);
	});

	it('returns hotel rent (houses=5)', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[1].owner = p.userId;
		room.tileState[1].houses = 5;
		p.owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(250);
	});

	it('returns 0 for mortgaged property', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[1].owner = p.userId;
		room.tileState[1].mortgaged = true;
		p.owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(0);
	});

	it('returns 0 when owner is bankrupt', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[1].owner = p.userId;
		p.bankrupt = true;
		p.owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(0);
	});

	it('returns 0 when noRentInJail and owner is jailed', () => {
		const room = makeRoom();
		room.rules.noRentInJail = true;
		const p = room.players[1];
		room.tileState[1].owner = p.userId;
		p.inJail = true;
		p.owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4])).toBe(0);
	});

	it('computes station rent tiers correctly', () => {
		const room = makeRoom();
		const p = room.players[1];
		p.owned = [5];
		room.tileState[5].owner = p.userId;
		expect(engine.rentOwed(room, 5, [3, 4])).toBe(25);

		p.owned = [5, 15];
		room.tileState[15].owner = p.userId;
		expect(engine.rentOwed(room, 5, [3, 4])).toBe(50);

		p.owned = [5, 15, 25];
		room.tileState[25].owner = p.userId;
		expect(engine.rentOwed(room, 5, [3, 4])).toBe(100);

		p.owned = [5, 15, 25, 35];
		room.tileState[35].owner = p.userId;
		expect(engine.rentOwed(room, 5, [3, 4])).toBe(200);
	});

	it('computes utility rent: 1 = 4x dice, 2 = 10x dice', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[12].owner = p.userId;
		p.owned.push(12);
		expect(engine.rentOwed(room, 12, [3, 4])).toBe(28);

		p.owned.push(28);
		room.tileState[28].owner = p.userId;
		expect(engine.rentOwed(room, 12, [3, 4])).toBe(70);
	});

	it('rentMultOverride applies for stations and properties', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[5].owner = p.userId;
		p.owned.push(5);
		expect(engine.rentOwed(room, 5, [3, 4], 2)).toBe(50);

		room.tileState[1].owner = p.userId;
		p.owned.push(1);
		expect(engine.rentOwed(room, 1, [3, 4], 2)).toBe(4);
	});

	it('returns 0 for non-buyable tiles (GO, jail, etc.)', () => {
		const room = makeRoom();
		// Set an owner on GO to bypass the early !st.owner check and
		// reach the default return 0 at the end of rentOwed.
		room.tileState[0].owner = room.players[0].userId;
		room.players[0].owned.push(0);
		expect(engine.rentOwed(room, 0, [3, 4])).toBe(0);
	});
});

// ─── Roll and move ───────────────────────────────────────────────────────────
describe('rollAndMove', () => {
	it('rejects roll when not in rolling phase', () => {
		const room = makeRoom();
		room.turnPhase = 'buying';
		const r = engine.rollAndMove(room, room.players[0]);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-your-turn-to-roll');
	});

	it('succeeds, records dice, and enters a valid post-roll phase', () => {
		const room = makeRoom();
		const p = room.players[0];
		const r = engine.rollAndMove(room, p);
		expect(r.ok).toBe(true);
		expect(room.lastDice).toHaveLength(2);
		expect(room.lastDiceRoller).toBe(p.userId);
		expect(p.hasRolled).toBe(true);
		// Phase is a valid post-roll state
		expect([
			'awaiting-roll',
			'awaiting-end-turn',
			'buying',
			'auctioning',
			'resolving',
		]).toContain(room.turnPhase);
	});

	it('succeeds from rolling phase too', () => {
		const room = makeRoom();
		room.turnPhase = 'rolling';
		const p = room.players[0];
		const r = engine.rollAndMove(room, p);
		expect(r.ok).toBe(true);
	});

	it('records roll in action log', () => {
		const room = makeRoom();
		const p = room.players[0];
		engine.rollAndMove(room, p);
		const rolls = room.actionLog.filter((e) => e.kind === 'roll');
		expect(rolls.length).toBeGreaterThan(0);
	});

	it('handles in-jail player consistently', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.inJail = true;
		p.position = 10;
		const r = engine.rollAndMove(room, p);
		expect(r.ok).toBe(true);
		expect(room.turnPhase).toBe('awaiting-end-turn');
		// Either escaped or still jailed, both are valid
		if (!p.inJail) expect(p.position).not.toBe(10);
		if (p.inJail) expect(p.position).toBe(10);
	});
});

// ─── Pay jail fine ───────────────────────────────────────────────────────────
describe('payJailFine', () => {
	it('pays fine and releases from jail', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.inJail = true;
		p.position = 10;
		const r = engine.payJailFine(room, p);
		expect(r.ok).toBe(true);
		expect(p.inJail).toBe(false);
		expect(p.cash).toBe(1450);
	});

	it('rejects if not in jail', () => {
		const room = makeRoom();
		const r = engine.payJailFine(room, room.players[0]);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-in-jail');
	});

	it('allows paying fine even with insufficient funds (goes negative)', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.inJail = true;
		p.cash = 10;
		const r = engine.payJailFine(room, p);
		expect(r.ok).toBe(true);
		expect(p.cash).toBeLessThan(0);
		expect(p.inJail).toBe(false);
	});
});

// ─── Use jail card ───────────────────────────────────────────────────────────
describe('useJailCard', () => {
	it('uses a chance jail free card to escape', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.inJail = true;
		room.jailFreeLedger[p.userId] = { chance: 1, chest: 0 };
		p.getOutOfJailCards = 1;
		const r = engine.useJailCard(room, p);
		expect(r.ok).toBe(true);
		expect(p.inJail).toBe(false);
		expect(room.jailFreeLedger[p.userId].chance).toBe(0);
	});

	it('uses chest card when no chance cards', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.inJail = true;
		room.jailFreeLedger[p.userId] = { chance: 0, chest: 1 };
		p.getOutOfJailCards = 1;
		const r = engine.useJailCard(room, p);
		expect(r.ok).toBe(true);
		expect(p.inJail).toBe(false);
		expect(room.jailFreeLedger[p.userId].chest).toBe(0);
	});

	it('rejects if not in jail', () => {
		const room = makeRoom();
		const r = engine.useJailCard(room, room.players[0]);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-in-jail');
	});

	it('rejects if no cards', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.inJail = true;
		const r = engine.useJailCard(room, p);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('no-card');
	});
});

// ─── Buy current ─────────────────────────────────────────────────────────────
describe('buyCurrent', () => {
	it('buys the current property', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		room.turnPhase = 'buying';
		const r = engine.buyCurrent(room, p);
		expect(r.ok).toBe(true);
		expect(p.owned).toContain(1);
		expect(p.cash).toBe(1440);
		expect(p.stats.propertiesBought).toBe(1);
		expect(room.tileState[1].owner).toBe(p.userId);
	});

	it('rejects if not in buying phase', () => {
		const room = makeRoom();
		room.turnPhase = 'awaiting-roll';
		const r = engine.buyCurrent(room, room.players[0]);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('not-buyable');
	});

	it('rejects if already owned', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		room.tileState[1].owner = p.userId;
		room.turnPhase = 'buying';
		const r = engine.buyCurrent(room, p);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('already-owned');
	});

	it('rejects if insufficient cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 37;
		p.cash = 100;
		room.turnPhase = 'buying';
		const r = engine.buyCurrent(room, p);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('insufficient');
	});

	it('buys a station', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 5;
		room.turnPhase = 'buying';
		const r = engine.buyCurrent(room, p);
		expect(r.ok).toBe(true);
		expect(p.owned).toContain(5);
		expect(room.tileState[5].owner).toBe(p.userId);
	});

	it('buys a utility', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 12;
		room.turnPhase = 'buying';
		const r = engine.buyCurrent(room, p);
		expect(r.ok).toBe(true);
		expect(p.owned).toContain(12);
	});
});

// ─── Decline buy ─────────────────────────────────────────────────────────────
describe('declineBuy', () => {
	it('starts auction when auctionUnbought is true', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		room.turnPhase = 'buying';
		room.rules.auctionUnbought = true;
		const r = engine.declineBuy(room, p);
		expect(r.ok).toBe(true);
		expect(room.auction).not.toBeNull();
		expect(room.turnPhase).toBe('auctioning');
	});

	it('skips auction when auctionUnbought is false', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		room.turnPhase = 'buying';
		room.rules.auctionUnbought = false;
		const r = engine.declineBuy(room, p);
		expect(r.ok).toBe(true);
		expect(room.auction).toBeNull();
	});

	it('rejects outside buying phase', () => {
		const room = makeRoom();
		room.turnPhase = 'awaiting-roll';
		const r = engine.declineBuy(room, room.players[0]);
		expect(r.ok).toBe(false);
	});
});

// ─── End turn ────────────────────────────────────────────────────────────────
describe('endTurn', () => {
	it('advances to next player', () => {
		const room = makeRoom();
		room.turnPhase = 'awaiting-end-turn';
		const r = engine.endTurn(room, room.players[0]);
		expect(r.ok).toBe(true);
		expect(room.turnIndex).toBe(1);
		expect(room.turnPhase).toBe('awaiting-roll');
		expect(room.players[0].stats.turnsPlayed).toBe(1);
	});

	it('wraps around from last to first', () => {
		const room = makeRoom();
		room.turnIndex = 1;
		room.turnPhase = 'awaiting-end-turn';
		const r = engine.endTurn(room, room.players[1]);
		expect(r.ok).toBe(true);
		expect(room.turnIndex).toBe(0);
	});

	it('skips bankrupt players', () => {
		const room = makeRoom();
		addPlayer(room, 'player-3', 'Charlie');
		room.players[1].bankrupt = true;
		room.turnIndex = 0;
		room.turnPhase = 'awaiting-end-turn';
		const r = engine.endTurn(room, room.players[0]);
		expect(r.ok).toBe(true);
		expect(room.turnIndex).toBe(2);
	});

	it('declares victory when only one non-bankrupt remains', () => {
		const room = makeRoom();
		addPlayer(room, 'player-3', 'Charlie');
		room.players[0].bankrupt = true;
		room.players[2].bankrupt = true;
		room.turnIndex = 1;
		room.turnPhase = 'awaiting-end-turn';
		const r = engine.endTurn(room, room.players[1]);
		expect(r.ok).toBe(true);
		expect(room.ended).toBe(true);
		expect(room.winnerUserId).toBe(room.players[1].userId);
	});

	it('no victory with solo player', () => {
		const room = makeRoom();
		room.players = [room.players[0]];
		room.turnPhase = 'awaiting-end-turn';
		const r = engine.endTurn(room, room.players[0]);
		expect(r.ok).toBe(true);
		expect(room.ended).toBe(false);
	});

	it.each(['auctioning', 'trading', 'buying'])('rejects end turn in %s phase', (phase) => {
		const room = makeRoom();
		room.turnPhase = phase;
		const r = engine.endTurn(room, room.players[0]);
		expect(r.ok).toBe(false);
	});

	it('rejects end turn when player has negative cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = -50;
		room.turnPhase = 'awaiting-end-turn';
		const r = engine.endTurn(room, p);
		expect(r.ok).toBe(false);
		expect(r.error).toBe('resolve-debt-first');
	});

	it('resets doubles and hasRolled', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.doublesThisTurn = 2;
		p.hasRolled = true;
		room.turnPhase = 'awaiting-end-turn';
		engine.endTurn(room, p);
		expect(p.doublesThisTurn).toBe(0);
		expect(p.hasRolled).toBe(false);
	});

	it('clears pendingDebt', () => {
		const room = makeRoom();
		room.pendingDebt = { userId: 'host-1', creditor: 'bank', amount: 100 };
		room.turnPhase = 'awaiting-end-turn';
		engine.endTurn(room, room.players[0]);
		expect(room.pendingDebt).toBeNull();
	});
});

// ─── Bankruptcy ──────────────────────────────────────────────────────────────
describe('declareBankruptcy', () => {
	it('liquidates all assets to bank', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1, 3];
		room.tileState[1].owner = p.userId;
		room.tileState[3].owner = p.userId;
		room.tileState[1].houses = 2;

		const r = engine.declareBankruptcy(room, p);
		expect(r.ok).toBe(true);
		expect(p.bankrupt).toBe(true);
		expect(p.owned).toEqual([]);
		expect(p.cash).toBe(0);
		expect(room.tileState[1].owner).toBeNull();
		expect(room.tileState[1].houses).toBe(0);
		expect(room.tileState[1].mortgaged).toBe(false);
	});

	it('returns houses/hotel to bank', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1];
		room.tileState[1].owner = p.userId;
		room.tileState[1].houses = 5;
		const hBefore = room.bank.houses;
		const hoBefore = room.bank.hotels;
		engine.declareBankruptcy(room, p);
		expect(room.bank.hotels).toBe(hoBefore + 1);
		expect(room.bank.houses).toBe(hBefore + 4);
	});

	it('transfers assets to creditor player', () => {
		const room = makeRoom();
		const debtor = room.players[0];
		const creditor = room.players[1];
		debtor.owned = [1];
		room.tileState[1].owner = debtor.userId;
		debtor.cash = 300;

		const r = engine.declareBankruptcy(room, debtor, creditor.userId);
		expect(r.ok).toBe(true);
		expect(creditor.owned).toContain(1);
		expect(creditor.cash).toBe(1800);
		expect(room.tileState[1].owner).toBe(creditor.userId);
	});

	it('returns jail free cards to bottom of deck', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.jailFreeLedger[p.userId] = { chance: 1, chest: 1 };
		p.getOutOfJailCards = 2;
		engine.declareBankruptcy(room, p);
		expect(p.getOutOfJailCards).toBe(0);
	});

	it('rejects if already bankrupt', () => {
		const room = makeRoom();
		room.players[0].bankrupt = true;
		const r = engine.declareBankruptcy(room, room.players[0]);
		expect(r.ok).toBe(false);
	});
});

// ─── Movement ────────────────────────────────────────────────────────────────
describe('movement', () => {
	it('advanceTo moves player and pays salary when passing GO', () => {
		const room = makeRoom();
		const p = room.players[1];
		p.position = 39;
		engine.advanceTo(room, p, 5, { passGo: true });
		expect(p.position).toBe(5);
		expect(p.cash).toBe(1700); // 1500 + 200 salary
	});

	it('advanceTo wraps and pays GO salary', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 30;
		engine.advanceTo(room, p, 10, { passGo: true });
		expect(p.position).toBe(10);
		expect(p.cash).toBe(1700); // passed GO
	});

	it('advanceTo doubleOnGo for exact GO landing', () => {
		const room = makeRoom();
		room.rules.doubleOnGo = true;
		const p = room.players[0];
		p.position = 39;
		engine.advanceTo(room, p, 0, { passGo: true });
		expect(p.position).toBe(0);
		expect(p.cash).toBe(1900);
	});

	it('advanceTo with passGo=false does not pay', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 39;
		const cashBefore = p.cash;
		engine.advanceTo(room, p, 0, { passGo: false });
		expect(p.position).toBe(0);
		expect(p.cash).toBe(cashBefore);
	});

	it('sendToJail moves to tile 10 and sets jail state', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 30;
		const events = engine.sendToJail(room, p);
		expect(p.position).toBe(10);
		expect(p.inJail).toBe(true);
		expect(p.jailTurns).toBe(0);
		expect(p.doublesThisTurn).toBe(0);
		expect(events.some((e) => e.type === 'jail')).toBe(true);
	});

	it('advanceTo emits move event with correct path', () => {
		const room = makeRoom();
		const p = room.players[0];
		const events = engine.advanceTo(room, p, 3);
		const moveEvent = events.find((e) => e.type === 'move');
		expect(moveEvent).toBeDefined();
		expect(moveEvent.from).toBe(0);
		expect(moveEvent.to).toBe(3);
		expect(moveEvent.userId).toBe(p.userId);
		expect(moveEvent.path).toHaveLength(3);
	});
});

// ─── Tile landing resolution ─────────────────────────────────────────────────
describe('resolveLanding', () => {
	it('GO tile has no effect on phase', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 0;
		room.turnPhase = 'moving';
		engine.resolveLanding(room, p, [2, 3]);
		expect(room.turnPhase).toBe('moving');
	});

	it('unowned property sets buying phase', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		room.turnPhase = 'moving';
		const events = engine.resolveLanding(room, p, [2, 3]);
		expect(room.turnPhase).toBe('buying');
		expect(events.some((e) => e.type === 'offer-buy')).toBe(true);
	});

	it('unowned station sets buying phase', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 5;
		room.turnPhase = 'moving';
		engine.resolveLanding(room, p, [2, 3]);
		expect(room.turnPhase).toBe('buying');
	});

	it('own property triggers nothing', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		room.tileState[1].owner = p.userId;
		p.owned.push(1);
		room.turnPhase = 'moving';
		const events = engine.resolveLanding(room, p, [2, 3]);
		expect(events.filter((e) => e.type === 'offer-buy')).toHaveLength(0);
	});

	it('mortgaged property pays no rent', () => {
		const room = makeRoom();
		const p = room.players[0];
		const owner = room.players[1];
		p.position = 1;
		room.tileState[1].owner = owner.userId;
		room.tileState[1].mortgaged = true;
		owner.owned.push(1);
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore);
	});

	it('owned property pays rent', () => {
		const room = makeRoom();
		const p = room.players[0];
		const owner = room.players[1];
		p.position = 1;
		room.tileState[1].owner = owner.userId;
		owner.owned.push(1);
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore - 2);
		expect(owner.cash).toBe(1502);
	});

	it('no rent when jailed owner and noRentInJail', () => {
		const room = makeRoom();
		room.rules.noRentInJail = true;
		const p = room.players[0];
		const owner = room.players[1];
		p.position = 1;
		room.tileState[1].owner = owner.userId;
		owner.inJail = true;
		owner.owned.push(1);
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore);
	});

	it('tax tile pays to bank', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 4;
		room.rules.freeParkingPot = false;
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore - 200);
	});

	it('tax tile pays to pot when freeParkingPot enabled', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 4;
		room.rules.freeParkingPot = true;
		room.turnPhase = 'moving';
		engine.resolveLanding(room, p, [2, 3]);
		expect(room.parkingPot).toBe(200);
	});

	it('Go to Jail sends player to jail', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 30;
		room.turnPhase = 'moving';
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.inJail).toBe(true);
		expect(p.position).toBe(10);
	});

	it('Free Parking collects pot', () => {
		const room = makeRoom();
		room.rules.freeParkingPot = true;
		room.parkingPot = 500;
		const p = room.players[0];
		p.position = 20;
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore + 500);
		expect(room.parkingPot).toBe(0);
	});

	it('Free Parking with empty/disabled pot does nothing', () => {
		const room = makeRoom();
		room.rules.freeParkingPot = false;
		room.parkingPot = 500;
		const p = room.players[0];
		p.position = 20;
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore);
	});

	it('chance/chest draws card', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 7;
		room.turnPhase = 'moving';
		const events = engine.resolveLanding(room, p, [2, 3]);
		expect(events.some((e) => e.type === 'draw-card')).toBe(true);
	});

	it('chainedFromCard prevents re-drawing card', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 7;
		room.turnPhase = 'moving';
		const events = engine.resolveLanding(room, p, [2, 3], { chainedFromCard: true });
		expect(events).toHaveLength(0);
	});

	it('allows rent transfer even with insufficient funds (negative balance)', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 0;
		const owner = room.players[1];
		room.tileState[1].owner = owner.userId;
		owner.owned.push(1);
		const rent = engine.rentOwed(room, 1, [2, 3]);
		expect(rent).toBeGreaterThan(0);
		const r = engine.transfer(room, p.userId, owner.userId, rent, 'rent');
		expect(r.ok).toBe(true);
		expect(p.cash).toBeLessThan(0);
		expect(owner.cash).toBeGreaterThan(1500);
	});

	it('allows tax transfer even with insufficient funds (negative balance)', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 0;
		const r = engine.transfer(room, p.userId, 'bank', 200, 'tax');
		expect(r.ok).toBe(true);
		expect(p.cash).toBeLessThan(0);
	});
});

// ─── Card drawing ────────────────────────────────────────────────────────────
describe('drawCard', () => {
	it('drawCard returns valid chance card', () => {
		const room = makeRoom();
		const card = engine.drawCard(room, 'chance', room.players[0]);
		expect(card).not.toBeNull();
		expect(card.deck).toBe('chance');
		expect(card.id).toBeTruthy();
	});

	it('drawCard returns chest card', () => {
		const room = makeRoom();
		const card = engine.drawCard(room, 'chest', room.players[0]);
		expect(card.deck).toBe('chest');
	});

	it('reshuffles discard when draw empty', () => {
		const room = makeRoom();
		const ids = [...room.chanceDeck.draw];
		room.chanceDeck.discard = ids;
		room.chanceDeck.draw = [];
		const card = engine.drawCard(room, 'chance', room.players[0]);
		expect(card).not.toBeNull();
		expect(card.deck).toBe('chance');
	});

	it('excludes held jail-free from reshuffle', () => {
		const room = makeRoom();
		room.jailFreeLedger['host-1'] = { chance: 1, chest: 0 };
		const allIds = [...room.chanceDeck.draw];
		room.chanceDeck.discard = allIds;
		room.chanceDeck.draw = [];
		const drawn = new Set();
		for (let i = 0; i < 15; i++) {
			const card = engine.drawCard(room, 'chance', room.players[0]);
			drawn.add(card.id);
		}
		expect(drawn.has('ch_jail_free')).toBe(false);
	});
});

// ─── Card effects ────────────────────────────────────────────────────────────
describe('applyCardEffect', () => {
	it('money (positive) adds cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = { id: 'x', deck: 'chance', effect: { kind: 'money', amount: 50 }, text: 't' };
		const { reland } = engine.applyCardEffect(room, p, card);
		expect(p.cash).toBe(1550);
		expect(reland).toBe(false);
	});

	it('money (negative) deducts cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = { id: 'x', deck: 'chance', effect: { kind: 'money', amount: -15 }, text: 't' };
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBeLessThan(1500);
	});

	it('moneyAll (positive) collects from each opponent', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = {
			id: 'x',
			deck: 'chest',
			effect: { kind: 'moneyAll', amount: 10 },
			text: 't',
		};
		const cashBeforeP2 = room.players[1].cash;
		engine.applyCardEffect(room, p, card);
		expect(room.players[1].cash).toBe(cashBeforeP2 - 10);
		expect(p.cash).toBe(1510);
	});

	it('moneyAll (negative) pays each opponent', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moneyAll', amount: -50 },
			text: 't',
		};
		const cashBefore = p.cash;
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBeLessThan(cashBefore);
		expect(room.players[1].cash).toBe(1550);
	});

	it('moneyAll skips bankrupt players', () => {
		const room = makeRoom();
		room.players[1].bankrupt = true;
		const p = room.players[0];
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moneyAll', amount: -50 },
			text: 't',
		};
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBe(1500);
	});

	it('moveTo repositions and triggers reland', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moveTo', pos: 0, passGo: true },
			text: 't',
		};
		const { reland } = engine.applyCardEffect(room, p, card);
		expect(p.position).toBe(0);
		expect(reland).toBe(true);
	});

	it('moveBy repositions and triggers reland', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 5;
		const card = { id: 'x', deck: 'chance', effect: { kind: 'moveBy', delta: -3 }, text: 't' };
		const { reland } = engine.applyCardEffect(room, p, card);
		expect(p.position).toBe(2);
		expect(reland).toBe(true);
	});

	it('goToJail sends to jail', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = { id: 'x', deck: 'chance', effect: { kind: 'goToJail' }, text: 't' };
		const { reland } = engine.applyCardEffect(room, p, card);
		expect(p.inJail).toBe(true);
		expect(reland).toBe(false);
	});

	it('jailFree grants card', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = { id: 'x', deck: 'chance', effect: { kind: 'jailFree' }, text: 't' };
		engine.applyCardEffect(room, p, card);
		expect(p.getOutOfJailCards).toBe(1);
		expect(room.jailFreeLedger[p.userId].chance).toBe(1);
	});

	it('repairs charges per house/hotel', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1];
		room.tileState[1].owner = p.userId;
		room.tileState[1].houses = 3;
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'repairs', perHouse: 25, perHotel: 100 },
			text: 't',
		};
		const cashBefore = p.cash;
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBe(cashBefore - 75);
	});

	it('repairs with hotel counts as 1 hotel', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.owned = [1];
		room.tileState[1].owner = p.userId;
		room.tileState[1].houses = 5;
		const card = {
			id: 'x',
			deck: 'chest',
			effect: { kind: 'repairs', perHouse: 40, perHotel: 115 },
			text: 't',
		};
		const cashBefore = p.cash;
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBe(cashBefore - 115);
	});

	it('repairs charges 0 when no buildings', () => {
		const room = makeRoom();
		const p = room.players[0];
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'repairs', perHouse: 25, perHotel: 100 },
			text: 't',
		};
		const cashBefore = p.cash;
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBe(cashBefore);
	});

	it('moveToNearest station finds correct tile', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 2;
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moveToNearest', target: 'station', rentMult: 2 },
			text: 't',
		};
		engine.applyCardEffect(room, p, card);
		expect(p.position).toBe(5);
	});

	it('moveToNearest utility from pos 10 finds pos 12', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 10;
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moveToNearest', target: 'utility', rentMult: 10 },
			text: 't',
		};
		engine.applyCardEffect(room, p, card);
		expect(p.position).toBe(12);
	});

	it('moveToNearest wraps around board', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 36;
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moveToNearest', target: 'station', rentMult: 2 },
			text: 't',
		};
		engine.applyCardEffect(room, p, card);
		expect(p.position).toBe(5);
	});

	it('moveToNearest charges rent when owned', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 2;
		const owner = room.players[1];
		room.tileState[5].owner = owner.userId;
		owner.owned.push(5);
		const card = {
			id: 'x',
			deck: 'chance',
			effect: { kind: 'moveToNearest', target: 'station', rentMult: 2 },
			text: 't',
		};
		const cashBefore = p.cash;
		engine.applyCardEffect(room, p, card);
		expect(p.cash).toBe(cashBefore - 50);
	});

	it('negative money goes to pot when freeParkingPot on', () => {
		const room = makeRoom();
		room.rules.freeParkingPot = true;
		const p = room.players[0];
		const card = { id: 'x', deck: 'chance', effect: { kind: 'money', amount: -15 }, text: 't' };
		engine.applyCardEffect(room, p, card);
		expect(room.parkingPot).toBe(15);
	});

	it('rentOwed handles single-value roll for utilities', () => {
		const room = makeRoom();
		const p = room.players[1];
		room.tileState[12].owner = p.userId;
		p.owned.push(12);
		expect(engine.rentOwed(room, 12, 5)).toBe(20);
		expect(engine.rentOwed(room, 12, 0)).toBe(0);
	});

	it('no rent when owner bankrupt and noRentInJail off', () => {
		const room = makeRoom();
		room.rules.noRentInJail = false;
		const p = room.players[0];
		const owner = room.players[1];
		p.position = 1;
		room.tileState[1].owner = owner.userId;
		owner.bankrupt = true;
		owner.owned.push(1);
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore);
	});

	it('rent collected when noRentInJail off and owner jailed', () => {
		const room = makeRoom();
		room.rules.noRentInJail = false;
		const p = room.players[0];
		const owner = room.players[1];
		p.position = 1;
		room.tileState[1].owner = owner.userId;
		owner.inJail = true;
		owner.owned.push(1);
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBeLessThan(cashBefore);
	});

	it('Free Parking empty pot with pot enabled is no-op', () => {
		const room = makeRoom();
		room.rules.freeParkingPot = true;
		room.parkingPot = 0;
		const p = room.players[0];
		p.position = 20;
		room.turnPhase = 'moving';
		const cashBefore = p.cash;
		engine.resolveLanding(room, p, [2, 3]);
		expect(p.cash).toBe(cashBefore);
	});
});

// ─── Transfer edge cases ──────────────────────────────────────────────────────
describe('transfer edge cases', () => {
	it('allows going negative on transfer', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 5;
		const r = engine.transfer(room, p.userId, 'bank', 100, 'test');
		expect(r.ok).toBe(true);
		expect(p.cash).toBe(-95);
		expect(r.events).toHaveLength(1);
	});

	it('deducts cash even when going negative', () => {
		const room = makeRoom();
		const p = room.players[0];
		const cashBefore = 10;
		p.cash = cashBefore;
		engine.transfer(room, p.userId, 'bank', 100, 'test');
		expect(p.cash).toBe(cashBefore - 100);
		expect(p.cash).toBeLessThan(0);
	});

	it('returns events:[] on bad-from', () => {
		const room = makeRoom();
		const r = engine.transfer(room, 'nonexistent', 'bank', 100, 'test');
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-from');
		expect(r.events).toEqual([]);
	});

	it('returns events:[] on bad-to', () => {
		const room = makeRoom();
		const r = engine.transfer(room, 'bank', 'nonexistent', 100, 'test');
		expect(r.ok).toBe(false);
		expect(r.error).toBe('bad-to');
		expect(r.events).toEqual([]);
	});
});

// ─── resolveLanding: insufficient funds creates debt ─────────────────────────
describe('resolveLanding debt creation', () => {
	it('creates debt when player cannot afford rent', () => {
		const room = makeRoom();
		const p = room.players[0];
		const owner = room.players[1];
		p.cash = 1;
		p.position = 5; // Reading Railroad (station, pos 5)
		room.tileState[5].owner = owner.userId;
		owner.owned.push(5);
		room.turnPhase = 'moving';
		const events = engine.resolveLanding(room, p, [2, 3]);
		expect(room.turnPhase).toBe('resolving');
		expect(room.pendingDebt).toBeTruthy();
		expect(room.pendingDebt.userId).toBe(p.userId);
		expect(room.pendingDebt.creditor).toBe(owner.userId);
		expect(events.some((e) => e.type === 'debt')).toBe(true);
	});

	it('creates debt when player cannot afford tax', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 1;
		p.position = 4; // Income Tax ($200)
		room.turnPhase = 'moving';
		const events = engine.resolveLanding(room, p, [2, 3]);
		expect(room.turnPhase).toBe('resolving');
		expect(room.pendingDebt).toBeTruthy();
		expect(room.pendingDebt.userId).toBe(p.userId);
		expect(room.pendingDebt.creditor).toBe('bank');
		expect(events.some((e) => e.type === 'debt')).toBe(true);
	});

	it('clears pendingDebt on new landing when phase is not resolving', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.pendingDebt = { userId: p.userId, creditor: 'bank', amount: 100 };
		p.cash = 9999;
		p.position = 0; // GO
		room.turnPhase = 'moving';
		engine.resolveLanding(room, p, [2, 3]);
		expect(room.pendingDebt).toBeNull();
	});
});

// ─── Invariant: resolveLanding never leaves phase=resolving without pendingDebt
describe('resolveLanding invariants', () => {
	function assertInvariant(room, player, dice) {
		room.turnPhase = 'moving';
		engine.resolveLanding(room, player, dice);
		// If phase is resolving, pendingDebt MUST be set.
		if (room.turnPhase === 'resolving') {
			expect(room.pendingDebt).toBeTruthy();
			expect(room.pendingDebt.userId).toBe(player.userId);
		}
	}

	it('GO landing: never resolving', () => {
		const room = makeRoom();
		room.players[0].position = 0;
		assertInvariant(room, room.players[0], [2, 3]);
		expect(room.turnPhase).not.toBe('resolving');
	});

	it('own property landing: never resolving', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = p.userId;
		p.owned.push(1);
		p.position = 1;
		assertInvariant(room, p, [2, 3]);
		expect(room.turnPhase).not.toBe('resolving');
	});

	it('unowned property: buying, not resolving', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 1;
		assertInvariant(room, p, [2, 3]);
		expect(room.turnPhase).toBe('buying');
	});

	it('mortgaged property: not resolving', () => {
		const room = makeRoom();
		const p = room.players[0];
		room.tileState[1].owner = room.players[1].userId;
		room.tileState[1].mortgaged = true;
		room.players[1].owned.push(1);
		p.position = 1;
		assertInvariant(room, p, [2, 3]);
		expect(room.turnPhase).not.toBe('resolving');
	});

	it('jail visiting: never resolving', () => {
		const room = makeRoom();
		room.players[0].position = 10;
		assertInvariant(room, room.players[0], [2, 3]);
		expect(room.turnPhase).not.toBe('resolving');
	});

	it('chance/chest: never resolving from card chain', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.position = 7; // Chance
		assertInvariant(room, p, [2, 3]);
		// Chance card may move player — phase depends on card effect.
		// Just verify invariant: if resolving, debt must exist.
		if (room.turnPhase === 'resolving') {
			expect(room.pendingDebt).toBeTruthy();
		}
	});
});

// ─── tryResolveDebt ──────────────────────────────────────────────────────────
describe('tryResolveDebt', () => {
	it('resolves debt when player has non-negative cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 500;
		room.turnPhase = 'resolving';
		room.pendingDebt = { userId: p.userId, creditor: 'player-2', amount: 200 };
		const events = engine.tryResolveDebt(room, p);
		expect(events).toEqual([]);
		expect(room.pendingDebt).toBeNull();
		expect(room.turnPhase).toBe('awaiting-end-turn');
	});

	it('returns null when player still has negative cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = -50;
		room.turnPhase = 'resolving';
		room.pendingDebt = { userId: p.userId, creditor: 'player-2', amount: 200 };
		const events = engine.tryResolveDebt(room, p);
		expect(events).toBeNull();
		expect(room.pendingDebt).toBeTruthy();
		expect(room.turnPhase).toBe('resolving');
	});

	it('returns null when no pending debt', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 500;
		room.turnPhase = 'awaiting-end-turn';
		room.pendingDebt = null;
		const events = engine.tryResolveDebt(room, p);
		expect(events).toBeNull();
	});

	it('returns null when debt is for a different player', () => {
		const room = makeRoom();
		const p = room.players[0];
		const other = room.players[1];
		p.cash = 500;
		room.turnPhase = 'resolving';
		room.pendingDebt = { userId: other.userId, creditor: 'bank', amount: 200 };
		const events = engine.tryResolveDebt(room, p);
		expect(events).toBeNull();
		expect(room.pendingDebt).toBeTruthy();
	});

	it('returns null when not in resolving phase', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 500;
		room.turnPhase = 'buying';
		room.pendingDebt = { userId: p.userId, creditor: 'bank', amount: 200 };
		const events = engine.tryResolveDebt(room, p);
		expect(events).toBeNull();
		expect(room.pendingDebt).toBeTruthy();
	});

	it('resolves debt at exactly zero cash', () => {
		const room = makeRoom();
		const p = room.players[0];
		p.cash = 0;
		room.turnPhase = 'resolving';
		room.pendingDebt = { userId: p.userId, creditor: 'bank', amount: 200 };
		const events = engine.tryResolveDebt(room, p);
		expect(events).toEqual([]);
		expect(room.pendingDebt).toBeNull();
		expect(room.turnPhase).toBe('awaiting-end-turn');
	});
});
