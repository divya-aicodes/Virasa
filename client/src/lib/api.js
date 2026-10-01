const BASE = '/api';
const TOKEN_KEY = 'virasa_token';

// Kept as no-op compatibility shims for older callers. Browser sessions now
// live in an HttpOnly cookie and are intentionally unavailable to JavaScript.
export function getToken() {
  return null;
}

export function setToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function qs(params = {}) {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (clean.length === 0) return '';
  return '?' + new URLSearchParams(Object.fromEntries(clean)).toString();
}

function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', ...extra };
}

async function j(url, opts = {}) {
  const res = await fetch(BASE + url, {
    credentials: 'same-origin',
    headers: authHeaders(opts.headers),
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  auth: {
    register: (data) => j('/auth/register', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.user),
    login: (email, password) => j('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => j('/auth/logout', { method: 'POST' }),
    me: () => j('/auth/me').then((r) => r.user),
  },
  artisans: {
    list: () => j('/artisans'),
    search: (params) => j('/artisans' + qs(params)),
    get: (id) => j(`/artisans/${id}`),
    create: (data) => j('/artisans', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => j(`/artisans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => j(`/artisans/${id}`, { method: 'DELETE' }),
  },
  products: {
    list: () => j('/products'),
    search: (params) => j('/products' + qs(params)),
    get: (id) => j(`/products/${id}`),
    create: (data) => j('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => j(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => j(`/products/${id}`, { method: 'DELETE' }),
  },
  verify: {
    check: (id) => j(`/verify/${id}`),
    chain: () => j('/verify'),
  },
  upload: async (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const res = await fetch(BASE + '/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed (${res.status})`);
    }
    return res.json();
  },
};
