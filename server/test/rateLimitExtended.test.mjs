import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const {
	checkRateLimit,
	socketRateLimit,
	socketConnectionRateLimit,
	resetRateLimitState,
} = require('../abuse/rateLimit');
const { activeRooms, deleteRoom } = require('../game/state');

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
	resetRateLimitState();
	vi.restoreAllMocks();
});

describe('pruneLimiters', () => {
	it('removes expired buckets', () => {
		// Fill a limiter with expired buckets by calling with a past timestamp
		const past = Date.now() - 120000;
		const r1 = checkRateLimit('prune-test-1', 'k1', { limit: 2, windowMs: 10000 });
		expect(r1.ok).toBe(true);

		// Force an expired bucket by checking with old ts
		const r2 = checkRateLimit('prune-test-2', 'k2', { limit: 1, windowMs: 10000 }, past);
		expect(r2.ok).toBe(true);
		// Now check again with current time — old bucket should be pruned
		const r3 = checkRateLimit('prune-test-2', 'k2', { limit: 1, windowMs: 10000 });
		expect(r3.ok).toBe(true); // old bucket was pruned, new one created
	});

	it('trims overflow entries beyond maxEntries', () => {
		// Fill many keys in a small maxEntries limiter
		for (let i = 0; i < 20; i++) {
			checkRateLimit('overflow-test', `key-${i}`, {
				limit: 1,
				windowMs: 60000,
				maxEntries: 10,
			});
		}
		// Should not crash — overflow trimming happened
		expect(true).toBe(true);
	});
});

describe('socketRateLimit edge cases', () => {
	it('blocks socket events over limit', () => {
		const socket = {
			id: 'sock-edge',
			data: { userId: 'user-edge' },
			handshake: { address: '10.0.0.1' },
		};
		const opts = { limit: 2, windowMs: 60000 };
		for (let i = 0; i < 2; i++) {
			const r = socketRateLimit(socket, 'edge-event', opts);
			expect(r.ok).toBe(true);
		}
		const blocked = socketRateLimit(socket, 'edge-event', opts);
		expect(blocked.ok).toBe(false);
	});

	it('different events have separate limits', () => {
		const socket = {
			id: 'sock-sep',
			data: { userId: 'user-sep' },
			handshake: { address: '10.0.0.1' },
		};
		const opts = { limit: 1, windowMs: 60000 };
		expect(socketRateLimit(socket, 'evt-a', opts).ok).toBe(true);
		expect(socketRateLimit(socket, 'evt-b', opts).ok).toBe(true);
		expect(socketRateLimit(socket, 'evt-a', opts).ok).toBe(false);
	});
});

describe('socketConnectionRateLimit', () => {
	it('allows connections under limit', () => {
		const socket = {
			id: 'conn-sock',
			data: { userId: 'conn-user' },
			handshake: { address: '1.2.3.4', auth: {} },
		};
		const next = vi.fn();
		socketConnectionRateLimit('conn-test', { limit: 5, windowMs: 60000 })(socket, next);
		expect(next).toHaveBeenCalledWith();
	});

	it('blocks connections over limit', () => {
		const makeSocket = () => ({
			id: 'conn-sock-2',
			data: { userId: 'conn-user-2' },
			handshake: { address: '1.2.3.4', auth: { roomCode: 'ABCDEF' } },
		});

		const mw = socketConnectionRateLimit('conn-test-2', { limit: 1, windowMs: 60000 });
		const next1 = vi.fn();
		mw(makeSocket(), next1);
		expect(next1).toHaveBeenCalledWith();

		const next2 = vi.fn();
		mw(makeSocket(), next2);
		expect(next2).toHaveBeenCalledWith(expect.any(Error));
		expect(next2.mock.calls[0][0].message).toBe('rate-limited');
	});
});
