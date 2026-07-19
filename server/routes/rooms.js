// HTTP endpoints for room management. The live game traffic runs over
// socket.io; these routes handle the pre-socket flow (list public rooms,
// create a room, look up whether a code is valid) plus board CRUD.

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createRoom, activeRooms, TOKEN_COLORS } = require('../game/state');
const { BUILTIN_BOARDS, validateBoard, computeGroupSizes } = require('../game/boards');
const CustomBoard = require('../models/CustomBoard');
const { restoreRoomByCode, saveRoomSnapshot } = require('../game/roomStore');
const validation = require('../validation/payloads');
const {
	positiveInt,
	rateLimitMiddleware,
	httpSessionKey,
	httpIpKey,
	httpSessionId,
	httpIpKey: requestIpKey,
	abuseLog,
} = require('../abuse/rateLimit');
const { schedulePendingRoomCleanup } = require('../abuse/pendingRooms');

const MINUTE = 60 * 1000;
const REST_LIMITS = {
	roomCreateSession: {
		limit: positiveInt(process.env.RATE_LIMIT_ROOM_CREATE_SESSION_PER_MIN, 5),
		windowMs: MINUTE,
	},
	roomCreateIp: {
		limit: positiveInt(process.env.RATE_LIMIT_ROOM_CREATE_IP_PER_10_MIN, 30),
		windowMs: 10 * MINUTE,
	},
	boardMutation: {
		limit: positiveInt(process.env.RATE_LIMIT_BOARD_MUTATE_PER_MIN, 30),
		windowMs: MINUTE,
	},
	lookup: {
		limit: positiveInt(process.env.RATE_LIMIT_LOOKUP_PER_MIN, 180),
		windowMs: MINUTE,
	},
	pendingRoomsPerSession: positiveInt(process.env.PENDING_ROOMS_PER_SESSION, 2),
	maxActiveRooms: positiveInt(process.env.MAX_ACTIVE_ROOMS, 200),
};

const roomCreateSessionLimit = rateLimitMiddleware('room-create-session', {
	...REST_LIMITS.roomCreateSession,
	key: httpSessionKey,
});
const roomCreateIpLimit = rateLimitMiddleware('room-create-ip', {
	...REST_LIMITS.roomCreateIp,
	key: httpIpKey,
});
const boardMutationLimit = rateLimitMiddleware('board-mutation', {
	...REST_LIMITS.boardMutation,
	key: httpSessionKey,
});
const lookupLimit = rateLimitMiddleware('lookup', {
	...REST_LIMITS.lookup,
	key: httpSessionKey,
});

function escapeRegExp(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeBoardId(name) {
	const slug =
		String(name || 'custom-map')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 32) || 'custom-map';
	return `${slug}-${uuidv4().slice(0, 8)}`;
}

function normalizeGroupColors(groupColors) {
	if (!groupColors) return undefined;
	if (groupColors instanceof Map) return Object.fromEntries(groupColors);
	return groupColors;
}

function validationError(res, req, result) {
	console.warn('[validation]', {
		route: `${req.method} ${req.originalUrl}`,
		code: result.error,
		details: result.details,
	});
	return res.status(400).json({
		error: 'validation',
		code: result.error,
		message: result.message,
		details: result.details,
	});
}

function hostHasConnected(room) {
	return !!room.players?.some((p) => p.userId === room.hostUserId && p.socketId);
}

function rateLimitError(res, req, code, message, details) {
	abuseLog({
		kind: 'http-rate-limit',
		sessionId: httpSessionId(req),
		socketId: null,
		event: `${req.method} ${req.originalUrl}`,
		roomCode: null,
		limitName: code,
		ip: requestIpKey(req),
		retryAfterMs: 0,
	});
	return res.status(429).json({
		error: 'rate-limited',
		code,
		message,
		details,
	});
}

function enforceRoomCreationCapacity(req, res, next) {
	if (activeRooms.size >= REST_LIMITS.maxActiveRooms) {
		return rateLimitError(res, req, 'active-room-capacity', 'Too many active rooms');
	}
	let pending = 0;
	for (const room of activeRooms.values()) {
		if (room.hostUserId !== req.userId) continue;
		if (room.started) continue;
		if (hostHasConnected(room)) continue;
		pending += 1;
	}
	if (pending >= REST_LIMITS.pendingRoomsPerSession) {
		return rateLimitError(
			res,
			req,
			'pending-room-limit',
			'Too many rooms are waiting for host connection',
			{
				pending,
				limit: REST_LIMITS.pendingRoomsPerSession,
			},
		);
	}
	return next();
}

function customBoardView(board) {
	const b = board?.toObject ? board.toObject() : board;
	if (!b) return null;
	return {
		...b,
		groupColors: normalizeGroupColors(b.groupColors),
		groupSizes: b.groupSizes || computeGroupSizes(b.tiles || []),
		builtin: false,
	};
}

function boardSummary(board, builtin = false) {
	return {
		id: board.id,
		name: board.name,
		description: board.description || '',
		authorUsername: board.authorUsername || '',
		isPublic: builtin ? true : !!board.isPublic,
		builtin,
		timesPlayed: board.timesPlayed || 0,
		updatedAt: board.updatedAt,
	};
}

async function findVisibleCustomBoard(id, userId) {
	const board = await CustomBoard.findOne({
		id,
		$or: [{ authorUserId: userId }, { isPublic: true }],
	}).lean();
	return customBoardView(board);
}

async function findOwnedCustomBoard(id, userId) {
	return CustomBoard.findOne({ id, authorUserId: userId });
}

// List all built-in + user's own boards + public community boards.
router.get('/boards', lookupLimit, async (req, res) => {
	const builtin = Object.values(BUILTIN_BOARDS).map((b) => boardSummary(b, true));
	let mine = [];
	let community = [];
	try {
		mine = await CustomBoard.find({ authorUserId: req.userId })
			.select('id name description isPublic authorUsername timesPlayed updatedAt')
			.sort({ updatedAt: -1 })
			.lean();
		community = await CustomBoard.find({ isPublic: true })
			.select('id name authorUsername timesPlayed')
			.where('authorUserId')
			.ne(req.userId)
			.sort({ timesPlayed: -1 })
			.limit(50)
			.lean();
	} catch {
		/* mongo optional in dev */
	}
	res.json({
		builtin,
		mine: mine.map((b) => boardSummary(b)),
		community: community.map((b) => boardSummary(b)),
	});
});

router.get('/boards/my', lookupLimit, async (req, res) => {
	const qResult = validation.validateQueryText(req.query.q);
	if (!qResult.ok) return validationError(res, req, qResult);
	const q = qResult.value;
	const query = { authorUserId: req.userId };
	if (q) query.name = { $regex: escapeRegExp(q), $options: 'i' };
	try {
		const boards = await CustomBoard.find(query)
			.select('id name description isPublic authorUsername timesPlayed createdAt updatedAt')
			.sort({ updatedAt: -1 })
			.lean();
		res.json({ boards: boards.map((b) => boardSummary(b)) });
	} catch {
		res.status(500).json({ error: 'server' });
	}
});

router.get('/boards/:id', lookupLimit, async (req, res) => {
	const id = validation.boardId(req.params.id, 'id');
	if (!id.ok) return validationError(res, req, id);
	const b = BUILTIN_BOARDS[id.value];
	if (b) return res.json({ ...b, builtin: true });
	try {
		const cb = await findVisibleCustomBoard(id.value, req.userId);
		if (!cb) return res.status(404).json({ error: 'not-found' });
		res.json(cb);
	} catch {
		res.status(500).json({ error: 'server' });
	}
});

router.post('/boards', boardMutationLimit, async (req, res) => {
	const body = validation.validateCreateBoardBody(req.body);
	if (!body.ok) return validationError(res, req, body);
	const { name, tiles, groupColors, description, isPublic, authorUsername } = body.value;
	const id = body.value.id || makeBoardId(name);
	if (BUILTIN_BOARDS[id]) return res.status(409).json({ error: 'built-in-board-readonly' });
	const errs = validateBoard({ tiles });
	if (errs.length) return res.status(400).json({ error: 'invalid-board', details: errs });
	try {
		const existing = await CustomBoard.findOne({ id }).select('authorUserId');
		if (existing && existing.authorUserId !== req.userId) {
			return res.status(403).json({ error: 'not-owner' });
		}
		const doc = await CustomBoard.findOneAndUpdate(
			{ id },
			{
				$set: {
					id,
					name,
					tiles,
					groupColors,
					description,
					isPublic: isPublic !== false,
					authorUserId: req.userId,
					authorUsername,
					updatedAt: new Date(),
				},
				$setOnInsert: {
					createdAt: new Date(),
				},
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true },
		);
		res.json(customBoardView(doc));
	} catch {
		res.status(500).json({ error: 'server' });
	}
});

router.patch('/boards/:id', boardMutationLimit, async (req, res) => {
	const id = validation.boardId(req.params.id, 'id');
	if (!id.ok) return validationError(res, req, id);
	const body = validation.validatePatchBoardBody(req.body);
	if (!body.ok) return validationError(res, req, body);
	if (BUILTIN_BOARDS[id.value]) return res.status(409).json({ error: 'built-in-board-readonly' });
	try {
		const doc = await findOwnedCustomBoard(id.value, req.userId);
		if (!doc) return res.status(404).json({ error: 'not-found' });

		const patch = { ...body.value, updatedAt: new Date() };
		if ('tiles' in body.value) {
			const errs = validateBoard({ tiles: body.value.tiles });
			if (errs.length) return res.status(400).json({ error: 'invalid-board', details: errs });
		}

		Object.assign(doc, patch);
		await doc.save();
		res.json(customBoardView(doc));
	} catch {
		res.status(500).json({ error: 'server' });
	}
});

router.delete('/boards/:id', boardMutationLimit, async (req, res) => {
	const id = validation.boardId(req.params.id, 'id');
	if (!id.ok) return validationError(res, req, id);
	if (BUILTIN_BOARDS[id.value]) return res.status(409).json({ error: 'built-in-board-readonly' });
	try {
		const result = await CustomBoard.deleteOne({ id: id.value, authorUserId: req.userId });
		if (!result.deletedCount) return res.status(404).json({ error: 'not-found' });
		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: 'server' });
	}
});

router.post('/boards/:id/duplicate', boardMutationLimit, async (req, res) => {
	const id = validation.boardId(req.params.id, 'id');
	if (!id.ok) return validationError(res, req, id);
	const body = validation.validateDuplicateBoardBody(req.body);
	if (!body.ok) return validationError(res, req, body);
	try {
		const builtin = BUILTIN_BOARDS[id.value];
		const source = builtin
			? { ...builtin, isPublic: true }
			: await findVisibleCustomBoard(id.value, req.userId);
		if (!source) return res.status(404).json({ error: 'not-found' });
		const name = (body.value.name || `${source.name} Copy`).slice(0, 80);
		const doc = await CustomBoard.create({
			id: makeBoardId(name),
			name,
			description:
				'description' in body.value ? body.value.description : source.description || '',
			isPublic: body.value.isPublic === true,
			authorUserId: req.userId,
			tiles: JSON.parse(JSON.stringify(source.tiles || [])),
			groupColors: normalizeGroupColors(source.groupColors),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		res.json(customBoardView(doc));
	} catch {
		res.status(500).json({ error: 'server' });
	}
});

// Create a new room. Body: { username, color, boardId }. Host becomes
// player 0; others join via socket.
router.post(
	'/rooms',
	roomCreateSessionLimit,
	roomCreateIpLimit,
	enforceRoomCreationCapacity,
	async (req, res) => {
		const body = validation.validateCreateRoomBody(req.body, TOKEN_COLORS);
		if (!body.ok) return validationError(res, req, body);
		const { username, color, boardId, customBoardId } = body.value;

		const selectedBoardId = customBoardId || boardId;
		let customBoard = null;
		if (customBoardId || !BUILTIN_BOARDS[selectedBoardId]) {
			try {
				customBoard = await findVisibleCustomBoard(selectedBoardId, req.userId);
				if (!customBoard) return res.status(404).json({ error: 'board-not-found' });
			} catch {
				return res.status(500).json({ error: 'server' });
			}
		}

		const room = createRoom({
			hostUserId: req.userId,
			hostUsername: username,
			hostColor: color,
			boardId: selectedBoardId,
			customBoard,
		});
		schedulePendingRoomCleanup(room);
		saveRoomSnapshot(room);
		if (customBoard) {
			CustomBoard.updateOne({ id: customBoard.id }, { $inc: { timesPlayed: 1 } }).catch(
				() => {},
			);
		}
		res.json({ roomCode: room.roomCode });
	},
);

router.get('/rooms/:code', lookupLimit, async (req, res) => {
	const code = validation.roomCode(req.params.code);
	if (!code.ok) return validationError(res, req, code);
	let r = activeRooms.get(code.value);
	if (!r && activeRooms.size < REST_LIMITS.maxActiveRooms) {
		r = await restoreRoomByCode(code.value);
	}
	if (!r) return res.status(404).json({ error: 'not-found' });
	// Lightweight preview — don't leak the whole state.
	res.json({
		roomCode: r.roomCode,
		boardName: r.board.name,
		players: r.players.map((p) => ({ username: p.username, color: p.color })),
		started: r.started,
		full: r.players.length >= 8,
	});
});

router.get('/rooms', lookupLimit, (req, res) => {
	// Public list: rooms that haven't started and have headroom. Handy for a
	// "quick join" browser view — skip rooms with zero activity in 5 minutes.
	const now = Date.now();
	const list = [];
	for (const r of activeRooms.values()) {
		if (r.started) continue;
		if (r.players.length >= 8) continue;
		if (now - r.lastActivity > 5 * 60 * 1000) continue;
		list.push({
			roomCode: r.roomCode,
			boardName: r.board.name,
			players: r.players.length,
			host: r.players.find((p) => p.isHost)?.username || '',
		});
	}
	res.json(list);
});

router.get('/tokens', (_req, res) => res.json(TOKEN_COLORS));

module.exports = router;
