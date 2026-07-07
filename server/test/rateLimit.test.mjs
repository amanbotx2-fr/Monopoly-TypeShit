import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const {
	positiveInt,
	hashId,
	clientIp,
	socketIp,
	httpSessionId,
	socketSessionId,
	httpSessionKey,
	httpIpKey,
	socketSessionKey,
	checkRateLimit,
	rateLimitMiddleware,
	socketRateLimit,
	abuseLog,
} = require('../abuse/rateLimit');
const { activeRooms, deleteRoom } = require('../game/state');

beforeEach(() => {
	for (const [code] of activeRooms) deleteRoom(code);
	vi.restoreAllMocks();
});

describe('positiveInt', () => {
	it('returns the number when positive', () => {
		expect(positiveInt(42, 10)).toBe(42);
	});

	it('returns fallback for zero', () => {
		expect(positiveInt(0, 10)).toBe(10);
	});

	it('returns fallback for negative', () => {
		expect(positiveInt(-5, 10)).toBe(10);
	});

	it('returns fallback for NaN', () => {
		expect(positiveInt(NaN, 10)).toBe(10);
	});

	it('returns fallback for Infinity', () => {
		expect(positiveInt(Infinity, 10)).toBe(10);
	});

	it('returns fallback for undefined/null', () => {
		expect(positiveInt(undefined, 10)).toBe(10);
		expect(positiveInt(null, 10)).toBe(10);
	});

	it('floors the value', () => {
		expect(positiveInt(42.9, 10)).toBe(42);
	});
});

describe('hashId', () => {
	it('returns a 16-char hex string', () => {
		const h = hashId('test-user');
		expect(h).toMatch(/^[a-f0-9]{16}$/);
	});

	it('returns "anonymous" for falsy values', () => {
		expect(hashId('')).toBe('anonymous');
		expect(hashId(null)).toBe('anonymous');
		expect(hashId(undefined)).toBe('anonymous');
	});

	it('is deterministic', () => {
		expect(hashId('test')).toBe(hashId('test'));
	});
});

describe('clientIp', () => {
	it('uses req.ip when available', () => {
		expect(clientIp({ ip: '1.2.3.4' })).toBe('1.2.3.4');
	});

	it('falls back to x-forwarded-for', () => {
		expect(
			clientIp({ ip: undefined, headers: { 'x-forwarded-for': '5.6.7.8, 9.0.1.2' } }),
		).toBe('5.6.7.8');
	});

	it('falls back to socket remoteAddress', () => {
		expect(
			clientIp({
				ip: undefined,
				headers: {},
				socket: { remoteAddress: '10.0.0.1' },
			}),
		).toBe('10.0.0.1');
	});

	it('returns unknown-ip as last resort', () => {
		expect(clientIp({})).toBe('unknown-ip');
	});
});

describe('socketIp', () => {
	it('uses handshake address', () => {
		expect(socketIp({ handshake: { address: '1.2.3.4' } })).toBe('1.2.3.4');
	});

	it('falls back to request socket', () => {
		expect(
			socketIp({
				handshake: {},
				request: { socket: { remoteAddress: '5.6.7.8' } },
			}),
		).toBe('5.6.7.8');
	});

	it('returns unknown-ip as last resort', () => {
		expect(socketIp({ handshake: {} })).toBe('unknown-ip');
	});
});

describe('httpSessionId', () => {
	it('uses userId when available', () => {
		const req = { userId: 'user-1' };
		expect(httpSessionId(req)).toBe(hashId('user-1'));
	});

	it('falls back to sessionID', () => {
		const req = { sessionID: 'sess-123' };
		expect(httpSessionId(req)).toBe(hashId('sess-123'));
	});

	it('falls back to session.id', () => {
		const req = { session: { id: 'sess-456' } };
		expect(httpSessionId(req)).toBe(hashId('sess-456'));
	});
});

describe('socketSessionId', () => {
	it('uses socket.data.userId', () => {
		expect(socketSessionId({ data: { userId: 'user-1' } })).toBe(hashId('user-1'));
	});

	it('falls back to request sessionID', () => {
		expect(socketSessionId({ data: {}, request: { sessionID: 'sess-1' } })).toBe(
			hashId('sess-1'),
		);
	});

	it('falls back to request.session.id', () => {
		expect(socketSessionId({ data: {}, request: { session: { id: 'sess-final' } } })).toBe(
			hashId('sess-final'),
		);
	});
});

describe('key generators', () => {
	it('httpSessionKey produces expected format', () => {
		const key = httpSessionKey({ userId: 'u1', ip: '1.2.3.4' });
		expect(key).toContain('session:');
		expect(key).toContain('|ip:');
	});

	it('httpIpKey produces expected format', () => {
		const key = httpIpKey({ ip: '1.2.3.4' });
		expect(key).toContain('ip:');
	});

	it('socketSessionKey produces expected format', () => {
		const key = socketSessionKey({
			data: { userId: 'u1' },
			handshake: { address: '1.2.3.4' },
		});
		expect(key).toContain('session:');
		expect(key).toContain('|ip:');
	});
});

describe('checkRateLimit', () => {
	it('allows requests under limit', () => {
		const r = checkRateLimit('test-limiter', 'key-1', { limit: 5, windowMs: 60000 });
		expect(r.ok).toBe(true);
		expect(r.remaining).toBe(4);
	});

	it('blocks requests over limit', () => {
		for (let i = 0; i < 5; i++) {
			checkRateLimit('test-limiter-2', 'key-2', { limit: 5, windowMs: 60000 });
		}
		const r = checkRateLimit('test-limiter-2', 'key-2', { limit: 5, windowMs: 60000 });
		expect(r.ok).toBe(false);
	});
});

describe('rateLimitMiddleware', () => {
	it('creates middleware that allows under-limit requests', () => {
		const mw = rateLimitMiddleware('mw-test-a', {
			limit: 3,
			windowMs: 60000,
			key: httpSessionKey,
		});
		const req = { userId: 'user-99', ip: '1.2.3.4' };
		const next = vi.fn();
		mw(req, { status: vi.fn(() => ({ json: vi.fn() })) }, next);
		expect(next).toHaveBeenCalled();
	});

	it('blocks over-limit requests', () => {
		const mw = rateLimitMiddleware('mw-test-b', {
			limit: 1,
			windowMs: 60000,
			key: httpSessionKey,
		});
		const req = { userId: 'user-100', ip: '1.2.3.4' };
		const json = vi.fn();
		const res = { status: vi.fn(() => ({ json })), set: vi.fn() };
		const next = vi.fn();

		mw(req, res, next);
		expect(next).toHaveBeenCalledTimes(1);

		const req2 = { userId: 'user-100', ip: '1.2.3.4' };
		mw(req2, res, next);
		expect(next).toHaveBeenCalledTimes(1);
		expect(res.status).toHaveBeenCalledWith(429);
	});
});

describe('socketRateLimit', () => {
	it('returns ok for under-limit socket events', () => {
		const socket = {
			id: 'sock-1',
			data: { userId: 'user-1' },
			handshake: { address: '1.2.3.4' },
		};
		const r = socketRateLimit(socket, 'test-event', { limit: 5, windowMs: 60000 });
		expect(r.ok).toBe(true);
	});

	it('blocks over-limit socket events', () => {
		const socket = {
			id: 'sock-2',
			data: { userId: 'user-2' },
			handshake: { address: '1.2.3.4' },
		};
		for (let i = 0; i < 5; i++) {
			socketRateLimit(socket, 'test-event-2', { limit: 5, windowMs: 60000 });
		}
		const r = socketRateLimit(socket, 'test-event-2', { limit: 5, windowMs: 60000 });
		expect(r.ok).toBe(false);
	});
});

describe('abuseLog', () => {
	it('does not throw', () => {
		expect(() =>
			abuseLog({
				kind: 'test',
				sessionId: 'abc',
				socketId: null,
				event: 'test',
				roomCode: null,
				limitName: 'test',
				retryAfterMs: 0,
			}),
		).not.toThrow();
	});
});

describe('nowMs', () => {
	// nowMs is a private function, tested indirectly through checkRateLimit
	it('checkRateLimit uses timestamps internally', () => {
		const r = checkRateLimit('now-test', 'k', { limit: 5, windowMs: 60000 });
		expect(r.resetAt).toBeGreaterThan(Date.now());
		expect(r.retryAfterMs).toBeGreaterThanOrEqual(0);
	});
});
