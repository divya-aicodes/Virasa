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
    mfaLogin: (challengeToken, code) => j('/auth/mfa/login', { method: 'POST', body: JSON.stringify({ challengeToken, code }) }),
    mfaSetup: () => j('/auth/mfa/setup', { method: 'POST' }),
    mfaConfirm: (setupToken, code) => j('/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ setupToken, code }) }),
    forgotPassword: (email) => j('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token, password) => j('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    verifyEmail: (token) => j('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
    resendVerification: (email) => j('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
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
    consents: (id) => j(`/artisans/${id}/consents`),
    updateConsents: (id, consents, note) => j(`/artisans/${id}/consents`, { method: 'POST', body: JSON.stringify({ consents, note }) }),
    verifyPehchan: (id, note) => j(`/artisans/${id}/pehchan/verify`, { method: 'POST', body: JSON.stringify({ note }) }),
    rejectPehchan: (id, reason) => j(`/artisans/${id}/pehchan/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  },
  products: {
    list: () => j('/products'),
    search: (params) => j('/products' + qs(params)),
    get: (id) => j(`/products/${id}`),
    create: (data) => j('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => j(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => j(`/products/${id}`, { method: 'DELETE' }),
    history: (id) => j(`/products/${id}/history`),
    evidence: (id) => j(`/products/${id}/evidence`),
    ownerApprove: (id, statement) => j(`/products/${id}/owner-approve`, { method: 'POST', body: JSON.stringify({ statement }) }),
    approve: (id, note) => j(`/products/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
    reject: (id, reason) => j(`/products/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    reviewEvidence: (productId, evidenceId, status) => j(`/products/${productId}/evidence/${evidenceId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  verify: {
    check: (id) => j(`/verify/${id}`),
    chain: () => j('/verify'),
  },
  disputes: {
    list: () => j('/disputes'),
    create: (data) => j('/disputes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => j(`/disputes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  audit: {
    list: (limit = 50) => j(`/audit?limit=${limit}`),
  },
  media: {
    list: () => j('/media'),
    update: (id, data) => j(`/media/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    archive: (id) => j(`/media/${id}`, { method: 'DELETE' }),
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
