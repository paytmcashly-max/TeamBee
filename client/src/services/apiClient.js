let activeAuthToken = null;
let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = typeof fn === 'function' ? fn : null;
}

const SKIP_401_LOGOUT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register-tenant',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

/**
 * Normalizes VITE_API_URL, prepending https:// when Render blueprints provide
 * a protocol-less host value (e.g. `teambee-backend.onrender.com`).
 */
export function resolveApiBaseUrl() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('localhost') || raw.startsWith('127.0.0.1')) return `http://${raw}`;
  return `https://${raw}`;
}

export function buildApiUrl(path) {
  if (typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) return path;
  return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

export function setApiAuthToken(token) {
  activeAuthToken = token || null;
}

export function getApiAuthToken() {
  return activeAuthToken;
}

/**
 * Shared JSON/multipart API fetch helper with credentials and structured error messages.
 */
export async function apiFetch(path, options = {}) {
  const { headers = {}, body, ...rest } = options;
  const resolvedHeaders = { ...headers };

  if (activeAuthToken && !resolvedHeaders.Authorization) {
    resolvedHeaders.Authorization = `Bearer ${activeAuthToken}`;
  }
  if (body && !(body instanceof FormData) && typeof body === 'string' && !resolvedHeaders['Content-Type']) {
    resolvedHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    body,
    credentials: rest.credentials || 'include',
    headers: resolvedHeaders,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { success: false, error: response.ok ? 'Invalid server response' : `HTTP ${response.status}` };
  }

  if (!response.ok || data?.success === false) {
    if (
      response.status === 401 &&
      unauthorizedHandler &&
      !SKIP_401_LOGOUT_PREFIXES.some((prefix) => String(path).startsWith(prefix))
    ) {
      unauthorizedHandler();
    }
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }

  return data;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}
