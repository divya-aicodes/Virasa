import crypto from 'node:crypto';
import db from '../db.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'virasa_session';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, key] = String(stored || '').split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

export function publicUser(row) {
  const artisan = row.artisan_id
    ? db.prepare('SELECT pehchan_id, pehchan_verification_status FROM artisans WHERE id = ?').get(row.artisan_id)
    : null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    artisanId: row.artisan_id || null,
    emailVerified: Boolean(row.email_verified),
    mfaEnabled: Boolean(row.mfa_enabled),
    pehchanId: artisan?.pehchan_id || null,
    pehchanVerificationStatus: artisan?.pehchan_verification_status || null,
  };
}

export function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function cookieToken(req) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === SESSION_COOKIE) {
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sessionToken(req) {
  return cookieToken(req) || bearerToken(req);
}

export function setSessionCookie(res, token, ttlMs = SESSION_TTL_MS) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: ttlMs,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
  });
}

export function createSession(userId, ttlMs = SESSION_TTL_MS, { mfaVerified = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, mfa_verified) VALUES (?, ?, ?, ?)').run(token, userId, expiresAt, mfaVerified ? 1 : 0);
  return token;
}

export function findSession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at, s.mfa_verified,
           u.name, u.email, u.role, u.artisan_id, u.email_verified, u.mfa_enabled
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function currentUser(req) {
  return findSession(sessionToken(req));
}

export function isPrivilegedRequest(req) {
  if (req.apiKeyAuthenticated) return true;
  return hasAdminAccess(req.user);
}

export function hasAdminAccess(user) {
  if (user?.role !== 'admin') return false;
  return process.env.REQUIRE_ADMIN_MFA !== 'true' || Boolean(user.mfa_verified);
}

export function requireUser(roles = []) {
  return (req, res, next) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.length > 0 && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (user.role === 'admin' && process.env.REQUIRE_ADMIN_MFA === 'true' && !user.mfa_verified) {
      return res.status(403).json({ error: 'Administrator MFA verification required', code: 'MFA_REQUIRED' });
    }
    req.user = user;
    next();
  };
}
