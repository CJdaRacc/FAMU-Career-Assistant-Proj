// Small fetch helper that normalizes HTTP and network errors
// Usage: const data = await fetchJson('/api/login', { method: 'POST', headers: {...}, body: JSON.stringify(payload) })

export class HttpError extends Error {
  constructor(message, status, code, body) {
    super(message || 'Request failed');
    this.name = 'HttpError';
    this.status = status || 0;
    this.code = code;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(message, cause) {
    super(message || 'Network error');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export async function fetchJson(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new NetworkError('Network error', e);
  }

  // Try to parse JSON but tolerate empty bodies
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || `HTTP ${res.status}`;
    const code = data?.error?.code;
    throw new HttpError(message, res.status, code, data);
  }
  return data;
}
