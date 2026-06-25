const DEFAULT_BACKEND_URL = 'http://localhost:5004';

function normalizeBaseUrl(url) {
    return String(url || '').replace(/\/+$/, '');
}

export const API_BASE = normalizeBaseUrl(process.env.REACT_APP_API_URL || DEFAULT_BACKEND_URL);
export const SOCKET_URL = API_BASE;
