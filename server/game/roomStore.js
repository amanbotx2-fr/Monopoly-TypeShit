const GameRoom = require('../models/GameRoom');
const { activeRooms, hydrateRestoredRoom, stripTransient, getRoom } = require('./state');

const restoreInflight = new Map();

async function saveRoomSnapshot(room) {
	if (!room?.roomCode) return false;
	try {
		await GameRoom.findOneAndUpdate(
			{ roomCode: room.roomCode },
			{
				roomCode: room.roomCode,
				hostUserId: room.hostUserId,
				state: stripTransient(room),
				lastActivity: new Date(),
			},
			{ upsert: true },
		);
		return true;
	} catch {
		/* mongo optional in dev */
		return false;
	}
}

async function deleteRoomSnapshot(roomCode) {
	if (!roomCode) return false;
	try {
		await GameRoom.deleteOne({ roomCode });
		return true;
	} catch {
		/* mongo optional in dev */
		return false;
	}
}

async function restoreRoomByCode(roomCode) {
	if (!roomCode) return null;
	const existing = getRoom(roomCode);
	if (existing) return existing;
	if (restoreInflight.has(roomCode)) return restoreInflight.get(roomCode);

	const restore = (async () => {
		try {
			const doc = await GameRoom.findOne({ roomCode }).lean();
			const room = hydrateRestoredRoom(doc);
			if (!room) return null;
			if (room.roomCode !== roomCode) return null;

			const active = getRoom(room.roomCode);
			if (active) return active;
			activeRooms.set(room.roomCode, room);
			return room;
		} catch {
			/* mongo optional in dev */
			return null;
		} finally {
			restoreInflight.delete(roomCode);
		}
	})();

	restoreInflight.set(roomCode, restore);
	return restore;
}

async function restoreRecentRooms({ limit = 0 } = {}) {
	const capped = Number.isInteger(limit) && limit > 0 ? limit : 0;
	if (!capped) return 0;

	try {
		const docs = await GameRoom.find({
			'state.ended': { $ne: true },
			'state.lifecycle': { $in: ['waiting-for-players', 'in-progress', 'empty-grace'] },
		})
			.sort({ lastActivity: -1 })
			.limit(capped)
			.lean();

		let restored = 0;
		for (const doc of docs) {
			const room = hydrateRestoredRoom(doc);
			if (!room || getRoom(room.roomCode)) continue;
			activeRooms.set(room.roomCode, room);
			restored++;
		}
		return restored;
	} catch {
		/* mongo optional in dev */
		return 0;
	}
}

module.exports = {
	saveRoomSnapshot,
	deleteRoomSnapshot,
	restoreRoomByCode,
	restoreRecentRooms,
};
