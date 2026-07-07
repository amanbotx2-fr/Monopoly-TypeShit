import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
	WORLD_TOUR,
	BUILTIN_BOARDS,
	validateBoard,
	computeGroupSizes,
} = require('../game/boards');

describe('WORLD_TOUR', () => {
	it('has 40 tiles', () => {
		expect(WORLD_TOUR.tiles).toHaveLength(40);
	});

	it('is frozen', () => {
		expect(Object.isFrozen(WORLD_TOUR)).toBe(true);
	});

	it('tile 0 is GO', () => {
		expect(WORLD_TOUR.tiles[0].type).toBe('go');
	});

	it('tile 10 is Jail', () => {
		expect(WORLD_TOUR.tiles[10].type).toBe('jail');
	});

	it('tile 30 is Go to Jail', () => {
		expect(WORLD_TOUR.tiles[30].type).toBe('gotojail');
	});

	it('has 22 properties, 4 stations, 2 utilities', () => {
		const types = WORLD_TOUR.tiles.map((t) => t.type);
		expect(types.filter((t) => t === 'property')).toHaveLength(22);
		expect(types.filter((t) => t === 'station')).toHaveLength(4);
		expect(types.filter((t) => t === 'utility')).toHaveLength(2);
	});

	it('has group sizes computed', () => {
		expect(WORLD_TOUR.groupSizes.brown).toBe(2);
		expect(WORLD_TOUR.groupSizes.lblue).toBe(3);
		expect(WORLD_TOUR.groupSizes.dblue).toBe(2);
	});
});

describe('BUILTIN_BOARDS', () => {
	it('has 3 builtin boards', () => {
		expect(Object.keys(BUILTIN_BOARDS)).toHaveLength(3);
	});

	it.each(['world-tour', 'classic-usa', 'world-capitals'])('%s validates', (id) => {
		const board = BUILTIN_BOARDS[id];
		const errs = validateBoard(board);
		expect(errs).toEqual([]);
	});

	it('world-capitals is a different board than world-tour', () => {
		expect(BUILTIN_BOARDS['world-capitals'].tiles[1].name).not.toBe(
			BUILTIN_BOARDS['world-tour'].tiles[1].name,
		);
	});
});

describe('validateBoard', () => {
	function makeValidBoard(overrides = {}) {
		return {
			tiles: WORLD_TOUR.tiles.map((t) => ({ ...t })),
			...overrides,
		};
	}

	it('passes a valid board', () => {
		expect(validateBoard(makeValidBoard())).toEqual([]);
	});

	it('rejects null/undefined', () => {
		const errs = validateBoard(null);
		expect(errs).toContain('tiles array missing');
	});

	it('rejects non-array tiles', () => {
		const errs = validateBoard({ tiles: 'not-an-array' });
		expect(errs).toContain('tiles array missing');
	});

	it('rejects wrong tile count', () => {
		const errs = validateBoard({ tiles: [] });
		expect(errs.some((e) => e.includes('expected 40'))).toBe(true);
	});

	it('rejects missing GO tile', () => {
		const tiles = makeValidBoard().tiles.map((t) =>
			t.type === 'go' ? { ...t, type: 'parking' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('missing GO'))).toBe(true);
	});

	it('rejects missing Jail tile', () => {
		const tiles = makeValidBoard().tiles.map((t) =>
			t.type === 'jail' ? { ...t, type: 'parking' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('missing Jail'))).toBe(true);
	});

	it('rejects missing Go To Jail tile', () => {
		const tiles = makeValidBoard().tiles.map((t) =>
			t.type === 'gotojail' ? { ...t, type: 'parking' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('missing Go To Jail'))).toBe(true);
	});

	it('rejects tile 0 not GO', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 0 ? { ...t, type: 'parking' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('tile 0 must be GO'))).toBe(true);
	});

	it('rejects tile 10 not Jail', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 10 ? { ...t, type: 'parking' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('tile 10 must be Jail'))).toBe(true);
	});

	it('rejects tile 30 not Go To Jail', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 30 ? { ...t, type: 'parking' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('tile 30 must be Go To Jail'))).toBe(
			true,
		);
	});

	it('rejects tile with wrong pos', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 5 ? { ...t, pos: 99 } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('wrong pos'))).toBe(true);
	});

	it('rejects invalid tile type', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 1 ? { ...t, type: 'invalid-type' } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('invalid type'))).toBe(true);
	});

	it('rejects property without group', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 1 ? { ...t, group: undefined } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('needs a group'))).toBe(true);
	});

	it('rejects property with wrong rent array length', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 1 ? { ...t, rent: [1, 2, 3] } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('six rent values'))).toBe(true);
	});

	it('rejects property without price', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 1 ? { ...t, price: undefined } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('needs a price'))).toBe(true);
	});

	it('rejects property without house cost', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 1 ? { ...t, houseCost: undefined } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('needs a house cost'))).toBe(true);
	});

	it('rejects station without price', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 5 ? { ...t, price: undefined } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('needs a price'))).toBe(true);
	});

	it('rejects tax without amount', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 4 ? { ...t, amount: undefined } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('needs an amount'))).toBe(true);
	});

	it('rejects tile without name', () => {
		const tiles = makeValidBoard().tiles.map((t, i) =>
			i === 1 ? { ...t, name: undefined } : t,
		);
		expect(validateBoard({ tiles }).some((e) => e.includes('needs a name'))).toBe(true);
	});
});

describe('computeGroupSizes', () => {
	it('computes group sizes from tiles', () => {
		const sizes = computeGroupSizes(WORLD_TOUR.tiles);
		expect(sizes.brown).toBe(2);
		expect(sizes.lblue).toBe(3);
		expect(sizes.pink).toBe(3);
		expect(sizes.orange).toBe(3);
		expect(sizes.red).toBe(3);
		expect(sizes.yellow).toBe(3);
		expect(sizes.green).toBe(3);
		expect(sizes.dblue).toBe(2);
	});
});
