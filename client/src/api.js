// Thin fetch wrapper for the monopoly REST routes. Socket traffic is handled
// separately in socket.js. Deployed clients must provide VITE_API_URL; local
// dev falls back to the Node backend on localhost:5004.

import { API_BASE } from './config';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_ERROR_CODES = new Set(['csrf-missing', 'csrf-invalid']);

let csrfToken = null;
let csrfBootstrap = null;

function isMutation(method) {
	return !['GET', 'HEAD', 'OPTIONS'].includes((method || 'GET').toUpperCase());
}

async function parseJson(res) {
	try {
		return await res.json();
	} catch {
		return null;
	}
}

function storeCsrfToken(body) {
	if (body?.csrfToken) csrfToken = body.csrfToken;
	return body;
}

async function fetchJson(path, opts = {}) {
	const { headers, ...rest } = opts;
	const res = await fetch(`${API_BASE}${path}`, {
		credentials: 'include',
		...rest,
		headers: { 'Content-Type': 'application/json', ...(headers || {}) },
	});
	const body = storeCsrfToken(await parseJson(res));
	if (!res.ok) {
		const err = new Error(body?.error || res.statusText);
		err.code = body?.code;
		throw err;
	}
	return body;
}

async function bootstrapCsrf() {
	if (csrfToken) return csrfToken;
	if (!csrfBootstrap) {
		csrfBootstrap = fetchJson('/api/me').finally(() => {
			csrfBootstrap = null;
		});
	}
	await csrfBootstrap;
	return csrfToken;
}

async function req(path, opts = {}) {
	const method = (opts.method || 'GET').toUpperCase();
	if (isMutation(method)) {
		await bootstrapCsrf();
	}
	try {
		return await fetchJson(path, {
			...opts,
			method,
			headers: isMutation(method)
				? { ...(opts.headers || {}), [CSRF_HEADER]: csrfToken }
				: opts.headers,
		});
	} catch (err) {
		if (isMutation(method) && CSRF_ERROR_CODES.has(err.code)) {
			csrfToken = null;
			await bootstrapCsrf();
			return fetchJson(path, {
				...opts,
				method,
				headers: { ...(opts.headers || {}), [CSRF_HEADER]: csrfToken },
			});
		}
		throw err;
	}
}

export const api = {
	me: () => req('/api/me'),
	tokens: () => req('/api/tokens'),
	listBoards: () => req('/api/boards'),
	myBoards: (q = '') => req('/api/boards/my' + (q ? `?q=${encodeURIComponent(q)}` : '')),
	getBoard: (id) => req('/api/boards/' + encodeURIComponent(id)),
	saveBoard: (board) => req('/api/boards', { method: 'POST', body: JSON.stringify(board) }),
	updateBoard: (id, patch) =>
		req('/api/boards/' + encodeURIComponent(id), {
			method: 'PATCH',
			body: JSON.stringify(patch),
		}),
	deleteBoard: (id) => req('/api/boards/' + encodeURIComponent(id), { method: 'DELETE' }),
	duplicateBoard: (id, body = {}) =>
		req('/api/boards/' + encodeURIComponent(id) + '/duplicate', {
			method: 'POST',
			body: JSON.stringify(body),
		}),
	createRoom: (body) => req('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
	getRoom: (code) => req('/api/rooms/' + encodeURIComponent(code)),
	listRooms: () => req('/api/rooms'),
};

export const API_URL = API_BASE;
