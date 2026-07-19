const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const {
	sessionMiddleware,
	sessionParser,
	socketSessionMiddleware,
} = require('./middleware/session');
const { attachCsrfToken, requireCsrf } = require('./middleware/csrf');
const registerSocketHandlers = require('./socket/handlers');
const { positiveInt, socketConnectionRateLimit } = require('./abuse/rateLimit');
const { configurePendingRoomCleanup, shutdownPendingRoomCleanup } = require('./abuse/pendingRooms');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5004;
const DEFAULT_CLIENT_URL = 'http://localhost:3000';
const CLIENT_URL = process.env.CLIENT_URL || DEFAULT_CLIENT_URL;
const ALLOWED_ORIGINS = CLIENT_URL.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

function isAllowedOrigin(origin) {
	// Non-browser requests such as health checks and server-to-server calls do
	// not send Origin. Browser CORS is still restricted to ALLOWED_ORIGINS.
	if (!origin) return true;
	return ALLOWED_ORIGINS.includes(origin);
}

const corsOptions = {
	origin(origin, callback) {
		if (isAllowedOrigin(origin)) return callback(null, true);
		return callback(new Error(`CORS blocked for origin: ${origin}`));
	},
	credentials: true,
};

const io = new Server(server, {
	cors: corsOptions,
	pingInterval: 10000,
	pingTimeout: 15000,
});

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use((err, req, res, next) => {
	if (err?.type === 'entity.too.large') {
		console.warn('[validation]', {
			route: `${req.method} ${req.originalUrl}`,
			code: 'payload-too-large',
			details: err.message,
		});
		return res.status(413).json({
			error: 'validation',
			code: 'payload-too-large',
			message: 'Payload is too large',
		});
	}
	if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
		console.warn('[validation]', {
			route: `${req.method} ${req.originalUrl}`,
			code: 'invalid-json',
			details: err.message,
		});
		return res.status(400).json({
			error: 'validation',
			code: 'invalid-json',
			message: 'Malformed JSON body',
		});
	}
	return next(err);
});
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(attachCsrfToken);
app.use('/api', requireCsrf);
io.engine.use(sessionParser);
io.use(socketSessionMiddleware);
io.use(
	socketConnectionRateLimit('socket-connect', {
		limit: positiveInt(process.env.RATE_LIMIT_SOCKET_CONNECT_PER_MIN, 30),
		windowMs: 60 * 1000,
	}),
);

let roomLifecycle = null;

mongoose
	.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/monopoly')
	.then(async () => {
		console.info('[mongo] connected');
		roomLifecycle = await registerSocketHandlers(io);
		configurePendingRoomCleanup(roomLifecycle.cleanupRoom);
		server.listen(PORT, () => console.info(`[monopoly] server on ${PORT}`));
	})
	.catch((err) => console.error('[mongo] connection error:', err.message));

app.use('/api', require('./routes/rooms'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/me', (req, res) => res.json({ userId: req.userId, csrfToken: req.csrfToken }));

let shuttingDown = false;
function shutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;
	console.info(`[monopoly] ${signal} received, cleaning up rooms`);
	shutdownPendingRoomCleanup();
	if (roomLifecycle) roomLifecycle.shutdown();
	server.close(() => {
		mongoose.connection.close(false).finally(() => process.exit(0));
	});
	setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
