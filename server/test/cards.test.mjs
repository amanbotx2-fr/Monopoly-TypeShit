import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const { CHANCE, CHEST, newChanceDeck, newChestDeck, getCard, shuffled } = require('../game/cards');

describe('shuffled', () => {
	it('returns a copy of the array', () => {
		const arr = [1, 2, 3, 4, 5];
		const s = shuffled(arr);
		expect(s).not.toBe(arr);
		expect(s.sort()).toEqual([1, 2, 3, 4, 5]);
	});

	it('handles empty array', () => {
		expect(shuffled([])).toEqual([]);
	});

	it('handles single element', () => {
		expect(shuffled([42])).toEqual([42]);
	});
});

describe('CHANCE deck', () => {
	it('has 16 cards', () => {
		expect(CHANCE).toHaveLength(16);
	});

	it('each card has id, text, effect with kind', () => {
		for (const card of CHANCE) {
			expect(card.id).toBeTruthy();
			expect(card.text).toBeTruthy();
			expect(card.effect).toBeDefined();
			expect(card.effect.kind).toBeTruthy();
		}
	});

	it('contains a jail free card', () => {
		const jf = CHANCE.find((c) => c.effect.kind === 'jailFree');
		expect(jf).toBeDefined();
		expect(jf.id).toBe('ch_jail_free');
	});

	it('contains moveTo cards', () => {
		const cards = CHANCE.filter((c) => c.effect.kind === 'moveTo');
		expect(cards.length).toBeGreaterThanOrEqual(5);
	});

	it('contains moveToNearest cards', () => {
		const cards = CHANCE.filter((c) => c.effect.kind === 'moveToNearest');
		expect(cards.length).toBe(3);
	});

	it('contains goToJail', () => {
		expect(CHANCE.some((c) => c.effect.kind === 'goToJail')).toBe(true);
	});

	it('contains repairs', () => {
		const rep = CHANCE.find((c) => c.effect.kind === 'repairs');
		expect(rep).toBeDefined();
		expect(rep.effect.perHouse).toBe(25);
		expect(rep.effect.perHotel).toBe(100);
	});
});

describe('CHEST deck', () => {
	it('has 16 cards', () => {
		expect(CHEST).toHaveLength(16);
	});

	it('each card has id, text, effect with kind', () => {
		for (const card of CHEST) {
			expect(card.id).toBeTruthy();
			expect(card.text).toBeTruthy();
			expect(card.effect).toBeDefined();
			expect(card.effect.kind).toBeTruthy();
		}
	});

	it('contains a jail free card', () => {
		const jf = CHEST.find((c) => c.effect.kind === 'jailFree');
		expect(jf).toBeDefined();
		expect(jf.id).toBe('cc_jail_free');
	});

	it('contains goToJail', () => {
		expect(CHEST.some((c) => c.effect.kind === 'goToJail')).toBe(true);
	});

	it('contains repairs', () => {
		const rep = CHEST.find((c) => c.effect.kind === 'repairs');
		expect(rep).toBeDefined();
		expect(rep.effect.perHouse).toBe(40);
		expect(rep.effect.perHotel).toBe(115);
	});

	it('contains moneyAll (birthday)', () => {
		const card = CHEST.find((c) => c.id === 'cc_birthday');
		expect(card).toBeDefined();
		expect(card.effect.kind).toBe('moneyAll');
		expect(card.effect.amount).toBe(10);
	});
});

describe('newChanceDeck', () => {
	it('creates a shuffled deck with 16 draw cards', () => {
		const deck = newChanceDeck();
		expect(deck.draw).toHaveLength(16);
		expect(deck.discard).toEqual([]);
	});

	it('creates different decks on each call', () => {
		const d1 = newChanceDeck();
		const d2 = newChanceDeck();
		// Extremely unlikely to be the same
		const same = d1.draw.every((id, i) => id === d2.draw[i]);
		expect(same).toBe(false);
	});
});

describe('newChestDeck', () => {
	it('creates a shuffled deck with 16 draw cards', () => {
		const deck = newChestDeck();
		expect(deck.draw).toHaveLength(16);
		expect(deck.discard).toEqual([]);
	});

	it('creates a deck with only chest card ids', () => {
		const deck = newChestDeck();
		for (const id of deck.draw) {
			expect(id).toMatch(/^cc_/);
		}
	});
});

describe('getCard', () => {
	it('returns the correct card by id', () => {
		const card = getCard('ch_advance_go');
		expect(card).not.toBeNull();
		expect(card.id).toBe('ch_advance_go');
		expect(card.deck).toBe('chance');
	});

	it('returns chest card by id', () => {
		const card = getCard('cc_bank_error');
		expect(card).not.toBeNull();
		expect(card.deck).toBe('chest');
		expect(card.effect.amount).toBe(200);
	});

	it('returns null for unknown id', () => {
		expect(getCard('nonexistent')).toBeNull();
	});
});
