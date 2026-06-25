// HTTP endpoints for room management. The live game traffic runs over
// socket.io; these routes handle the pre-socket flow (list public rooms,
// create a room, look up whether a code is valid) plus board CRUD.

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { createRoom, activeRooms, publicView, TOKEN_COLORS } = require('../game/state');
const { BUILTIN_BOARDS, validateBoard, computeGroupSizes } = require('../game/boards');
const CustomBoard = require('../models/CustomBoard');

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeBoardId(name) {
    const slug = String(name || 'custom-map')
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
router.get('/boards', async (req, res) => {
    const builtin = Object.values(BUILTIN_BOARDS).map(b => boardSummary(b, true));
    let mine = [];
    let community = [];
    try {
        mine = await CustomBoard.find({ authorUserId: req.userId })
            .select('id name description isPublic authorUsername timesPlayed updatedAt')
            .sort({ updatedAt: -1 })
            .lean();
        community = await CustomBoard.find({ isPublic: true })
            .select('id name authorUsername timesPlayed')
            .where('authorUserId').ne(req.userId)
            .sort({ timesPlayed: -1 })
            .limit(50)
            .lean();
    } catch { /* mongo optional in dev */ }
    res.json({
        builtin,
        mine: mine.map(b => boardSummary(b)),
        community: community.map(b => boardSummary(b)),
    });
});

router.get('/boards/my', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const query = { authorUserId: req.userId };
    if (q) query.name = { $regex: escapeRegExp(q), $options: 'i' };
    try {
        const boards = await CustomBoard.find(query)
            .select('id name description isPublic authorUsername timesPlayed createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .lean();
        res.json({ boards: boards.map(b => boardSummary(b)) });
    } catch (e) {
        res.status(500).json({ error: 'server' });
    }
});

router.get('/boards/:id', async (req, res) => {
    const b = BUILTIN_BOARDS[req.params.id];
    if (b) return res.json({ ...b, builtin: true });
    try {
        const cb = await findVisibleCustomBoard(req.params.id, req.userId);
        if (!cb) return res.status(404).json({ error: 'not-found' });
        res.json(cb);
    } catch (e) {
        res.status(500).json({ error: 'server' });
    }
});

router.post('/boards', async (req, res) => {
    const { name, tiles, groupColors, description, isPublic } = req.body || {};
    const id = req.body?.id || makeBoardId(name);
    if (!name) return res.status(400).json({ error: 'missing-fields' });
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
            { $set: {
                id,
                name: String(name).slice(0, 80),
                tiles,
                groupColors,
                description: String(description || '').slice(0, 500),
                isPublic: isPublic !== false,
                authorUserId: req.userId,
                authorUsername: req.body?.authorUsername ? String(req.body.authorUsername).slice(0, 40) : undefined,
                updatedAt: new Date(),
            }, $setOnInsert: {
                createdAt: new Date(),
            },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json(customBoardView(doc));
    } catch (e) {
        res.status(500).json({ error: 'server' });
    }
});

router.patch('/boards/:id', async (req, res) => {
    if (BUILTIN_BOARDS[req.params.id]) return res.status(409).json({ error: 'built-in-board-readonly' });
    try {
        const doc = await findOwnedCustomBoard(req.params.id, req.userId);
        if (!doc) return res.status(404).json({ error: 'not-found' });

        const patch = { updatedAt: new Date() };
        if ('name' in req.body) {
            const name = String(req.body.name || '').trim();
            if (!name) return res.status(400).json({ error: 'missing-fields' });
            patch.name = name.slice(0, 80);
        }
        if ('description' in req.body) patch.description = String(req.body.description || '').slice(0, 500);
        if ('isPublic' in req.body) patch.isPublic = !!req.body.isPublic;
        if ('groupColors' in req.body) patch.groupColors = req.body.groupColors;
        if ('tiles' in req.body) {
            const errs = validateBoard({ tiles: req.body.tiles });
            if (errs.length) return res.status(400).json({ error: 'invalid-board', details: errs });
            patch.tiles = req.body.tiles;
        }

        Object.assign(doc, patch);
        await doc.save();
        res.json(customBoardView(doc));
    } catch (e) {
        res.status(500).json({ error: 'server' });
    }
});

router.delete('/boards/:id', async (req, res) => {
    if (BUILTIN_BOARDS[req.params.id]) return res.status(409).json({ error: 'built-in-board-readonly' });
    try {
        const result = await CustomBoard.deleteOne({ id: req.params.id, authorUserId: req.userId });
        if (!result.deletedCount) return res.status(404).json({ error: 'not-found' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'server' });
    }
});

router.post('/boards/:id/duplicate', async (req, res) => {
    try {
        const builtin = BUILTIN_BOARDS[req.params.id];
        const source = builtin ? { ...builtin, isPublic: true } : await findVisibleCustomBoard(req.params.id, req.userId);
        if (!source) return res.status(404).json({ error: 'not-found' });
        const name = String(req.body?.name || `${source.name} Copy`).slice(0, 80);
        const doc = await CustomBoard.create({
            id: makeBoardId(name),
            name,
            description: String(req.body?.description ?? source.description ?? '').slice(0, 500),
            isPublic: req.body?.isPublic === true,
            authorUserId: req.userId,
            tiles: JSON.parse(JSON.stringify(source.tiles || [])),
            groupColors: normalizeGroupColors(source.groupColors),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        res.json(customBoardView(doc));
    } catch (e) {
        res.status(500).json({ error: 'server' });
    }
});

// Create a new room. Body: { username, color, boardId }. Host becomes
// player 0; others join via socket.
router.post('/rooms', async (req, res) => {
    const { username, color, boardId = 'world-tour', customBoardId } = req.body || {};
    if (!username || !color) return res.status(400).json({ error: 'missing-fields' });
    if (!/^[\w .\-]{1,24}$/.test(username)) return res.status(400).json({ error: 'bad-username' });
    if (!TOKEN_COLORS.some(c => c.hex === color || c.id === color)) return res.status(400).json({ error: 'bad-color' });

    const selectedBoardId = customBoardId || boardId || 'world-tour';
    let customBoard = null;
    if (customBoardId || !BUILTIN_BOARDS[selectedBoardId]) {
        try {
            customBoard = await findVisibleCustomBoard(selectedBoardId, req.userId);
            if (!customBoard) return res.status(404).json({ error: 'board-not-found' });
        } catch {
            return res.status(500).json({ error: 'server' });
        }
    }

    const hex = TOKEN_COLORS.find(c => c.hex === color || c.id === color).hex;
    const room = createRoom({
        hostUserId: req.userId,
        hostUsername: username.trim(),
        hostColor: hex,
        boardId: selectedBoardId,
        customBoard,
    });
    if (customBoard) {
        CustomBoard.updateOne({ id: customBoard.id }, { $inc: { timesPlayed: 1 } }).catch(() => {});
    }
    res.json({ roomCode: room.roomCode });
});

router.get('/rooms/:code', (req, res) => {
    const r = activeRooms.get(req.params.code.toUpperCase());
    if (!r) return res.status(404).json({ error: 'not-found' });
    // Lightweight preview — don't leak the whole state.
    res.json({
        roomCode: r.roomCode,
        boardName: r.board.name,
        players: r.players.map(p => ({ username: p.username, color: p.color })),
        started: r.started,
        full: r.players.length >= 8,
    });
});

router.get('/rooms', (req, res) => {
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
            host: r.players.find(p => p.isHost)?.username || '',
        });
    }
    res.json(list);
});

router.get('/tokens', (_req, res) => res.json(TOKEN_COLORS));

module.exports = router;
