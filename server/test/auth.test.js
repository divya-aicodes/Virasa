import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generate } from 'otplib';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'virasa-auth-'));
process.env.DB_PATH = path.join(dir, 'test.db');
process.env.API_KEYS = 'test-api-key';
process.env.ADMIN_SIGNUP_KEY = 'super-secret-admin-key';

const { hashPassword, verifyPassword, createSession, findSession, destroySession } = await import('../lib/auth.js');
const { default: db } = await import('../db.js');
await import('../seed.js');
const { default: app } = await import('../app.js');

let server;
let base;

function artisanIdentity(pehchanId) {
  return { pehchanId, village: 'Ranti', craft: 'Madhubani painting', state: 'Bihar', district: 'Madhubani' };
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function req(method, url, { body, token, apiKey, cookie, origin, metricsToken } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  if (metricsToken) headers['x-metrics-token'] = metricsToken;
  const res = await fetch(base + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, json: () => res.json() };
}

test('hashPassword/verifyPassword round-trips and rejects wrong input', () => {
  const stored = hashPassword('correct horse');
  assert.ok(stored.includes(':'));
  assert.ok(verifyPassword('correct horse', stored));
  assert.ok(!verifyPassword('wrong', stored));
  assert.ok(!verifyPassword('correct horse', 'bogus'));
});

test('createSession/findSession/destroySession lifecycle', () => {
  const userId = db.prepare('SELECT id FROM users WHERE role = ?').get('admin').id;
  const token = createSession(userId, 60_000);
  const session = findSession(token);
  assert.equal(session.user_id, userId);
  assert.equal(session.role, 'admin');
  destroySession(token);
  assert.equal(findSession(token), null);
});

test('register creates an artisan account', async () => {
  const res = await req('POST', '/api/auth/register', {
    body: { name: 'Meera Devi', email: 'meera@example.com', password: 'longenough1', ...artisanIdentity('PCH-MEERA-01') },
  });
  assert.equal(res.status, 201);
  const { user } = await res.json();
  assert.equal(user.role, 'artisan');
  assert.ok(user.artisanId);
  assert.equal(user.pehchanVerificationStatus, 'pending');
  assert.ok(!('password_hash' in user));
});

test('administrator review promotes a pending PEHCHAN profile to verified', async () => {
  const registration = await req('POST', '/api/auth/register', {
    body: { name: 'Review Maker', email: 'review-maker@example.com', password: 'review-maker-pass', ...artisanIdentity('PCH-REVIEW-01') },
  });
  assert.equal(registration.status, 201);
  const registeredUser = (await registration.json()).user;

  const adminLogin = await req('POST', '/api/auth/login', {
    body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' },
  });
  const { token } = await adminLogin.json();
  const reviewed = await req('POST', `/api/artisans/${registeredUser.artisanId}/pehchan/verify`, {
    token,
    body: { note: 'Official artisan database details matched' },
  });
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json()).pehchan_verification_status, 'verified');

  const makerLogin = await req('POST', '/api/auth/login', {
    body: { email: 'review-maker@example.com', password: 'review-maker-pass' },
  });
  assert.equal((await makerLogin.json()).user.pehchanVerificationStatus, 'verified');
});

test('register rejects a duplicate email', async () => {
  const res = await req('POST', '/api/auth/register', {
    body: { name: 'Meera Again', email: 'meera@example.com', password: 'longenough1', ...artisanIdentity('PCH-MEERA-02') },
  });
  assert.equal(res.status, 409);
});

test('register rejects a weak password', async () => {
  const res = await req('POST', '/api/auth/register', {
    body: { name: 'Weak User', email: 'weak@example.com', password: 'short' },
  });
  assert.equal(res.status, 400);
});

test('register rejects admin role without the signup key', async () => {
  const res = await req('POST', '/api/auth/register', {
    body: { name: 'Rogue Admin', email: 'rogue@example.com', password: 'longenough1', role: 'admin' },
  });
  assert.equal(res.status, 403);
});

test('register allows admin role with the signup key', async () => {
  const res = await req('POST', '/api/auth/register', {
    body: { name: 'Trusted Admin', email: 'trusted@example.com', password: 'longenough1', role: 'admin', adminKey: 'super-secret-admin-key' },
  });
  assert.equal(res.status, 201);
  const { user } = await res.json();
  assert.equal(user.role, 'admin');
});

test('seeded admin can log in', async () => {
  const res = await req('POST', '/api/auth/login', {
    body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' },
  });
  assert.equal(res.status, 200);
  const { token, user } = await res.json();
  assert.ok(token && token.length >= 32);
  assert.equal(user.role, 'admin');
  assert.match(res.headers.get('set-cookie') || '', /virasa_session=.*HttpOnly/i);
});

test('email verification tokens are single-use', async () => {
  const email = 'verify-phase3@example.com';
  const registration = await req('POST', '/api/auth/register', { body: { name: 'Verify User', email, password: 'verification-pass-1', ...artisanIdentity('PCH-VERIFY-01') } });
  assert.equal(registration.status, 201);
  const mail = db.prepare('SELECT text_body FROM email_outbox WHERE recipient = ? ORDER BY id DESC LIMIT 1').get(email);
  const token = new URL(mail.text_body.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
  const verified = await req('POST', '/api/auth/verify-email', { body: { token } });
  assert.equal(verified.status, 200);
  const replay = await req('POST', '/api/auth/verify-email', { body: { token } });
  assert.equal(replay.status, 400);
  assert.equal(db.prepare('SELECT email_verified FROM users WHERE email = ?').get(email).email_verified, 1);
});

test('password reset rotates the password and invalidates the token', async () => {
  const email = 'verify-phase3@example.com';
  const requested = await req('POST', '/api/auth/forgot-password', { body: { email } });
  assert.equal(requested.status, 202);
  const mail = db.prepare("SELECT text_body FROM email_outbox WHERE recipient = ? AND subject LIKE 'Reset%' ORDER BY id DESC LIMIT 1").get(email);
  const token = new URL(mail.text_body.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
  const reset = await req('POST', '/api/auth/reset-password', { body: { token, password: 'new-admin-pass-2026' } });
  assert.equal(reset.status, 200);
  const replay = await req('POST', '/api/auth/reset-password', { body: { token, password: 'another-admin-pass' } });
  assert.equal(replay.status, 400);
  const login = await req('POST', '/api/auth/login', { body: { email, password: 'new-admin-pass-2026' } });
  assert.equal(login.status, 200);
});

test('admin MFA setup changes subsequent login into a challenge', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' } });
  const { token } = await login.json();
  const setup = await req('POST', '/api/auth/mfa/setup', { token });
  assert.equal(setup.status, 200);
  const setupBody = await setup.json();
  const code = await generate({ secret: setupBody.secret });
  const confirmed = await req('POST', '/api/auth/mfa/confirm', { token, body: { setupToken: setupBody.setupToken, code } });
  assert.equal(confirmed.status, 200);

  const challenged = await req('POST', '/api/auth/login', { body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' } });
  assert.equal(challenged.status, 202);
  const challenge = await challenged.json();
  assert.equal(challenge.mfaRequired, true);
  const mfaLogin = await req('POST', '/api/auth/mfa/login', { body: { challengeToken: challenge.challengeToken, code: await generate({ secret: setupBody.secret }) } });
  assert.equal(mfaLogin.status, 200);
  assert.equal((await mfaLogin.json()).user.role, 'admin');
  db.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret_encrypted = NULL WHERE email = ?').run('admin@virasa.in');
});

test('HttpOnly cookie authenticates browser requests', async () => {
  const login = await req('POST', '/api/auth/login', {
    body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' },
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const me = await req('GET', '/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, 'admin');
});

test('login rejects a wrong password', async () => {
  const res = await req('POST', '/api/auth/login', {
    body: { email: 'admin@virasa.in', password: 'nope-nope-nope' },
  });
  assert.equal(res.status, 401);
});

test('/api/auth/me returns the session user', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' } });
  const { token } = await login.json();

  const res = await req('GET', '/api/auth/me', { token });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.email, 'admin@virasa.in');
});

test('/api/auth/me rejects a missing token', async () => {
  const res = await req('GET', '/api/auth/me');
  assert.equal(res.status, 401);
});

test('logout invalidates the session', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' } });
  const { token } = await login.json();

  const out = await req('POST', '/api/auth/logout', { token });
  assert.equal(out.status, 200);

  const me = await req('GET', '/api/auth/me', { token });
  assert.equal(me.status, 401);
});

test('write endpoints reject requests without credentials', async () => {
  const res = await req('POST', '/api/artisans', {
    body: { name: 'Nope', village: 'Nowhere', craft: 'Fake' },
  });
  assert.equal(res.status, 401);
});

test('write endpoints accept a valid API key', async () => {
  const res = await req('POST', '/api/artisans', {
    apiKey: 'test-api-key',
    body: { name: 'Key Artisan', village: 'Keyville', craft: 'Key Craft' },
  });
  assert.equal(res.status, 201);
});

test('write endpoints accept an admin session', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'admin@virasa.in', password: 'admin-virasa-2026' } });
  const { token } = await login.json();

  const res = await req('POST', '/api/artisans', {
    token,
    body: { name: 'Session Artisan', village: 'Sessionville', craft: 'Session Craft' },
  });
  assert.equal(res.status, 201);
});

test('a new artisan account is linked to its pending PEHCHAN profile', async () => {
  await req('POST', '/api/auth/register', {
    body: { name: 'New Maker', email: 'maker@example.com', password: 'maker-password-123', ...artisanIdentity('PCH-MAKER-01') },
  });
  const login = await req('POST', '/api/auth/login', {
    body: { email: 'maker@example.com', password: 'maker-password-123' },
  });
  const { token } = await login.json();

  const me = await req('GET', '/api/auth/me', { token });
  const { user } = await me.json();
  assert.ok(user.artisanId);
  assert.equal(user.pehchanVerificationStatus, 'pending');

  const duplicate = await req('POST', '/api/artisans', {
    token,
    body: { name: 'New Maker', village: 'Jaipur', craft: 'Blue Pottery' },
  });
  assert.equal(duplicate.status, 409);
});

test('artisan sessions are restricted to their linked profile', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'sunita@virasa.in', password: 'artisan-virasa-2026' } });
  const { token } = await login.json();

  const duplicate = await req('POST', '/api/artisans', {
    token,
    body: { name: 'Second Profile', village: 'Nowhere', craft: 'Fake' },
  });
  assert.equal(duplicate.status, 409);

  const own = await req('PATCH', '/api/artisans/ART-MITHILA1', {
    token,
    body: { village: 'Ranti, Madhubani' },
  });
  assert.equal(own.status, 200);

  const other = await req('PATCH', '/api/artisans/ART-MITHILA2', {
    token,
    body: { village: 'Forbidden change' },
  });
  assert.equal(other.status, 403);
});

test('artisan can create products only for the linked profile', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'sunita@virasa.in', password: 'artisan-virasa-2026' } });
  const { token } = await login.json();
  const product = {
    title: 'Owned provenance test',
    description: 'Created by the linked artisan account',
    image: '/uploads/product-KC-A1B2C3-final.svg',
    steps: [],
    materials: ['Paper'],
    price: 100,
    category: 'Test',
  };

  const own = await req('POST', '/api/products', {
    token,
    body: { ...product, artisan_id: 'ART-MITHILA1' },
  });
  assert.equal(own.status, 201);

  const other = await req('POST', '/api/products', {
    token,
    body: { ...product, artisan_id: 'ART-MITHILA2' },
  });
  assert.equal(other.status, 403);
});

test('API keys in query parameters are rejected', async () => {
  const res = await req('POST', '/api/artisans?api_key=test-api-key', {
    body: { name: 'Leaked Key', village: 'Nowhere', craft: 'None' },
  });
  assert.equal(res.status, 401);
});

test('state-changing requests reject untrusted browser origins', async () => {
  const res = await req('POST', '/api/artisans', {
    apiKey: 'test-api-key',
    origin: 'https://attacker.example',
    body: { name: 'Cross Site', village: 'Nowhere', craft: 'None' },
  });
  assert.equal(res.status, 403);
});

test('API responses include baseline browser security headers', async () => {
  const res = await req('GET', '/api');
  assert.match(res.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('metrics require the dedicated monitoring token', async () => {
  process.env.METRICS_TOKEN = 'metrics-test-token';
  const denied = await req('GET', '/api/metrics');
  assert.equal(denied.status, 401);
  const accepted = await req('GET', '/api/metrics', { metricsToken: 'metrics-test-token' });
  assert.equal(accepted.status, 200);
  assert.match(await (await fetch(base + '/api/metrics', { headers: { 'x-metrics-token': 'metrics-test-token' } })).text(), /virasa_http_requests_total/);
  delete process.env.METRICS_TOKEN;
});

test('production MFA gate protects admin-only read routes', async () => {
  const adminId = db.prepare('SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1').get('admin').id;
  const passwordOnlyToken = createSession(adminId, 60_000);
  const mfaVerifiedToken = createSession(adminId, 60_000, { mfaVerified: true });
  process.env.REQUIRE_ADMIN_MFA = 'true';

  try {
    const deniedAudit = await req('GET', '/api/audit', { token: passwordOnlyToken });
    assert.equal(deniedAudit.status, 403);

    const deniedMedia = await req('GET', '/api/media', { token: passwordOnlyToken });
    assert.equal(deniedMedia.status, 403);
    assert.equal((await deniedMedia.json()).code, 'MFA_REQUIRED');

    const acceptedAudit = await req('GET', '/api/audit', { token: mfaVerifiedToken });
    assert.equal(acceptedAudit.status, 200);
  } finally {
    delete process.env.REQUIRE_ADMIN_MFA;
    destroySession(passwordOnlyToken);
    destroySession(mfaVerifiedToken);
  }
});
