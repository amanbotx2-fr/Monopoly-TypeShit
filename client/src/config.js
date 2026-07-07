const DEFAULT_BACKEND_URL = 'http://localhost:5004';

function normalizeBaseUrl(url) {
	return String(url || '').replace(/\/+$/, '');
}

export const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_URL || DEFAULT_BACKEND_URL);
export const SOCKET_URL = API_BASE;
