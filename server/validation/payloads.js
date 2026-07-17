const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const BOARD_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const USERNAME_RE = /^[\w .-]{1,24}$/;
const TRADE_ID_RE = /^tr_[0-9a-f-]{8,36}$/i;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const MAX_NAME = 80;
const MAX_DESCRIPTION = 500;
const MAX_CHAT = 500;
const MAX_TRADE_MSG = 300;
const MAX_MONEY = 100000;
const MAX_RULE_MONEY = 10000;

function ok(value) {
	return { ok: true, value };
}

function fail(code, message, details) {
	return { ok: false, error: code, message, details };
}

function isPlainObject(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, label = 'payload') {
	if (!isPlainObject(value)) return fail('bad-payload', `${label} must be an object`);
	return ok(value);
}

function optionalObject(value, label = 'payload') {
	if (value === undefined) return ok({});
	return requireObject(value, label);
}

function rejectUnknownKeys(value, allowed, label = 'payload') {
	const allowedSet = new Set(allowed);
	const extra = Object.keys(value).filter((k) => !allowedSet.has(k));
	if (extra.length) return fail('unknown-field', `${label} contains unknown fields`, extra);
	return ok(value);
}

function stringField(value, label, { min = 1, max = 255, pattern = null, optional = false } = {}) {
	if (value === undefined && optional) return ok(undefined);
	if (typeof value !== 'string') return fail('bad-string', `${label} must be a string`);
	const trimmed = value.trim();
	if (trimmed.length < min || trimmed.length > max) {
		return fail('bad-string-length', `${label} must be ${min}-${max} characters`);
	}
	if (pattern && !pattern.test(trimmed))
		return fail('bad-string-format', `${label} has invalid format`);
	return ok(trimmed);
}

function booleanField(value, label, { optional = false } = {}) {
	if (value === undefined && optional) return ok(undefined);
	if (typeof value !== 'boolean') return fail('bad-boolean', `${label} must be a boolean`);
	return ok(value);
}

function finiteNumber(
	value,
	label,
	{ min = 0, max = Number.MAX_SAFE_INTEGER, integer = true, optional = false } = {},
) {
	if (value === undefined && optional) return ok(undefined);
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fail('bad-number', `${label} must be a finite number`);
	}
	if (integer && !Number.isInteger(value))
		return fail('bad-integer', `${label} must be an integer`);
	if (value < min || value > max) return fail('number-out-of-range', `${label} is out of range`);
	return ok(value);
}

function roomCode(value) {
	const r = stringField(value, 'roomCode', { min: 6, max: 6 });
	if (!r.ok) return r;
	const code = r.value.toUpperCase();
	if (!ROOM_CODE_RE.test(code)) return fail('bad-room-code', 'roomCode has invalid format');
	return ok(code);
}

function boardId(value, label = 'boardId', { optional = false } = {}) {
	const r = stringField(value, label, { min: 1, max: 64, optional });
	if (!r.ok || r.value === undefined) return r;
	if (!BOARD_ID_RE.test(r.value)) return fail('bad-board-id', `${label} has invalid format`);
	return ok(r.value);
}

function username(value, label = 'username', { optional = false } = {}) {
	return stringField(value, label, { min: 1, max: 24, pattern: USERNAME_RE, optional });
}

function tokenColor(value, tokenColors, label = 'color', { optional = false } = {}) {
	const r = stringField(value, label, { min: 1, max: 32, optional });
	if (!r.ok || r.value === undefined) return r;
	const match = tokenColors.find((c) => c.hex === r.value || c.id === r.value);
	if (!match) return fail('bad-color', `${label} is not an allowed token color`);
	return ok(match.hex);
}

function userId(value, label = 'userId', { optional = false } = {}) {
	return stringField(value, label, { min: 1, max: 80, optional });
}

function propertyPos(value, label = 'pos') {
	return finiteNumber(value, label, { min: 0, max: 39, integer: true });
}

function tradeId(value) {
	const r = stringField(value, 'tradeId', { min: 4, max: 64 });
	if (!r.ok) return r;
	if (!TRADE_ID_RE.test(r.value)) return fail('bad-trade-id', 'tradeId has invalid format');
	return ok(r.value);
}

function noPayload(args, event) {
	if (args.length === 0 || (args.length === 1 && args[0] === undefined)) return ok(undefined);
	if (args.length === 1 && typeof args[0] === 'function') return ok(undefined);
	if (args.length === 2 && args[0] === undefined && typeof args[1] === 'function')
		return ok(undefined);
	if (args.length !== 0) return fail('unexpected-payload', `${event} does not accept a payload`);
	return ok(undefined);
}

function oneObjectPayload(args, event) {
	if (args.length !== 1) return fail('bad-payload', `${event} requires one object payload`);
	return requireObject(args[0], event);
}

function validateSocketAuth(payload, tokenColors) {
	const root = requireObject(payload, 'socket auth');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(
		root.value,
		['roomCode', 'username', 'color', 'asSpectator'],
		'socket auth',
	);
	if (!fields.ok) return fields;

	const code = roomCode(root.value.roomCode);
	if (!code.ok) return code;
	const name = username(root.value.username, 'username', { optional: true });
	if (!name.ok) return name;
	const color = tokenColor(root.value.color, tokenColors, 'color', { optional: true });
	if (!color.ok) return color;
	const asSpectator = booleanField(root.value.asSpectator, 'asSpectator', { optional: true });
	if (!asSpectator.ok) return asSpectator;
	return ok({
		roomCode: code.value,
		username: name.value,
		color: color.value,
		asSpectator: !!asSpectator.value,
	});
}

function validateChatPayload(payload) {
	const root = requireObject(payload, 'chat');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['text'], 'chat');
	if (!fields.ok) return fields;
	const text = stringField(root.value.text, 'text', { min: 1, max: MAX_CHAT });
	if (!text.ok) return text;
	return ok({ text: text.value });
}

function validateUsernamePayload(payload) {
	const root = requireObject(payload, 'set-username');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['username'], 'set-username');
	if (!fields.ok) return fields;
	const name = username(root.value.username);
	if (!name.ok) return name;
	return ok({ username: name.value });
}

function validateColorPayload(payload, tokenColors) {
	const root = requireObject(payload, 'set-color');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['color'], 'set-color');
	if (!fields.ok) return fields;
	const color = tokenColor(root.value.color, tokenColors);
	if (!color.ok) return color;
	return ok({ color: color.value });
}

const RULE_SCHEMA = {
	startingCash: { kind: 'int', min: 1, max: MAX_RULE_MONEY },
	salary: { kind: 'int', min: 0, max: MAX_RULE_MONEY },
	doubleOnGo: { kind: 'bool' },
	freeParkingPot: { kind: 'bool' },
	auctionUnbought: { kind: 'bool' },
	noRentInJail: { kind: 'bool' },
	evenBuild: { kind: 'bool' },
	mortgageRebuyRate: { kind: 'number', min: 1, max: 3 },
	jailFine: { kind: 'int', min: 0, max: MAX_RULE_MONEY },
	jailTurnsMax: { kind: 'int', min: 1, max: 10 },
	xDoubles: { kind: 'int', min: 2, max: 10 },
	turnClockSeconds: { kind: 'int', min: 0, max: 3600 },
	allowDevOnMortgaged: { kind: 'bool' },
	randomTurnOrder: { kind: 'bool' },
};

function validateRulesPayload(payload) {
	const root = requireObject(payload, 'update-rules');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['rules'], 'update-rules');
	if (!fields.ok) return fields;
	const rulesObj = requireObject(root.value.rules, 'rules');
	if (!rulesObj.ok) return rulesObj;
	const rules = {};
	for (const key of Object.keys(rulesObj.value)) {
		const spec = RULE_SCHEMA[key];
		if (!spec) return fail('bad-rule', `rule ${key} is not allowed`);
		let r;
		if (spec.kind === 'bool') r = booleanField(rulesObj.value[key], key);
		else
			r = finiteNumber(rulesObj.value[key], key, {
				min: spec.min,
				max: spec.max,
				integer: spec.kind === 'int',
			});
		if (!r.ok) return r;
		rules[key] = r.value;
	}
	return ok({ rules });
}

function validateKickPayload(payload, room) {
	const root = requireObject(payload, 'kick');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['userId'], 'kick');
	if (!fields.ok) return fields;
	const id = userId(root.value.userId);
	if (!id.ok) return id;
	const player = room.players.find((p) => p.userId === id.value);
	if (!player) return fail('bad-player', 'userId is not a player in this room');
	if (player.isHost) return fail('bad-player', 'host cannot be kicked');
	return ok({ userId: id.value });
}

function validatePosPayload(payload, label = 'property action') {
	const root = requireObject(payload, label);
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['pos'], label);
	if (!fields.ok) return fields;
	const pos = propertyPos(root.value.pos);
	if (!pos.ok) return pos;
	return ok({ pos: pos.value });
}

function validateAuctionBidPayload(payload, player, room) {
	const root = requireObject(payload, 'auction-bid');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['amount'], 'auction-bid');
	if (!fields.ok) return fields;
	const amount = finiteNumber(root.value.amount, 'amount', {
		min: 1,
		max: Math.min(player.cash, MAX_MONEY),
		integer: true,
	});
	if (!amount.ok) return amount;
	if (!room.auction) return fail('no-auction', 'no auction is active');
	const min = room.auction.currentBid + room.auction.minIncrement;
	if (amount.value < min) return fail('below-min', 'bid is below the minimum increment', { min });
	return ok({ amount: amount.value });
}

function normalizeBundle(bundle, label) {
	const root = requireObject(bundle, label);
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['cash', 'properties', 'jailCards'], label);
	if (!fields.ok) return fields;

	const cash = finiteNumber('cash' in root.value ? root.value.cash : 0, `${label}.cash`, {
		min: 0,
		max: MAX_MONEY,
		integer: true,
	});
	if (!cash.ok) return cash;

	const rawProps = 'properties' in root.value ? root.value.properties : [];
	if (!Array.isArray(rawProps))
		return fail('bad-properties', `${label}.properties must be an array`);
	if (rawProps.length > 40) return fail('bad-properties', `${label}.properties is too large`);
	const seen = new Set();
	const properties = [];
	for (const raw of rawProps) {
		const pos = propertyPos(raw, `${label}.properties[]`);
		if (!pos.ok) return pos;
		if (seen.has(pos.value))
			return fail('duplicate-property', `${label}.properties contains duplicates`);
		seen.add(pos.value);
		properties.push(pos.value);
	}

	const rawCards = 'jailCards' in root.value ? root.value.jailCards : {};
	const cards = requireObject(rawCards, `${label}.jailCards`);
	if (!cards.ok) return cards;
	const cardFields = rejectUnknownKeys(cards.value, ['chance', 'chest'], `${label}.jailCards`);
	if (!cardFields.ok) return cardFields;
	const chance = finiteNumber(
		'chance' in cards.value ? cards.value.chance : 0,
		`${label}.jailCards.chance`,
		{ min: 0, max: 2, integer: true },
	);
	if (!chance.ok) return chance;
	const chest = finiteNumber(
		'chest' in cards.value ? cards.value.chest : 0,
		`${label}.jailCards.chest`,
		{ min: 0, max: 2, integer: true },
	);
	if (!chest.ok) return chest;

	return ok({
		cash: cash.value,
		properties,
		jailCards: { chance: chance.value, chest: chest.value },
	});
}

function validateBundleAssets(room, player, bundle, label) {
	if (!player || player.bankrupt)
		return fail('bad-player', `${label} owner is not an active player`);
	if (bundle.cash > player.cash) return fail('bad-cash', `${label}.cash exceeds available cash`);
	for (const pos of bundle.properties) {
		const tile = room.board.tiles[pos];
		const state = room.tileState[pos];
		if (!tile || !state || !['property', 'station', 'utility'].includes(tile.type)) {
			return fail('bad-property', `${label}.properties contains a non-ownable tile`);
		}
		if (state.owner !== player.userId)
			return fail(
				'bad-property-owner',
				`${label}.properties contains a property not owned by the player`,
			);
	}
	const ledger = room.jailFreeLedger[player.userId] || { chance: 0, chest: 0 };
	if (bundle.jailCards.chance > ledger.chance || bundle.jailCards.chest > ledger.chest) {
		return fail('bad-jail-card', `${label}.jailCards exceeds available cards`);
	}
	return ok(bundle);
}

function validateTradePayload(payload, room, actor, { requireRecipient = false } = {}) {
	const root = requireObject(payload, 'trade');
	if (!root.ok) return root;
	const allowed = requireRecipient
		? ['toUserId', 'offer', 'request']
		: ['tradeId', 'offer', 'request'];
	const fields = rejectUnknownKeys(root.value, allowed, 'trade');
	if (!fields.ok) return fields;

	const offer = normalizeBundle('offer' in root.value ? root.value.offer : {}, 'offer');
	if (!offer.ok) return offer;
	const request = normalizeBundle('request' in root.value ? root.value.request : {}, 'request');
	if (!request.ok) return request;

	const base = { offer: offer.value, request: request.value };
	if (requireRecipient) {
		const to = userId(root.value.toUserId, 'toUserId');
		if (!to.ok) return to;
		if (to.value === actor.userId) return fail('bad-recipient', 'cannot trade with yourself');
		const recipient = room.players.find((p) => p.userId === to.value && !p.bankrupt);
		if (!recipient) return fail('bad-recipient', 'recipient is not an active player');
		const offerAssets = validateBundleAssets(room, actor, offer.value, 'offer');
		if (!offerAssets.ok) return offerAssets;
		const requestAssets = validateBundleAssets(room, recipient, request.value, 'request');
		if (!requestAssets.ok) return requestAssets;
		return ok({ ...base, toUserId: to.value });
	}
	const id = tradeId(root.value.tradeId);
	if (!id.ok) return id;
	const existing = room.trades.find((t) => t.id === id.value);
	if (!existing || existing.status !== 'open') return fail('bad-trade-id', 'trade is not open');
	if (actor.userId !== existing.fromUserId && actor.userId !== existing.toUserId) {
		return fail('bad-trade-party', 'actor is not part of this trade');
	}
	const from = room.players.find((p) => p.userId === existing.fromUserId && !p.bankrupt);
	const to = room.players.find((p) => p.userId === existing.toUserId && !p.bankrupt);
	const offerAssets = validateBundleAssets(room, from, offer.value, 'offer');
	if (!offerAssets.ok) return offerAssets;
	const requestAssets = validateBundleAssets(room, to, request.value, 'request');
	if (!requestAssets.ok) return requestAssets;
	return ok({ ...base, tradeId: id.value });
}

function validateTradeIdPayload(payload, label = 'trade') {
	const root = requireObject(payload, label);
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['tradeId'], label);
	if (!fields.ok) return fields;
	const id = tradeId(root.value.tradeId);
	if (!id.ok) return id;
	return ok({ tradeId: id.value });
}

function validateTradeMsgPayload(payload) {
	const root = requireObject(payload, 'trade-msg');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['tradeId', 'text'], 'trade-msg');
	if (!fields.ok) return fields;
	const id = tradeId(root.value.tradeId);
	if (!id.ok) return id;
	const text = stringField(root.value.text, 'text', { min: 1, max: MAX_TRADE_MSG });
	if (!text.ok) return text;
	return ok({ tradeId: id.value, text: text.value });
}

function validateBankruptPayload(payload, room, player) {
	const root = optionalObject(payload, 'bankrupt');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(root.value, ['creditorUserId'], 'bankrupt');
	if (!fields.ok) return fields;
	// Player can declare bankruptcy at any time — not just during resolving.
	// Assets liquidate to the bank unless a creditor is specified.
	if (room.players[room.turnIndex]?.userId !== player.userId) {
		return fail('bad-bankruptcy-state', 'only the active player can declare bankruptcy');
	}

	const creditor = userId(root.value.creditorUserId, 'creditorUserId', { optional: true });
	if (!creditor.ok) return creditor;
	// If there's a pending debt, the creditor must match.
	const pending = room.pendingDebt;
	if (pending && pending.userId === player.userId && creditor.value != null) {
		const expected = pending.creditor === 'bank' ? null : pending.creditor;
		if (creditor.value !== expected) {
			return fail('bad-creditor', 'creditor does not match pending debt');
		}
	}
	return ok({ creditorUserId: creditor.value || null });
}

function availableBankruptcyResources(room, player) {
	let total = player.cash;
	for (const pos of player.owned) {
		const tile = room.board.tiles[pos];
		const state = room.tileState[pos];
		if (!tile || !state) continue;
		if (tile.type === 'property' && state.houses > 0) {
			total += Math.floor((tile.houseCost * state.houses) / 2);
		}
		if (!state.mortgaged && ['property', 'station', 'utility'].includes(tile.type)) {
			total += Number.isFinite(tile.mortgage)
				? tile.mortgage
				: Math.floor((tile.price || 0) / 2);
		}
	}
	return total;
}

function validateBoardTiles(tiles) {
	if (!Array.isArray(tiles)) return fail('bad-board', 'tiles must be an array');
	if (tiles.length !== 40) return fail('bad-board', 'board must contain exactly 40 tiles');
	const allowedTypes = new Set([
		'go',
		'property',
		'station',
		'utility',
		'tax',
		'chance',
		'chest',
		'jail',
		'gotojail',
		'parking',
	]);
	const sanitized = [];
	for (let i = 0; i < tiles.length; i++) {
		const tile = tiles[i];
		if (!isPlainObject(tile)) return fail('bad-board', `tile ${i} must be an object`);
		const fields = rejectUnknownKeys(
			tile,
			[
				'pos',
				'type',
				'name',
				'group',
				'color',
				'price',
				'rent',
				'houseCost',
				'mortgage',
				'amount',
				'icon',
			],
			`tile ${i}`,
		);
		if (!fields.ok) return fields;
		const pos = finiteNumber(tile.pos, `tile ${i}.pos`, { min: i, max: i, integer: true });
		if (!pos.ok) return pos;
		const type = stringField(tile.type, `tile ${i}.type`, { min: 1, max: 16 });
		if (!type.ok) return type;
		if (!allowedTypes.has(type.value)) return fail('bad-board', `tile ${i} has invalid type`);
		const name = stringField(tile.name, `tile ${i}.name`, { min: 1, max: 80 });
		if (!name.ok) return name;
		const out = { pos: i, type: type.value, name: name.value };

		if (type.value === 'property') {
			const group = stringField(tile.group, `tile ${i}.group`, {
				min: 1,
				max: 32,
				pattern: /^[A-Za-z0-9_-]+$/,
			});
			if (!group.ok) return group;
			if (!Array.isArray(tile.rent) || tile.rent.length !== 6)
				return fail('bad-board', `tile ${i}.rent must contain six values`);
			const rent = [];
			for (let j = 0; j < 6; j++) {
				const r = finiteNumber(tile.rent[j], `tile ${i}.rent[${j}]`, {
					min: 0,
					max: MAX_MONEY,
					integer: true,
				});
				if (!r.ok) return r;
				rent.push(r.value);
			}
			const price = finiteNumber(tile.price, `tile ${i}.price`, {
				min: 0,
				max: MAX_MONEY,
				integer: true,
			});
			if (!price.ok) return price;
			const houseCost = finiteNumber(tile.houseCost, `tile ${i}.houseCost`, {
				min: 0,
				max: MAX_MONEY,
				integer: true,
			});
			if (!houseCost.ok) return houseCost;
			const mortgage = finiteNumber(
				'mortgage' in tile ? tile.mortgage : Math.floor(price.value / 2),
				`tile ${i}.mortgage`,
				{ min: 0, max: MAX_MONEY, integer: true },
			);
			if (!mortgage.ok) return mortgage;
			out.group = group.value;
			out.price = price.value;
			out.rent = rent;
			out.houseCost = houseCost.value;
			out.mortgage = mortgage.value;
			if (tile.color !== undefined) {
				const color = stringField(tile.color, `tile ${i}.color`, { min: 1, max: 32 });
				if (!color.ok) return color;
				out.color = color.value;
			}
		}
		if (type.value === 'station' || type.value === 'utility') {
			const price = finiteNumber(tile.price, `tile ${i}.price`, {
				min: 0,
				max: MAX_MONEY,
				integer: true,
			});
			if (!price.ok) return price;
			const mortgage = finiteNumber(
				'mortgage' in tile ? tile.mortgage : Math.floor(price.value / 2),
				`tile ${i}.mortgage`,
				{ min: 0, max: MAX_MONEY, integer: true },
			);
			if (!mortgage.ok) return mortgage;
			out.price = price.value;
			out.mortgage = mortgage.value;
		}
		if (type.value === 'tax') {
			const amount = finiteNumber(tile.amount, `tile ${i}.amount`, {
				min: 0,
				max: MAX_MONEY,
				integer: true,
			});
			if (!amount.ok) return amount;
			out.amount = amount.value;
		}
		sanitized.push(out);
	}
	if (sanitized[0].type !== 'go') return fail('bad-board', 'tile 0 must be GO');
	if (sanitized[10].type !== 'jail') return fail('bad-board', 'tile 10 must be Jail');
	if (sanitized[30].type !== 'gotojail') return fail('bad-board', 'tile 30 must be Go To Jail');
	return ok(sanitized);
}

function validateGroupColors(value) {
	if (value === undefined) return ok(undefined);
	if (!isPlainObject(value)) return fail('bad-group-colors', 'groupColors must be an object');
	const entries = Object.entries(value);
	if (entries.length > 32) return fail('bad-group-colors', 'groupColors is too large');
	const out = {};
	for (const [key, val] of entries) {
		if (!/^[A-Za-z0-9_-]{1,32}$/.test(key))
			return fail('bad-group-colors', 'group color key has invalid format');
		if (typeof val !== 'string' || !HEX_COLOR_RE.test(val))
			return fail('bad-group-colors', 'group color value must be a hex color');
		out[key] = val;
	}
	return ok(out);
}

function validateCreateBoardBody(payload) {
	const root = requireObject(payload, 'board');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(
		root.value,
		['id', 'name', 'tiles', 'groupColors', 'description', 'isPublic', 'authorUsername'],
		'board',
	);
	if (!fields.ok) return fields;
	const id = boardId(root.value.id, 'id', { optional: true });
	if (!id.ok) return id;
	const name = stringField(root.value.name, 'name', { min: 1, max: MAX_NAME });
	if (!name.ok) return name;
	const tiles = validateBoardTiles(root.value.tiles);
	if (!tiles.ok) return tiles;
	const groupColors = validateGroupColors(root.value.groupColors);
	if (!groupColors.ok) return groupColors;
	const description = stringField(
		'description' in root.value ? root.value.description : '',
		'description',
		{ min: 0, max: MAX_DESCRIPTION },
	);
	if (!description.ok) return description;
	const isPublic = booleanField(root.value.isPublic, 'isPublic', { optional: true });
	if (!isPublic.ok) return isPublic;
	const authorUsername = username(root.value.authorUsername, 'authorUsername', {
		optional: true,
	});
	if (!authorUsername.ok) return authorUsername;
	return ok({
		id: id.value,
		name: name.value,
		tiles: tiles.value,
		groupColors: groupColors.value,
		description: description.value,
		isPublic: isPublic.value,
		authorUsername: authorUsername.value,
	});
}

function validatePatchBoardBody(payload) {
	const root = requireObject(payload, 'board patch');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(
		root.value,
		['name', 'tiles', 'groupColors', 'description', 'isPublic'],
		'board patch',
	);
	if (!fields.ok) return fields;
	const out = {};
	if ('name' in root.value) {
		const name = stringField(root.value.name, 'name', { min: 1, max: MAX_NAME });
		if (!name.ok) return name;
		out.name = name.value;
	}
	if ('description' in root.value) {
		const description = stringField(root.value.description, 'description', {
			min: 0,
			max: MAX_DESCRIPTION,
		});
		if (!description.ok) return description;
		out.description = description.value;
	}
	if ('isPublic' in root.value) {
		const isPublic = booleanField(root.value.isPublic, 'isPublic');
		if (!isPublic.ok) return isPublic;
		out.isPublic = isPublic.value;
	}
	if ('groupColors' in root.value) {
		const groupColors = validateGroupColors(root.value.groupColors);
		if (!groupColors.ok) return groupColors;
		out.groupColors = groupColors.value;
	}
	if ('tiles' in root.value) {
		const tiles = validateBoardTiles(root.value.tiles);
		if (!tiles.ok) return tiles;
		out.tiles = tiles.value;
	}
	return ok(out);
}

function validateDuplicateBoardBody(payload) {
	const root = optionalObject(payload, 'duplicate board');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(
		root.value,
		['name', 'description', 'isPublic'],
		'duplicate board',
	);
	if (!fields.ok) return fields;
	const out = {};
	if ('name' in root.value) {
		const name = stringField(root.value.name, 'name', { min: 1, max: MAX_NAME });
		if (!name.ok) return name;
		out.name = name.value;
	}
	if ('description' in root.value) {
		const description = stringField(root.value.description, 'description', {
			min: 0,
			max: MAX_DESCRIPTION,
		});
		if (!description.ok) return description;
		out.description = description.value;
	}
	if ('isPublic' in root.value) {
		const isPublic = booleanField(root.value.isPublic, 'isPublic');
		if (!isPublic.ok) return isPublic;
		out.isPublic = isPublic.value;
	}
	return ok(out);
}

function validateCreateRoomBody(payload, tokenColors) {
	const root = requireObject(payload, 'room');
	if (!root.ok) return root;
	const fields = rejectUnknownKeys(
		root.value,
		['username', 'color', 'boardId', 'customBoardId'],
		'room',
	);
	if (!fields.ok) return fields;
	const name = username(root.value.username);
	if (!name.ok) return name;
	const color = tokenColor(root.value.color, tokenColors);
	if (!color.ok) return color;
	const b = boardId('boardId' in root.value ? root.value.boardId : 'world-tour', 'boardId');
	if (!b.ok) return b;
	const custom = boardId(root.value.customBoardId, 'customBoardId', { optional: true });
	if (!custom.ok) return custom;
	return ok({
		username: name.value,
		color: color.value,
		boardId: b.value,
		customBoardId: custom.value,
	});
}

function validateQueryText(value, label = 'q') {
	if (value === undefined || value === '') return ok('');
	return stringField(value, label, { min: 1, max: 80 });
}

// Dev commands — only available in non-production.
const DEV_COMMANDS = new Set([
	'set-cash',
	'set-position',
	'buy-property',
	'give-property',
	'force-roll',
]);

function validateDevCommandPayload(payload) {
	const root = requireObject(payload, 'dev-command');
	if (!root.ok) return root;
	// Dev commands are intentionally permissive — we validate each field
	// we care about below rather than rejecting unknown keys, so adding
	// new dev features doesn't break the running server.

	const cmd = stringField(root.value.cmd, 'cmd', { min: 1, max: 32 });
	if (!cmd.ok) return cmd;
	if (!DEV_COMMANDS.has(cmd.value)) return fail('bad-cmd', `unknown dev command: ${cmd.value}`);

	const target = userId(root.value.userId, 'userId');
	if (!target.ok) return target;

	const result = { cmd: cmd.value, userId: target.value };

	switch (cmd.value) {
		case 'set-cash': {
			const amount = finiteNumber(root.value.amount, 'amount', {
				min: 0,
				max: MAX_MONEY,
				integer: true,
			});
			if (!amount.ok) return amount;
			result.amount = amount.value;
			break;
		}
		case 'set-position': {
			const pos = finiteNumber(root.value.pos, 'pos', { min: 0, max: 39, integer: true });
			if (!pos.ok) return pos;
			result.pos = pos.value;
			const resolve = booleanField(root.value.resolve, 'resolve', { optional: true });
			if (!resolve.ok) return resolve;
			result.resolve = resolve.value || false;
			break;
		}
		case 'buy-property':
		case 'give-property': {
			const pos = finiteNumber(root.value.pos, 'pos', { min: 0, max: 39, integer: true });
			if (!pos.ok) return pos;
			result.pos = pos.value;
			break;
		}
		case 'force-roll': {
			const d1 = finiteNumber(root.value.d1, 'd1', { min: 1, max: 6, integer: true });
			if (!d1.ok) return d1;
			const d2 = finiteNumber(root.value.d2, 'd2', { min: 1, max: 6, integer: true });
			if (!d2.ok) return d2;
			result.d1 = d1.value;
			result.d2 = d2.value;
			break;
		}
	}
	return ok(result);
}

module.exports = {
	fail,
	ok,
	isPlainObject,
	noPayload,
	oneObjectPayload,
	roomCode,
	boardId,
	username,
	userId,
	validateSocketAuth,
	validateChatPayload,
	validateUsernamePayload,
	validateColorPayload,
	validateRulesPayload,
	validateKickPayload,
	validatePosPayload,
	validateAuctionBidPayload,
	validateTradePayload,
	validateTradeIdPayload,
	validateTradeMsgPayload,
	validateBankruptPayload,
	validateDevCommandPayload,
	validateCreateBoardBody,
	validatePatchBoardBody,
	validateDuplicateBoardBody,
	validateCreateRoomBody,
	validateQueryText,
};
