// Anonymous guest identity backed by express-session. The browser only stores
// a signed session id; the player identity lives server-side in req.session.

const crypto = require('crypto');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

const SESSION_COOKIE = 'monopoly.sid';
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 365; // 1 year

function isProductionEnv(env = process.env) {
	return env.NODE_ENV === 'production';
}

function sessionSecret(env = process.env) {
	const secret = env.SESSION_SECRET;
	if (secret) return secret;
	if (isProductionEnv(env)) throw new Error('SESSION_SECRET is required in production');
	return 'dev-only-monopoly-session-secret';
}

function mongoStore(env = process.env, storeFactory = MongoStore) {
	const uri = env.SESSION_STORE_MONGODB_URI || env.MONGODB_URI;
	if (!uri) {
		if (isProductionEnv(env)) {
			throw new Error(
				'Production session storage requires SESSION_STORE_MONGODB_URI or MONGODB_URI',
			);
		}
		return undefined;
	}
	return storeFactory.create({
		mongoUrl: uri,
		collectionName: 'sessions',
		ttl: 60 * 60 * 24 * 365, // 1 year — matches SESSION_MAX_AGE
		autoRemove: 'native',
	});
}

function createSessionParser({
	env = process.env,
	sessionImpl = session,
	storeFactory = MongoStore,
} = {}) {
	const isProduction = isProductionEnv(env);
	return sessionImpl({
		name: SESSION_COOKIE,
		secret: sessionSecret(env),
		resave: false,
		saveUninitialized: true,
		store: mongoStore(env, storeFactory),
		cookie: {
			httpOnly: true,
			sameSite: isProduction ? 'none' : 'lax',
			secure: isProduction,
			maxAge: SESSION_MAX_AGE,
			path: '/',
		},
	});
}

const sessionParser = createSessionParser();

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
	createSessionParser,
	isProductionEnv,
	sessionSecret,
	mongoStore,
	sessionMiddleware,
	sessionParser,
	socketSessionMiddleware,
	SESSION_COOKIE,
	SESSION_MAX_AGE,
};
