const crypto = require('crypto');

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfToken(req) {
	if (!req.session) return null;
	if (!req.session.csrfToken) {
		req.session.csrfToken = crypto.randomBytes(32).toString('hex');
	}
	return req.session.csrfToken;
}

function attachCsrfToken(req, _res, next) {
	req.csrfToken = ensureCsrfToken(req);
	next();
}

function createCsrfMiddleware({ ensureToken = ensureCsrfToken } = {}) {
	return function requireCsrf(req, res, next) {
		if (SAFE_METHODS.has(req.method)) return next();

		const expected = ensureToken(req);
		const received = req.get(CSRF_HEADER);
		if (!expected || !received) {
			return res.status(403).json({
				error: 'forbidden',
				code: 'csrf-missing',
				message: 'Missing CSRF token',
			});
		}

		const expectedBuf = Buffer.from(expected, 'utf8');
		const receivedBuf = Buffer.from(String(received), 'utf8');
		if (
			expectedBuf.length !== receivedBuf.length ||
			!crypto.timingSafeEqual(expectedBuf, receivedBuf)
		) {
			return res.status(403).json({
				error: 'forbidden',
				code: 'csrf-invalid',
				message: 'Invalid CSRF token',
			});
		}

		return next();
	};
}

const requireCsrf = createCsrfMiddleware();

module.exports = {
	attachCsrfToken,
	createCsrfMiddleware,
	ensureCsrfToken,
	requireCsrf,
	CSRF_HEADER,
};
