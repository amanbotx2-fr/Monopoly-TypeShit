// Thin fetch wrapper for the monopoly REST routes. Socket traffic is handled
// separately in socket.js. Deployed clients use REACT_APP_API_URL; local dev
// falls back to the Node backend on localhost:5004.

import { API_BASE } from './config';

async function req(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts,
    });
    if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
    }
    return res.json();
}

export const api = {
    me:           ()                                 => req('/api/me'),
    tokens:       ()                                 => req('/api/tokens'),
    listBoards:   ()                                 => req('/api/boards'),
    myBoards:     (q = '')                           => req('/api/boards/my' + (q ? `?q=${encodeURIComponent(q)}` : '')),
    getBoard:     (id)                               => req('/api/boards/' + encodeURIComponent(id)),
    saveBoard:    (board)                            => req('/api/boards', { method: 'POST', body: JSON.stringify(board) }),
    updateBoard:  (id, patch)                        => req('/api/boards/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }),
    deleteBoard:  (id)                               => req('/api/boards/' + encodeURIComponent(id), { method: 'DELETE' }),
    duplicateBoard:(id, body = {})                    => req('/api/boards/' + encodeURIComponent(id) + '/duplicate', { method: 'POST', body: JSON.stringify(body) }),
    createRoom:   (body)                             => req('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
    getRoom:      (code)                             => req('/api/rooms/' + encodeURIComponent(code)),
    listRooms:    ()                                 => req('/api/rooms'),
};

export const API_URL = API_BASE;
