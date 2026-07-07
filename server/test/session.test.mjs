import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const {
	createSessionParser,
	isProductionEnv,
	sessionSecret,
	mongoStore,
	SESSION_COOKIE,
	SESSION_MAX_AGE,
} = require('../middleware/session');

const {
	createCsrfMiddleware,
	ensureCsrfToken,
	attachCsrfToken,
	CSRF_HEADER,
} = require('../middleware/csrf');

// ─── Session configuration ───────────────────────────────────────────────────
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
		mongoStore(
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
		mongoStore({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://main' }, { create });
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
		createSessionParser({
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

// ─── CSRF additional coverage ───────────────────────────────────────────────
describe('csrf additional', () => {
	it('ensureCsrfToken returns null without session', () => {
		const req = {};
		expect(ensureCsrfToken(req)).toBeNull();
	});

	it('ensureCsrfToken creates token on session', () => {
		const req = { session: {} };
		const token = ensureCsrfToken(req);
		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(req.session.csrfToken).toBe(token);
	});

	it('attachCsrfToken sets csrfToken on req', () => {
		const req = { session: {} };
		const next = vi.fn();
		attachCsrfToken(req, {}, next);
		expect(req.csrfToken).toMatch(/^[a-f0-9]{64}$/);
		expect(next).toHaveBeenCalled();
	});

	it('createCsrfMiddleware uses custom ensureToken', () => {
		const token = 'x'.repeat(64);
		const customEnsure = vi.fn(() => token);
		const mw = createCsrfMiddleware({ ensureToken: customEnsure });
		const req = { method: 'PATCH', session: {}, get: vi.fn(() => token) };
		const res = { status: vi.fn(() => ({ json: vi.fn() })) };
		const next = vi.fn();
		mw(req, res, next);
		expect(customEnsure).toHaveBeenCalledWith(req);
		expect(next).toHaveBeenCalled();
	});
});

describe('constants', () => {
	it('SESSION_COOKIE is monopoly.sid', () => {
		expect(SESSION_COOKIE).toBe('monopoly.sid');
	});

	it('SESSION_MAX_AGE is 1 year in ms', () => {
		expect(SESSION_MAX_AGE).toBe(1000 * 60 * 60 * 24 * 365);
	});

	it('CSRF_HEADER is x-csrf-token', () => {
		expect(CSRF_HEADER).toBe('x-csrf-token');
	});
});
