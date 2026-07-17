// Dev helper tools — only for local development. These bypass normal
// turn-phase checks so you can test specific scenarios quickly.
//
// The socket layer (handlers.js) wires these up unconditionally; the
// client gates the DevPanel behind import.meta.env.DEV so no dev commands
// ever reach a production server from the bundled client.

const engine = require('./engine');
const { appendLog } = require('./state');

// ─── Individual dev actions ──────────────────────────────────────────────────

function setCash(room, _caller, targetPlayer, amount) {
	if (amount < 0) return { ok: false, error: 'negative-cash' };
	const old = targetPlayer.cash;
	targetPlayer.cash = amount;
	appendLog(room, { kind: 'dev-set-cash', userId: targetPlayer.userId, old, new: amount });
	return {
		ok: true,
		events: [{ type: 'dev-set-cash', userId: targetPlayer.userId, old, new: amount }],
	};
}

function setPosition(room, _caller, targetPlayer, pos, { resolveLand = false } = {}) {
	if (pos < 0 || pos > 39) return { ok: false, error: 'bad-position' };
	const old = targetPlayer.position;
	targetPlayer.position = pos;
	// Clear jail state if moving out.
	if (pos !== 10) {
		targetPlayer.inJail = false;
		targetPlayer.jailTurns = 0;
	}
	appendLog(room, { kind: 'dev-set-position', userId: targetPlayer.userId, old, new: pos });
	const events = [
		{
			type: 'move',
			userId: targetPlayer.userId,
			from: old,
			to: pos,
			path: [pos],
			animate: false,
		},
		{ type: 'dev-set-position', userId: targetPlayer.userId, old, new: pos },
	];

	// Optionally re-resolve the landing so the player can buy, pay rent, etc.
	if (resolveLand) {
		// Force the turn to this player so resolveLanding sets turnPhase correctly.
		const turnIdx = room.players.findIndex((p) => p.userId === targetPlayer.userId);
		if (turnIdx !== -1) room.turnIndex = turnIdx;
		const prevPhase = room.turnPhase;
		room.turnPhase = 'moving';
		const landingEvents = engine.resolveLanding(room, targetPlayer, [1, 1]);
		events.push(...landingEvents);
		// If resolveLanding didn't set a decision phase (buy/debt), end the turn.
		if (room.turnPhase === 'moving') {
			room.turnPhase = 'awaiting-end-turn';
		}
	}

	return { ok: true, events };
}

function buyProperty(room, _caller, targetPlayer, pos) {
	const def = engine.tileDef(room, pos);
	if (!def) return { ok: false, error: 'bad-position' };
	const st = engine.tileSt(room, pos);
	if (st.owner) return { ok: false, error: 'already-owned' };
	if (!['property', 'station', 'utility'].includes(def.type))
		return { ok: false, error: 'not-buyable-tile' };
	if (targetPlayer.cash < def.price) return { ok: false, error: 'insufficient' };

	targetPlayer.cash -= def.price;
	targetPlayer.stats.moneySpent += def.price;
	targetPlayer.stats.propertiesBought += 1;
	targetPlayer.owned.push(def.pos);
	st.owner = targetPlayer.userId;
	appendLog(room, {
		kind: 'dev-buy',
		userId: targetPlayer.userId,
		pos: def.pos,
		price: def.price,
	});
	return {
		ok: true,
		events: [{ type: 'buy', userId: targetPlayer.userId, pos: def.pos, price: def.price }],
	};
}

function giveProperty(room, _caller, targetPlayer, pos) {
	const def = engine.tileDef(room, pos);
	if (!def) return { ok: false, error: 'bad-position' };
	const st = engine.tileSt(room, pos);
	if (!['property', 'station', 'utility'].includes(def.type))
		return { ok: false, error: 'not-property' };

	// If already owned by someone else, clear their ownership.
	if (st.owner && st.owner !== targetPlayer.userId) {
		const prevOwner = room.players.find((p) => p.userId === st.owner);
		if (prevOwner) {
			prevOwner.owned = prevOwner.owned.filter((o) => o !== pos);
		}
	}
	st.owner = targetPlayer.userId;
	st.houses = 0;
	st.mortgaged = false;
	if (!targetPlayer.owned.includes(pos)) targetPlayer.owned.push(pos);
	appendLog(room, { kind: 'dev-give', userId: targetPlayer.userId, pos, tile: def.name });
	return {
		ok: true,
		events: [{ type: 'dev-give', userId: targetPlayer.userId, pos, tile: def.name }],
	};
}

function forceRoll(room, _caller, d1, d2) {
	// Store the forced dice values on the room. rollDice() in engine.js
	// checks `_devDice` and consumes it on the next call.
	room._devDice = [d1, d2];
	return { ok: true, events: [] };
}

// ─── Dispatch ────────────────────────────────────────────────────────────────
// Called by handlers.js when a 'dev-command' socket event arrives.

function handleDevCommand(io, socket, { cmd, userId, pos, amount, d1, d2, resolve }) {
	const room = require('./state').getRoom(socket.data.roomCode);
	if (!room) return;
	const target = room.players.find((p) => p.userId === userId);
	if (!target) return socket.emit('error-msg', 'dev-target-not-found');
	const caller = room.players.find((p) => p.userId === socket.data.userId);
	if (!caller) return socket.emit('error-msg', 'dev-caller-not-found');

	let r;
	switch (cmd) {
		case 'set-cash':
			r = setCash(room, caller, target, amount);
			break;
		case 'set-position':
			r = setPosition(room, caller, target, pos, { resolveLand: resolve });
			break;
		case 'buy-property':
			r = buyProperty(room, caller, target, pos);
			break;
		case 'give-property':
			r = giveProperty(room, caller, target, pos);
			break;
		case 'force-roll':
			r = forceRoll(room, caller, d1, d2);
			break;
		default:
			return socket.emit('error-msg', 'unknown-dev-command');
	}
	if (!r.ok) return socket.emit('error-msg', r.error);

	// Broadcast updated state — same pattern as all other handlers.
	const { bumpVersion, publicView } = require('./state');
	bumpVersion(room);
	io.to(room.roomCode).emit('state', { room: publicView(room), events: r.events });
}

module.exports = {
	setCash,
	setPosition,
	buyProperty,
	giveProperty,
	forceRoll,
	handleDevCommand,
};
