import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

const {
	createSessionParser,
	SESSION_COOKIE,
	SESSION_MAX_AGE,
} = require('../middleware/session');
const {
	attachCsrfToken,
	createCsrfMiddleware,
	ensureCsrfToken,
	CSRF_HEADER,
} = require('../middleware/csrf');

function createJsonResponse() {
	return {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(payload) {
			this.body = payload;
			return this;
		},
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('session security configuration', () => {
	it('rejects production config without shared session storage', () => {
		expect(() =>
			createSessionParser({
				env: {
					NODE_ENV: 'production',
					SESSION_SECRET: 'test-secret',
				},
				sessionImpl: vi.fn(),
				storeFactory: { create: vi.fn() },
			}),
		).toThrow(/Production session storage requires/);
	});

	it('builds a mongo-backed production session parser with hardened cookies', () => {
		const sessionImpl = vi.fn(() => 'parser');
		const create = vi.fn(() => ({ kind: 'mongo-store' }));

		const parser = createSessionParser({
			env: {
				NODE_ENV: 'production',
				SESSION_SECRET: 'test-secret',
				SESSION_STORE_MONGODB_URI: 'mongodb://example/session-store',
			},
			sessionImpl,
			storeFactory: { create },
		});

		expect(parser).toBe('parser');
		expect(create).toHaveBeenCalledWith({
			mongoUrl: 'mongodb://example/session-store',
			collectionName: 'sessions',
			ttl: 60 * 60 * 24 * 365,
			autoRemove: 'native',
		});
		expect(sessionImpl).toHaveBeenCalledWith({
			name: SESSION_COOKIE,
			secret: 'test-secret',
			resave: false,
			saveUninitialized: true,
			store: { kind: 'mongo-store' },
			cookie: {
				httpOnly: true,
				sameSite: 'none',
				secure: true,
				maxAge: SESSION_MAX_AGE,
				path: '/',
			},
		});
	});
});

describe('csrf middleware', () => {
	it('issues a stable per-session token', () => {
		const req = { session: {} };
		const next = vi.fn();

		attachCsrfToken(req, {}, next);
		const first = req.csrfToken;
		attachCsrfToken(req, {}, next);

		expect(next).toHaveBeenCalledTimes(2);
		expect(first).toMatch(/^[a-f0-9]{64}$/);
		expect(req.csrfToken).toBe(first);
		expect(ensureCsrfToken(req)).toBe(first);
	});

	it('allows safe methods without a token header', () => {
		const req = {
			method: 'GET',
			session: {},
			get: vi.fn(() => undefined),
		};
		const res = createJsonResponse();
		const next = vi.fn();

		createCsrfMiddleware()(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
	});

	it('rejects mutation requests without a csrf token', () => {
		const req = {
			method: 'POST',
			session: {},
			get: vi.fn(() => undefined),
		};
		const res = createJsonResponse();
		const next = vi.fn();

		createCsrfMiddleware()(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(403);
		expect(res.body).toEqual({
			error: 'forbidden',
			code: 'csrf-missing',
			message: 'Missing CSRF token',
		});
		expect(req.session.csrfToken).toMatch(/^[a-f0-9]{64}$/);
	});

	it('rejects mutation requests with the wrong csrf token', () => {
		const req = {
			method: 'DELETE',
			session: { csrfToken: 'a'.repeat(64) },
			get: vi.fn((header) => (header === CSRF_HEADER ? 'b'.repeat(64) : undefined)),
		};
		const res = createJsonResponse();
		const next = vi.fn();

		createCsrfMiddleware()(req, res, next);

		expect(next).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(403);
		expect(res.body).toEqual({
			error: 'forbidden',
			code: 'csrf-invalid',
			message: 'Invalid CSRF token',
		});
	});

	it('accepts mutation requests with the session token', () => {
		const token = 'c'.repeat(64);
		const req = {
			method: 'PATCH',
			session: { csrfToken: token },
			get: vi.fn((header) => (header === CSRF_HEADER ? token : undefined)),
		};
		const res = createJsonResponse();
		const next = vi.fn();

		createCsrfMiddleware()(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
		expect(res.body).toBe(null);
	});
});
