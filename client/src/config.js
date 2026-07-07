const DEFAULT_BACKEND_URL = 'http://localhost:5004';

function normalizeBaseUrl(url) {
	return String(url || '')
		.trim()
		.replace(/\/+$/, '');
}

function resolveBackendUrl(value, name) {
	const normalized = normalizeBaseUrl(value);
	if (normalized) return normalized;
	if (import.meta.env.DEV) return DEFAULT_BACKEND_URL;
	throw new Error(`${name} must be set for production builds.`);
}

export const API_BASE = resolveBackendUrl(import.meta.env.VITE_API_URL, 'VITE_API_URL');
export const SOCKET_URL = resolveBackendUrl(
	import.meta.env.VITE_SOCKET_URL || API_BASE,
	'VITE_SOCKET_URL or VITE_API_URL',
);
