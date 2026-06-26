const crypto = require('crypto');

const DEFAULT_MAX_ENTRIES = 10000;
const limiters = new Map();
let lastPrune = 0;

function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function nowMs() {
    return Date.now();
}

function hashId(value) {
    if (!value) return 'anonymous';
    return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function clientIp(req) {
    return req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown-ip';
}

function socketIp(socket) {
    return socket.handshake?.address || socket.request?.socket?.remoteAddress || 'unknown-ip';
}

function httpSessionId(req) {
    return hashId(req.userId || req.sessionID || req.session?.id);
}

function socketSessionId(socket) {
    return hashId(socket.data?.userId || socket.request?.sessionID || socket.request?.session?.id);
}

function httpSessionKey(req) {
    return `session:${httpSessionId(req)}|ip:${hashId(clientIp(req))}`;
}

function httpIpKey(req) {
    return `ip:${hashId(clientIp(req))}`;
}

function socketSessionKey(socket) {
    return `session:${socketSessionId(socket)}|ip:${hashId(socketIp(socket))}`;
}

function getLimiter(name, { limit, windowMs, maxEntries = DEFAULT_MAX_ENTRIES }) {
    let limiter = limiters.get(name);
    if (!limiter) {
        limiter = { limit, windowMs, maxEntries, buckets: new Map() };
        limiters.set(name, limiter);
        return limiter;
    }
    limiter.limit = limit;
    limiter.windowMs = windowMs;
    limiter.maxEntries = maxEntries;
    return limiter;
}

function pruneLimiters(ts = nowMs()) {
    if (ts - lastPrune < 30000) return;
    lastPrune = ts;
    for (const limiter of limiters.values()) {
        for (const [key, bucket] of limiter.buckets.entries()) {
            if (bucket.resetAt <= ts) limiter.buckets.delete(key);
        }
        if (limiter.buckets.size <= limiter.maxEntries) continue;
        const overflow = limiter.buckets.size - limiter.maxEntries;
        let removed = 0;
        for (const key of limiter.buckets.keys()) {
            limiter.buckets.delete(key);
            removed += 1;
            if (removed >= overflow) break;
        }
    }
}

function checkRateLimit(name, key, options, ts = nowMs()) {
    pruneLimiters(ts);
    const limiter = getLimiter(name, options);
    let bucket = limiter.buckets.get(key);
    if (!bucket || bucket.resetAt <= ts) {
        bucket = { count: 0, resetAt: ts + limiter.windowMs };
        limiter.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const retryAfterMs = Math.max(0, bucket.resetAt - ts);
    const result = {
        ok: bucket.count <= limiter.limit,
        limit: limiter.limit,
        remaining: Math.max(0, limiter.limit - bucket.count),
        resetAt: bucket.resetAt,
        retryAfterMs,
    };
    return result;
}

function abuseLog(fields) {
    console.warn('[abuse]', {
        timestamp: new Date().toISOString(),
        ...fields,
    });
}

function rateLimitPayload(code, result) {
    return {
        error: 'rate-limited',
        code,
        message: 'Too many requests',
        retryAfterMs: result.retryAfterMs,
        limit: result.limit,
        resetAt: result.resetAt,
    };
}

function rateLimitMiddleware(name, options) {
    const {
        limit,
        windowMs,
        key = httpSessionKey,
        status = 429,
    } = options;
    return (req, res, next) => {
        const result = checkRateLimit(name, key(req), { limit, windowMs });
        if (result.ok) return next();
        const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
        res.set('Retry-After', String(retryAfterSeconds));
        abuseLog({
            kind: 'http-rate-limit',
            sessionId: httpSessionId(req),
            socketId: null,
            event: `${req.method} ${req.originalUrl}`,
            roomCode: req.params?.code || req.params?.id || null,
            limitName: name,
            ip: hashId(clientIp(req)),
            retryAfterMs: result.retryAfterMs,
        });
        return res.status(status).json(rateLimitPayload(name, result));
    };
}

function socketRateLimit(socket, event, options) {
    const result = checkRateLimit(`socket:${event}`, `${socketSessionKey(socket)}|event:${event}`, options);
    if (result.ok) return { ok: true, result };
    abuseLog({
        kind: 'socket-rate-limit',
        sessionId: socketSessionId(socket),
        socketId: socket.id,
        event,
        roomCode: socket.data?.roomCode || null,
        limitName: `socket:${event}`,
        ip: hashId(socketIp(socket)),
        retryAfterMs: result.retryAfterMs,
    });
    return {
        ok: false,
        payload: rateLimitPayload(`socket:${event}`, result),
    };
}

function socketConnectionRateLimit(name, options) {
    return (socket, next) => {
        const result = checkRateLimit(name, socketSessionKey(socket), options);
        if (result.ok) return next();
        abuseLog({
            kind: 'socket-connect-rate-limit',
            sessionId: socketSessionId(socket),
            socketId: socket.id,
            event: 'connection',
            roomCode: socket.handshake?.auth?.roomCode || null,
            limitName: name,
            ip: hashId(socketIp(socket)),
            retryAfterMs: result.retryAfterMs,
        });
        const err = new Error('rate-limited');
        err.data = rateLimitPayload(name, result);
        return next(err);
    };
}

function resetRateLimitState() {
    limiters.clear();
    lastPrune = 0;
}

module.exports = {
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
    socketConnectionRateLimit,
    abuseLog,
    rateLimitPayload,
    resetRateLimitState,
};
