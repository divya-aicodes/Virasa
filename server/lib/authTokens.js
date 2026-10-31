import crypto from 'node:crypto';
import db from '../db.js';

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function issueAuthToken(userId, purpose, ttlMs, metadata = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  db.prepare(`
    UPDATE auth_tokens SET consumed_at = ?
    WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
  `).run(now.toISOString(), userId, purpose);
  db.prepare(`
    INSERT INTO auth_tokens (user_id, purpose, token_hash, metadata, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, purpose, tokenHash(token), JSON.stringify(metadata || {}), new Date(now.getTime() + ttlMs).toISOString(), now.toISOString());
  return token;
}

export function findAuthToken(token, purpose) {
  const row = db.prepare(`
    SELECT * FROM auth_tokens
    WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL
  `).get(tokenHash(token), purpose);
  if (!row || Date.parse(row.expires_at) <= Date.now()) return null;
  let metadata = {};
  try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
  return { ...row, metadata };
}

export function consumeAuthToken(id) {
  return db.prepare('UPDATE auth_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL').run(new Date().toISOString(), id).changes === 1;
}
