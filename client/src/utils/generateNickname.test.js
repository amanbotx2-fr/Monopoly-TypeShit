import { describe, expect, it } from 'vitest';
import generateNickname from './generateNickname';

function sequenceRandom(values) {
	let index = 0;
	return () => values[index++];
}

describe('generateNickname', () => {
	it('combines an adjective and noun without changing the nickname format', () => {
		expect(generateNickname(sequenceRandom([0, 0, 0.5]))).toBe('LuckyTycoon');
	});

	it('occasionally appends a number from 1 to 999', () => {
		expect(generateNickname(sequenceRandom([0.08, 0.09, 0.1, 0.5]))).toBe('GoldenTrader500');
	});
});
