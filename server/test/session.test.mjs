import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const {
	createSessionParser,
	isProductionEnv,
	sessionSecret,
	mongoStore,
	sessionMiddleware,
	socketSessionMiddleware,
	SESSION_COOKIE,
	SESSION_MAX_AGE,
} = require('../middleware/session');

describe('isProductionEnv', () => {
	it('detects production', () => {
		expect(isProductionEnv({ NODE_ENV: 'production' })).toBe(true);
	});

	it('detects non-production', () => {
		expect(isProductionEnv({ NODE_ENV: 'development' })).toBe(false);
		expect(isProductionEnv({})).toBe(false);
	});
});

describe('sessionSecret', () => {
	it('returns SESSION_SECRET when set', () => {
		expect(sessionSecret({ SESSION_SECRET: 'my-secret' })).toBe('my-secret');
	});

	it('throws in production without secret', () => {
		expect(() => sessionSecret({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
	});

	it('returns dev default in non-production', () => {
		expect(sessionSecret({ NODE_ENV: 'development' })).toBe('dev-only-monopoly-session-secret');
	});
});

describe('mongoStore', () => {
	it('returns undefined in dev without URI', () => {
		expect(mongoStore({ NODE_ENV: 'development' }, { create: vi.fn() })).toBeUndefined();
	});

	it('throws in production without URI', () => {
		expect(() => mongoStore({ NODE_ENV: 'production' }, { create: vi.fn() })).toThrow(
			/Production session storage requires/,
		);
	});

	it('creates store with SESSION_STORE_MONGODB_URI', () => {
		const create = vi.fn(() => ({ kind: 'mongo' }));
		const store = mongoStore(
			{ NODE_ENV: 'production', SESSION_STORE_MONGODB_URI: 'mongodb://sessions' },
			{ create },
		);
		expect(create).toHaveBeenCalledWith({
			mongoUrl: 'mongodb://sessions',
			collectionName: 'sessions',
			ttl: 60 * 60 * 24 * 365,
			autoRemove: 'native',
		});
	});

	it('falls back to MONGODB_URI', () => {
		const create = vi.fn(() => ({ kind: 'mongo' }));
		const store = mongoStore(
			{ NODE_ENV: 'production', MONGODB_URI: 'mongodb://main' },
			{ create },
		);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ mongoUrl: 'mongodb://main' }),
		);
	});
});

describe('createSessionParser', () => {
	it('creates dev parser with lax sameSite', () => {
		const sessionImpl = vi.fn(() => 'dev-parser');
		const parser = createSessionParser({
			env: { NODE_ENV: 'development', SESSION_SECRET: 'dev-secret' },
			sessionImpl,
		});
		expect(parser).toBe('dev-parser');
		expect(sessionImpl).toHaveBeenCalledWith(
			expect.objectContaining({
				cookie: expect.objectContaining({ sameSite: 'lax', secure: false }),
			}),
		);
	});

	it('creates prod parser with none sameSite and secure', () => {
		const sessionImpl = vi.fn(() => 'prod-parser');
		const create = vi.fn(() => ({ kind: 'mongo' }));
		const parser = createSessionParser({
			env: {
				NODE_ENV: 'production',
				SESSION_SECRET: 's',
				SESSION_STORE_MONGODB_URI: 'mongo://s',
			},
			sessionImpl,
			storeFactory: { create },
		});
		expect(sessionImpl).toHaveBeenCalledWith(
			expect.objectContaining({
				cookie: expect.objectContaining({ sameSite: 'none', secure: true }),
			}),
		);
	});
});

describe('sessionMiddleware', () => {
	it('sets userId from session', (done) => {
		const req = { session: {} };
		const res = {};
		sessionMiddleware(req, res, (err) => {
			expect(err).toBeFalsy();
			expect(req.userId).toBeTruthy();
			expect(req.session.userId).toBe(req.userId);
			done();
		});
	});

	it('reuses existing userId', (done) => {
		const req = { session: { userId: 'existing-id' } };
		sessionMiddleware(req, {}, (err) => {
			expect(err).toBeFalsy();
			expect(req.userId).toBe('existing-id');
			done();
		});
	});
});

describe('socketSessionMiddleware', () => {
	it('rejects without session', (done) => {
		const socket = { request: {}, data: {} };
		socketSessionMiddleware(socket, (err) => {
			expect(err).toBeTruthy();
			expect(err.message).toBe('session-required');
			done();
		});
	});

	it('sets userId from session', (done) => {
		const save = vi.fn((cb) => cb(null));
		const socket = { request: { session: { save } }, data: {} };
		socketSessionMiddleware(socket, (err) => {
			expect(err).toBeFalsy();
			expect(socket.data.userId).toBeTruthy();
			done();
		});
	});
});

describe('constants', () => {
	it('SESSION_COOKIE is monopoly.sid', () => {
		expect(SESSION_COOKIE).toBe('monopoly.sid');
	});

	it('SESSION_MAX_AGE is 1 year in ms', () => {
		expect(SESSION_MAX_AGE).toBe(1000 * 60 * 60 * 24 * 365);
	});
});
