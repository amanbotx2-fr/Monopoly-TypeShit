require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { sessionMiddleware, sessionParser, socketSessionMiddleware } = require('./middleware/session');
const registerSocketHandlers = require('./socket/handlers');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5004;
const DEFAULT_CLIENT_URL = 'http://localhost:3000';
const CLIENT_URL = process.env.CLIENT_URL || DEFAULT_CLIENT_URL;
const ALLOWED_ORIGINS = CLIENT_URL
    .split(',')
    .map(origin => origin.trim())
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
app.use(cookieParser());
app.use(sessionMiddleware);
io.engine.use(sessionParser);
io.use(socketSessionMiddleware);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/monopoly')
    .then(() => console.log('[mongo] connected'))
    .catch(err => console.error('[mongo] connection error:', err.message));

app.use('/api', require('./routes/rooms'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/me', (req, res) => res.json({ userId: req.userId }));

const roomLifecycle = registerSocketHandlers(io);

server.listen(PORT, () => console.log(`[monopoly] server on ${PORT}`));

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[monopoly] ${signal} received, cleaning up rooms`);
    roomLifecycle.shutdown();
    server.close(() => {
        mongoose.connection.close(false).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
