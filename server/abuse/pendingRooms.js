const { activeRooms, deleteRoom } = require('../game/state');
const { positiveInt, abuseLog, hashId } = require('./rateLimit');

const DEFAULT_PENDING_HOST_CONNECT_MS = 60000;
const PENDING_HOST_CONNECT_MS = positiveInt(
	process.env.PENDING_HOST_CONNECT_MS,
	DEFAULT_PENDING_HOST_CONNECT_MS,
);

const pendingTimers = new Map();
let cleanupRoomFn = null;

function configurePendingRoomCleanup(fn) {
	cleanupRoomFn = typeof fn === 'function' ? fn : null;
}

function hostHasConnected(room) {
	return !!room?.players?.some((p) => p.userId === room.hostUserId && p.socketId);
}

function schedulePendingRoomCleanup(room) {
	if (!room || pendingTimers.has(room.roomCode)) return;
	room.cleanupAt = Date.now() + PENDING_HOST_CONNECT_MS;
	room.cleanupReason = 'pending-host-connect';
	const timer = setTimeout(() => {
		pendingTimers.delete(room.roomCode);
		const current = activeRooms.get(room.roomCode);
		if (!current || current.started || hostHasConnected(current)) return;
		abuseLog({
			kind: 'pending-room-cleanup',
			sessionId: hashId(current.hostUserId),
			socketId: null,
			event: 'POST /api/rooms',
			roomCode: current.roomCode,
			limitName: 'pending-host-connect',
			retryAfterMs: 0,
		});
		if (cleanupRoomFn) cleanupRoomFn(current.roomCode, 'pending-host-connect');
		else deleteRoom(current.roomCode);
	}, PENDING_HOST_CONNECT_MS);
	pendingTimers.set(room.roomCode, timer);
}

function clearPendingRoomCleanup(roomCode) {
	const timer = pendingTimers.get(roomCode);
	if (!timer) return;
	clearTimeout(timer);
	pendingTimers.delete(roomCode);
	const room = activeRooms.get(roomCode);
	if (room && room.cleanupReason === 'pending-host-connect') {
		room.cleanupAt = null;
		room.cleanupReason = null;
	}
}

function shutdownPendingRoomCleanup() {
	for (const timer of pendingTimers.values()) clearTimeout(timer);
	pendingTimers.clear();
}

function pendingRoomStats() {
	return { pendingHostTimers: pendingTimers.size };
}

module.exports = {
	PENDING_HOST_CONNECT_MS,
	configurePendingRoomCleanup,
	schedulePendingRoomCleanup,
	clearPendingRoomCleanup,
	shutdownPendingRoomCleanup,
	pendingRoomStats,
};
