// Anonymous guest identity backed by express-session. The browser only stores
// a signed session id; the player identity lives server-side in req.session.

const crypto = require('crypto');
const session = require('express-session');

const SESSION_COOKIE = 'monopoly.sid';
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 365; // 1 year
const isProduction = process.env.NODE_ENV === 'production';

function sessionSecret() {
	const secret = process.env.SESSION_SECRET;
	if (secret) return secret;
	if (isProduction) throw new Error('SESSION_SECRET is required in production');
	return 'dev-only-monopoly-session-secret';
}

const sessionParser = session({
	name: SESSION_COOKIE,
	secret: sessionSecret(),
	resave: false,
	saveUninitialized: true,
	cookie: {
		httpOnly: true,
		sameSite: isProduction ? 'none' : 'lax',
		secure: isProduction,
		maxAge: SESSION_MAX_AGE,
		path: '/',
	},
});

function ensureIdentity(req) {
	if (!req.session) return null;
	if (!req.session.userId) req.session.userId = crypto.randomUUID();
	return req.session.userId;
}

function sessionMiddleware(req, res, next) {
	sessionParser(req, res, (err) => {
		if (err) return next(err);
		req.userId = ensureIdentity(req);
		next();
	});
}

function socketSessionMiddleware(socket, next) {
	const req = socket.request;
	if (!req.session) return next(new Error('session-required'));

	const userId = ensureIdentity(req);
	req.session.save((err) => {
		if (err) return next(err);
		socket.data.userId = userId;
		next();
	});
}

module.exports = {
	sessionMiddleware,
	sessionParser,
	socketSessionMiddleware,
	SESSION_COOKIE,
};
