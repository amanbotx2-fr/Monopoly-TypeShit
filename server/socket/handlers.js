// Socket.io layer. Every inbound event goes through `handle()` which (a)
// resolves the player, (b) calls the matching engine action, (c) broadcasts
// the resulting delta + events to the whole room. We keep logic in
// game/*.js so this file stays thin.

const {
    activeRooms, getRoom, deleteRoom, publicView, bumpVersion,
    appendChat, appendLog, TOKEN_COLORS,
} = require('../game/state');
const engine = require('../game/engine');
const property = require('../game/property');
const auction = require('../game/auction');
const trade = require('../game/trade');
const GameRoom = require('../models/GameRoom');
const validation = require('../validation/payloads');
const { socketRateLimit, positiveInt } = require('../abuse/rateLimit');
const { clearPendingRoomCleanup, shutdownPendingRoomCleanup, pendingRoomStats } = require('../abuse/pendingRooms');

const DEFAULT_IDLE_CLEANUP_MS = 15 * 60 * 1000;
const SAVE_INTERVAL = 30000;
const IDLE_CLEANUP_MS = positiveInt(process.env.ROOM_IDLE_TIMEOUT_MS, DEFAULT_IDLE_CLEANUP_MS);
const SOCKET_LIMITS = {
    default: {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_DEFAULT_PER_10_SEC, 120),
        windowMs: 10000,
    },
    chat: {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_CHAT_PER_10_SEC, 8),
        windowMs: 10000,
    },
    'trade-propose': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_TRADE_PROPOSE_PER_MIN, 10),
        windowMs: 60000,
    },
    'trade-update': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_TRADE_UPDATE_PER_10_SEC, 20),
        windowMs: 10000,
    },
    'trade-msg': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_TRADE_MSG_PER_10_SEC, 10),
        windowMs: 10000,
    },
    'auction-bid': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_AUCTION_BID_PER_10_SEC, 20),
        windowMs: 10000,
    },
    'auction-pass': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_AUCTION_PASS_PER_10_SEC, 10),
        windowMs: 10000,
    },
    'set-username': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_USERNAME_PER_MIN, 6),
        windowMs: 60000,
    },
    'set-color': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_COLOR_PER_MIN, 12),
        windowMs: 60000,
    },
    'update-rules': {
        limit: positiveInt(process.env.RATE_LIMIT_SOCKET_RULES_PER_10_SEC, 20),
        windowMs: 10000,
    },
};
const saveTimers = new Map();
const idleTimers = new Map();
let auctionHeartbeat = null;

async function saveRoomSnapshot(room) {
    try {
        await GameRoom.findOneAndUpdate(
            { roomCode: room.roomCode },
            { roomCode: room.roomCode, hostUserId: room.hostUserId, state: stripTransient(room), lastActivity: new Date() },
            { upsert: true }
        );
    } catch (e) { /* mongo optional in dev */ }
}

function startAutoSave(roomCode) {
    if (saveTimers.has(roomCode)) return;
    const t = setInterval(async () => {
        const r = getRoom(roomCode);
        if (!r) { clearInterval(t); saveTimers.delete(roomCode); return; }
        await saveRoomSnapshot(r);
    }, SAVE_INTERVAL);
    saveTimers.set(roomCode, t);
}
function stopAutoSave(roomCode) {
    const t = saveTimers.get(roomCode);
    if (t) { clearInterval(t); saveTimers.delete(roomCode); }
}
function stripTransient(room) {
    return {
        ...room,
        players: room.players.map(p => ({ ...p, socketId: null, connected: true })),
        spectators: room.spectators.map(s => ({ ...s, socketId: null })),
    };
}

function cancelIdleCleanup(roomCode) {
    const t = idleTimers.get(roomCode);
    if (!t) return;
    clearTimeout(t);
    idleTimers.delete(roomCode);
    const room = getRoom(roomCode);
    if (room) {
        room.cleanupAt = null;
        room.cleanupReason = null;
        if (room.lifecycle === 'empty-grace') {
            room.lifecycle = room.ended ? 'finished' : (room.started ? 'in-progress' : 'waiting-for-players');
        }
    }
}

function connectedPlayers(room) {
    return room.players.filter(p => p.socketId).length;
}

function scheduleIdleCleanup(io, room, reason = 'idle-timeout') {
    if (!room || idleTimers.has(room.roomCode)) return;
    room.lifecycle = 'empty-grace';
    room.cleanupReason = reason;
    room.cleanupAt = Date.now() + IDLE_CLEANUP_MS;
    const t = setTimeout(() => {
        cleanupRoom(io, room.roomCode, reason);
    }, IDLE_CLEANUP_MS);
    idleTimers.set(room.roomCode, t);
}

function disconnectRoomSockets(io, roomCode, reason) {
    const socketIds = io.sockets.adapter.rooms.get(roomCode);
    if (!socketIds) return;
    for (const socketId of [...socketIds]) {
        const s = io.sockets.sockets.get(socketId);
        if (!s) continue;
        s.data.roomDeleted = true;
        s.emit('room-closed', { reason });
        s.leave(roomCode);
        s.disconnect(true);
    }
}

function cleanupRoom(io, roomCode, reason = 'cleanup') {
    clearPendingRoomCleanup(roomCode);
    cancelIdleCleanup(roomCode);
    stopAutoSave(roomCode);

    const room = getRoom(roomCode);
    if (!room) return false;

    room.lifecycle = 'deleting';
    room.cleanupReason = reason;
    room.cleanupAt = null;
    room.auction = null;
    room.trades = [];
    for (const p of room.players) {
        p.socketId = null;
        p.connected = false;
    }
    room.spectators = [];

    disconnectRoomSockets(io, roomCode, reason);
    deleteRoom(roomCode);
    return true;
}

function setActiveLifecycle(room) {
    if (!room) return;
    room.lifecycle = room.ended ? 'finished' : (room.started ? 'in-progress' : 'waiting-for-players');
    room.cleanupAt = null;
    room.cleanupReason = null;
}

function evaluateRoomLifecycle(io, room, reason = 'disconnect') {
    if (!room || !getRoom(room.roomCode)) return;
    if (!room.started) {
        if (connectedPlayers(room) === 0) cleanupRoom(io, room.roomCode, reason);
        return;
    }
    if (connectedPlayers(room) === 0) scheduleIdleCleanup(io, room, reason);
}

function broadcast(io, room, events = []) {
    bumpVersion(room);
    io.to(room.roomCode).emit('state', { room: publicView(room), events });
    if (room.ended) {
        room.lifecycle = 'finished';
        stopAutoSave(room.roomCode);
        saveRoomSnapshot(room);
    }
}

function sysChat(io, room, text) {
    const msg = appendChat(room, { userId: null, username: 'System', text, system: true });
    io.to(room.roomCode).emit('chat', msg);
}

function emitValidationError(socket, event, result) {
    console.warn('[validation]', {
        event,
        socketId: socket.id,
        userId: socket.data.userId,
        roomCode: socket.data.roomCode,
        code: result.error,
        details: result.details,
    });
    socket.emit('validation-error', {
        event,
        error: 'validation',
        code: result.error,
        message: result.message,
        details: result.details,
    });
    socket.emit('error-msg', result.message || result.error);
    return false;
}

function emitRateLimitError(socket, event, payload) {
    socket.emit('rate-limit', { event, ...payload });
    socket.emit('error-msg', 'rate-limited');
    return false;
}

function checkSocketEventRate(socket, event) {
    return socketRateLimit(socket, event, SOCKET_LIMITS[event] || SOCKET_LIMITS.default);
}

function validatePayloadArgs(socket, event, args, validator) {
    const payload = validation.oneObjectPayload(args, event);
    if (!payload.ok) return payload;
    return validator(payload.value, socket);
}

function bindPayloadEvent(socket, event, validator, handler) {
    socket.on(event, (...args) => safe(() => {
        const rate = checkSocketEventRate(socket, event);
        if (!rate.ok) return emitRateLimitError(socket, event, rate.payload);
        const result = validatePayloadArgs(socket, event, args, validator);
        if (!result.ok) return emitValidationError(socket, event, result);
        handler(result.value);
    }, socket));
}

function bindNoPayloadEvent(socket, event, handler) {
    socket.on(event, (...args) => safe(() => {
        const rate = checkSocketEventRate(socket, event);
        if (!rate.ok) return emitRateLimitError(socket, event, rate.payload);
        const result = validation.noPayload(args, event);
        if (!result.ok) return emitValidationError(socket, event, result);
        handler();
    }, socket));
}

function roomForSocket(socket) {
    const room = getRoom(socket.data.roomCode);
    if (!room) return validation.fail('room-not-found', 'room not found');
    return validation.ok(room);
}

function activePlayerForSocket(socket, room) {
    const player = requirePlayer(room, socket.data.userId);
    if (!player) return validation.fail('bad-player', 'socket is not an active player in this room');
    return validation.ok(player);
}

function playerForSocket(socket, room) {
    const player = room.players.find(p => p.userId === socket.data.userId);
    if (!player) return validation.fail('bad-player', 'socket is not a player in this room');
    return validation.ok(player);
}

function validateAuctionBidEvent(payload, socket) {
    const room = roomForSocket(socket);
    if (!room.ok) return room;
    const player = activePlayerForSocket(socket, room.value);
    if (!player.ok) return player;
    return validation.validateAuctionBidPayload(payload, player.value, room.value);
}

function validateTradeEvent(payload, socket, options) {
    const room = roomForSocket(socket);
    if (!room.ok) return room;
    const player = activePlayerForSocket(socket, room.value);
    if (!player.ok) return player;
    return validation.validateTradePayload(payload, room.value, player.value, options);
}

function validateTradeActionEvent(payload, socket, label) {
    const room = roomForSocket(socket);
    if (!room.ok) return room;
    const player = activePlayerForSocket(socket, room.value);
    if (!player.ok) return player;
    const id = validation.validateTradeIdPayload(payload, label);
    if (!id.ok) return id;
    const tr = room.value.trades.find(t => t.id === id.value.tradeId);
    if (!tr || tr.status !== 'open') return validation.fail('bad-trade-id', 'trade is not open');
    if (player.value.userId !== tr.fromUserId && player.value.userId !== tr.toUserId) {
        return validation.fail('bad-trade-party', 'actor is not part of this trade');
    }
    return id;
}

function validateTradeMessageEvent(payload, socket) {
    const room = roomForSocket(socket);
    if (!room.ok) return room;
    const player = activePlayerForSocket(socket, room.value);
    if (!player.ok) return player;
    const msg = validation.validateTradeMsgPayload(payload);
    if (!msg.ok) return msg;
    const tr = room.value.trades.find(t => t.id === msg.value.tradeId);
    if (!tr || tr.status !== 'open') return validation.fail('bad-trade-id', 'trade is not open');
    if (player.value.userId !== tr.fromUserId && player.value.userId !== tr.toUserId) {
        return validation.fail('bad-trade-party', 'actor is not part of this trade');
    }
    return msg;
}

function validateBankruptEvent(payload, socket) {
    const room = roomForSocket(socket);
    if (!room.ok) return room;
    const player = playerForSocket(socket, room.value);
    if (!player.ok) return player;
    return validation.validateBankruptPayload(payload, room.value, player.value);
}

function replaceExistingSocket(io, socket, oldSocketId) {
    if (!oldSocketId || oldSocketId === socket.id) return;
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (!oldSocket) return;
    oldSocket.data.replacedBy = socket.id;
    oldSocket.disconnect(true);
}

// Room metadata comes from the client, but identity comes only from the
// express-session-backed Socket.IO middleware.
function identify(socket, auth) {
    const { roomCode } = auth;
    const userId = socket.data.userId;
    if (!userId || !roomCode) return null;
    const room = getRoom(roomCode);
    if (!room) return null;
    return { room, userId };
}

function onJoin(io, socket, payload) {
    const auth = validation.validateSocketAuth(payload, TOKEN_COLORS);
    if (!auth.ok) {
        emitValidationError(socket, 'connection', auth);
        socket.disconnect(true);
        return false;
    }
    const ident = identify(socket, auth.value);
    if (!ident) {
        socket.emit('error-msg', 'invalid-session');
        socket.disconnect(true);
        return false;
    }
    const { room, userId } = ident;
    const { username, color, asSpectator } = auth.value;
    if (userId === room.hostUserId) clearPendingRoomCleanup(room.roomCode);
    cancelIdleCleanup(room.roomCode);
    setActiveLifecycle(room);

    socket.join(room.roomCode);
    socket.data.roomCode = room.roomCode;
    socket.data.userId = userId;

    const existing = room.players.find(p => p.userId === userId);
    if (existing) {
        replaceExistingSocket(io, socket, existing.socketId);
        existing.socketId = socket.id;
        existing.connected = true;
        if (username) existing.username = username;
        broadcast(io, room, [{ type: 'player-reconnect', userId }]);
        return true;
    }
    const existingSpectator = room.spectators.find(s => s.userId === userId);
    if (existingSpectator) {
        replaceExistingSocket(io, socket, existingSpectator.socketId);
        existingSpectator.socketId = socket.id;
        if (username) existingSpectator.username = username;
        broadcast(io, room, [{ type: 'spectator-join', userId }]);
        evaluateRoomLifecycle(io, room, 'playerless-spectator');
        return true;
    }
    if (asSpectator || room.started) {
        const spec = room.spectators.find(s => s.userId === userId);
        if (spec) {
            replaceExistingSocket(io, socket, spec.socketId);
            spec.socketId = socket.id;
        }
        else {
            room.spectators.push({ userId, username: (username || 'Spectator').slice(0, 24), socketId: socket.id });
        }
        broadcast(io, room, [{ type: 'spectator-join', userId }]);
        evaluateRoomLifecycle(io, room, 'playerless-spectator');
        return true;
    }
    if (room.players.length >= 8) {
        socket.emit('error-msg', 'room-full');
        socket.disconnect(true);
        return false;
    }

    // Color conflict → auto-pick next free color.
    let hex = color || TOKEN_COLORS[room.players.length].hex;
    if (room.players.some(p => p.color === hex)) {
        const free = TOKEN_COLORS.find(c => !room.players.some(p => p.color === c.hex));
        hex = free?.hex || TOKEN_COLORS[0].hex;
    }
    const { createPlayerState } = require('../game/state');
    const p = createPlayerState({
        userId,
        username: (username || 'Guest').slice(0, 24),
        color: hex,
        seat: room.players.length,
        isHost: false,
        startingCash: room.rules.startingCash,
    });
    p.socketId = socket.id;
    room.players.push(p);
    sysChat(io, room, `${p.username} joined`);
    broadcast(io, room, [{ type: 'player-join', userId }]);
    return true;
}

function requirePlayer(room, userId) {
    return room.players.find(p => p.userId === userId && !p.bankrupt) || null;
}
function requireActive(room, userId) {
    const active = room.players[room.turnIndex];
    return active && active.userId === userId ? active : null;
}

// ─── Dispatch table ──────────────────────────────────────────────────────────
const handlers = {
    'chat': (io, socket, { text }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = room.players.find(pl => pl.userId === socket.data.userId)
               || room.spectators.find(s => s.userId === socket.data.userId);
        if (!p) return;
        const msg = appendChat(room, { userId: p.userId, username: p.username, text });
        io.to(room.roomCode).emit('chat', msg);
    },

    'set-color': (io, socket, { color }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room || room.started) return;
        const p = room.players.find(pl => pl.userId === socket.data.userId);
        if (!p) return;
        if (room.players.some(x => x !== p && x.color === color)) return socket.emit('error-msg', 'color-taken');
        p.color = color;
        broadcast(io, room, [{ type: 'player-color', userId: p.userId }]);
    },

    'set-username': (io, socket, { username }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = room.players.find(pl => pl.userId === socket.data.userId)
               || room.spectators.find(s => s.userId === socket.data.userId);
        if (!p) return;
        p.username = username;
        broadcast(io, room, [{ type: 'player-rename', userId: p.userId }]);
    },

    'update-rules': (io, socket, { rules }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room || room.started) return;
        if (socket.data.userId !== room.hostUserId) return socket.emit('error-msg', 'not-host');
        const allow = ['startingCash', 'salary', 'doubleOnGo', 'freeParkingPot', 'auctionUnbought',
                       'noRentInJail', 'evenBuild', 'mortgageRebuyRate', 'jailFine', 'jailTurnsMax',
                       'xDoubles', 'turnClockSeconds', 'allowDevOnMortgaged', 'randomTurnOrder'];
        for (const k of allow) if (k in (rules || {})) room.rules[k] = rules[k];
        // Refund/charge starting cash adjustments before game starts so players
        // see the current number in lobby.
        for (const p of room.players) p.cash = room.rules.startingCash;
        broadcast(io, room, [{ type: 'rules-updated' }]);
    },

    'kick': (io, socket, { userId }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room || room.started) return;
        if (socket.data.userId !== room.hostUserId) return;
        if (userId === room.hostUserId) return;
        const idx = room.players.findIndex(p => p.userId === userId);
        if (idx === -1) return;
        const [removed] = room.players.splice(idx, 1);
        // Reindex seats.
        room.players.forEach((p, i) => p.seat = i);
        sysChat(io, room, `${removed.username} was removed by host`);
        broadcast(io, room, [{ type: 'player-kick', userId }]);
    },

    'start-game': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        if (socket.data.userId !== room.hostUserId) return socket.emit('error-msg', 'not-host');
        if (room.started) return;
        if (room.players.length < 2) return socket.emit('error-msg', 'need-2-players');
        if (room.rules.randomTurnOrder) {
            // Shuffle player array and re-assign seats.
            for (let i = room.players.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
            }
            room.players.forEach((p, i) => p.seat = i);
        }
        room.started = true;
        room.turnIndex = 0;
        room.turnPhase = 'awaiting-roll';
        room.turnStartedAt = Date.now();
        room.lifecycle = 'in-progress';
        room.cleanupAt = null;
        room.cleanupReason = null;
        appendLog(room, { kind: 'game-start' });
        // First turn-start doesn't come through endTurn, so log it here.
        appendLog(room, { kind: 'turn-start', userId: room.players[0].userId });
        startAutoSave(room.roomCode);
        sysChat(io, room, `Game started — ${room.players[0].username} goes first.`);
        broadcast(io, room, [{ type: 'game-start' }, { type: 'turn-start', userId: room.players[0].userId }]);
    },

    'roll': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requireActive(room, socket.data.userId);
        if (!p) return socket.emit('error-msg', 'not-your-turn');
        const r = engine.rollAndMove(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'buy': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requireActive(room, socket.data.userId);
        if (!p) return;
        const r = engine.buyCurrent(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'decline-buy': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requireActive(room, socket.data.userId);
        if (!p) return;
        const r = engine.declineBuy(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'end-turn': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requireActive(room, socket.data.userId);
        if (!p) return;
        const r = engine.endTurn(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'jail-pay':  (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        const p = requireActive(room, socket.data.userId);
        if (!room || !p) return;
        const r = engine.payJailFine(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
    'jail-card': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        const p = requireActive(room, socket.data.userId);
        if (!room || !p) return;
        const r = engine.useJailCard(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'mortgage':   (io, socket, { pos }) => doPropAction(io, socket, p => property.mortgage, pos),
    'unmortgage': (io, socket, { pos }) => doPropAction(io, socket, p => property.unmortgage, pos),
    'build':      (io, socket, { pos }) => doPropAction(io, socket, p => property.buildHouse, pos),
    'demolish':   (io, socket, { pos }) => doPropAction(io, socket, p => property.sellHouse, pos),

    'auction-bid':  (io, socket, { amount }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = auction.placeBid(room, p, amount);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
    'auction-pass': (io, socket) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = auction.pass(room, p);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'trade-propose': (io, socket, { toUserId, offer, request }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = trade.proposeTrade(room, p, toUserId, offer, request);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
    'trade-update': (io, socket, { tradeId, offer, request }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = trade.updateTrade(room, p, tradeId, offer, request);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
    'trade-accept': (io, socket, { tradeId }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = trade.acceptTrade(room, p, tradeId);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
    'trade-reject': (io, socket, { tradeId }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = trade.rejectOrCancelTrade(room, p, tradeId);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
    'trade-msg': (io, socket, { tradeId, text }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = requirePlayer(room, socket.data.userId);
        if (!p) return;
        const r = trade.tradeMessage(room, p, tradeId, text);
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },

    'bankrupt': (io, socket, { creditorUserId }) => {
        const room = getRoom(socket.data.roomCode);
        if (!room) return;
        const p = room.players.find(pl => pl.userId === socket.data.userId);
        if (!p) return;
        const r = engine.declareBankruptcy(room, p, creditorUserId);
        if (r.ok) room.pendingDebt = null;
        if (!r.ok) return socket.emit('error-msg', r.error);
        broadcast(io, room, r.events);
    },
};

function doPropAction(io, socket, getFn, pos) {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;
    const p = room.players.find(pl => pl.userId === socket.data.userId);
    if (!p) return;
    const action = getFn(p);
    const r = action(room, p, pos);
    if (!r.ok) return socket.emit('error-msg', r.error);
    broadcast(io, room, r.events);
}

function shutdownLifecycle(io) {
    if (auctionHeartbeat) {
        clearInterval(auctionHeartbeat);
        auctionHeartbeat = null;
    }
    shutdownPendingRoomCleanup();
    for (const roomCode of [...activeRooms.keys()]) {
        cleanupRoom(io, roomCode, 'server-shutdown');
    }
    for (const roomCode of [...saveTimers.keys()]) stopAutoSave(roomCode);
    for (const roomCode of [...idleTimers.keys()]) cancelIdleCleanup(roomCode);
}

function registerSocketHandlers(io) {
    // Heartbeat for auction timers. Runs every second across all rooms, only
    // checks rooms that actually have an open auction.
    auctionHeartbeat = setInterval(() => {
        for (const room of activeRooms.values()) {
            if (!room.auction) continue;
            const r = auction.maybeCloseOnTimeout(room);
            if (r && r.events && r.events.length) broadcast(io, room, r.events);
        }
    }, 1000);

    io.on('connection', (socket) => {
        if (!onJoin(io, socket, socket.handshake.auth)) return;

        bindPayloadEvent(socket, 'chat',          validation.validateChatPayload, p => handlers['chat'](io, socket, p));
        bindPayloadEvent(socket, 'set-color',     p => validation.validateColorPayload(p, TOKEN_COLORS), p => handlers['set-color'](io, socket, p));
        bindPayloadEvent(socket, 'set-username',  validation.validateUsernamePayload, p => handlers['set-username'](io, socket, p));
        bindPayloadEvent(socket, 'update-rules',  validation.validateRulesPayload, p => handlers['update-rules'](io, socket, p));
        bindPayloadEvent(socket, 'kick',          p => {
            const room = roomForSocket(socket);
            if (!room.ok) return room;
            return validation.validateKickPayload(p, room.value);
        }, p => handlers['kick'](io, socket, p));
        bindNoPayloadEvent(socket, 'start-game',    () => handlers['start-game'](io, socket));
        bindNoPayloadEvent(socket, 'roll',          () => handlers['roll'](io, socket));
        bindNoPayloadEvent(socket, 'buy',           () => handlers['buy'](io, socket));
        bindNoPayloadEvent(socket, 'decline-buy',   () => handlers['decline-buy'](io, socket));
        bindNoPayloadEvent(socket, 'end-turn',      () => handlers['end-turn'](io, socket));
        bindNoPayloadEvent(socket, 'jail-pay',      () => handlers['jail-pay'](io, socket));
        bindNoPayloadEvent(socket, 'jail-card',     () => handlers['jail-card'](io, socket));
        bindPayloadEvent(socket, 'mortgage',      p => validation.validatePosPayload(p, 'mortgage'), p => handlers['mortgage'](io, socket, p));
        bindPayloadEvent(socket, 'unmortgage',    p => validation.validatePosPayload(p, 'unmortgage'), p => handlers['unmortgage'](io, socket, p));
        bindPayloadEvent(socket, 'build',         p => validation.validatePosPayload(p, 'build'), p => handlers['build'](io, socket, p));
        bindPayloadEvent(socket, 'demolish',      p => validation.validatePosPayload(p, 'demolish'), p => handlers['demolish'](io, socket, p));
        bindPayloadEvent(socket, 'auction-bid',   (p) => validateAuctionBidEvent(p, socket), p => handlers['auction-bid'](io, socket, p));
        bindNoPayloadEvent(socket, 'auction-pass',  () => handlers['auction-pass'](io, socket));
        bindPayloadEvent(socket, 'trade-propose', p => validateTradeEvent(p, socket, { requireRecipient: true }), p => handlers['trade-propose'](io, socket, p));
        bindPayloadEvent(socket, 'trade-update',  p => validateTradeEvent(p, socket, { requireRecipient: false }), p => handlers['trade-update'](io, socket, p));
        bindPayloadEvent(socket, 'trade-accept',  p => validateTradeActionEvent(p, socket, 'trade-accept'), p => handlers['trade-accept'](io, socket, p));
        bindPayloadEvent(socket, 'trade-reject',  p => validateTradeActionEvent(p, socket, 'trade-reject'), p => handlers['trade-reject'](io, socket, p));
        bindPayloadEvent(socket, 'trade-msg',     p => validateTradeMessageEvent(p, socket), p => handlers['trade-msg'](io, socket, p));
        bindPayloadEvent(socket, 'bankrupt',      p => validateBankruptEvent(p, socket), p => handlers['bankrupt'](io, socket, p));

        socket.on('disconnect', () => {
            if (socket.data.replacedBy || socket.data.roomDeleted) return;
            const room = getRoom(socket.data.roomCode);
            if (!room) return;
            const p = room.players.find(pl => pl.socketId === socket.id);
            if (p) { p.connected = false; p.socketId = null; }
            const s = room.spectators.find(sp => sp.socketId === socket.id);
            if (s) s.socketId = null;

            if (!room.started && socket.data.userId === room.hostUserId) {
                cleanupRoom(io, room.roomCode, 'host-disconnect-before-start');
                return;
            }

            broadcast(io, room, [{ type: 'player-disconnect', userId: socket.data.userId }]);
            evaluateRoomLifecycle(io, room, 'idle-disconnect');
        });
    });

    return {
        cleanupRoom: (roomCode, reason) => cleanupRoom(io, roomCode, reason),
        shutdown: () => shutdownLifecycle(io),
        stats: () => ({
            activeRooms: activeRooms.size,
            saveTimers: saveTimers.size,
            idleTimers: idleTimers.size,
            ...pendingRoomStats(),
            auctionHeartbeat: auctionHeartbeat ? 1 : 0,
        }),
    };
}

function safe(fn, socket) {
    try { fn(); }
    catch (e) {
        console.error('[socket handler]', e);
        socket.emit('error-msg', 'server-error');
    }
}

module.exports = registerSocketHandlers;
