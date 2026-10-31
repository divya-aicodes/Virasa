import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import {
  hashPassword, verifyPassword, publicUser, createSession, currentUser,
  sessionToken, destroySession, setSessionCookie, clearSessionCookie,
} from '../lib/auth.js';
import { issueAuthToken, findAuthToken, consumeAuthToken } from '../lib/authTokens.js';
import { sendEmail } from '../lib/email.js';
import { newMfaSecret, encryptSecret, decryptSecret, verifyMfaCode } from '../lib/mfa.js';
import { audit } from '../lib/audit.js';
import { validatePehchanId } from '../lib/validate.js';

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_SIGNUP_KEY = process.env.ADMIN_SIGNUP_KEY || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const EMAIL_TOKEN_TTL = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL = 30 * 60 * 1000;
const MFA_TOKEN_TTL = 5 * 60 * 1000;
const requireVerifiedEmail = process.env.REQUIRE_EMAIL_VERIFICATION === 'true' || process.env.NODE_ENV === 'production';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function newUserId() {
  return `USR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function newArtisanId() {
  return `ART-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function sendVerification(user) {
  const token = issueAuthToken(user.id, 'email_verification', EMAIL_TOKEN_TTL);
  const link = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Virasā email',
    text: `Welcome to Virasā. Verify your email within 24 hours:\n\n${link}\n\nIf you did not create this account, ignore this message.`,
  });
}

router.post('/register', asyncRoute(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  let artisanId = body.artisanId ? String(body.artisanId).trim().slice(0, 20) : '';

  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'name must be 2–100 characters' });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'email must be a valid address' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ error: 'password must be 10–128 characters' });

  let role = 'artisan';
  if (body.role === 'admin') {
    if (!ADMIN_SIGNUP_KEY || body.adminKey !== ADMIN_SIGNUP_KEY) return res.status(403).json({ error: 'Admin registration requires a valid signup key' });
    role = 'admin';
  }
  let pehchan = { ok: true, value: '' };
  const village = String(body.village || '').trim();
  const craft = String(body.craft || '').trim();
  const state = String(body.state || '').trim();
  const district = String(body.district || '').trim();
  if (role === 'artisan' && !artisanId) {
    pehchan = validatePehchanId(body.pehchanId, { required: true });
    if (!pehchan.ok) return res.status(400).json({ error: pehchan.error });
    if (!village || village.length > 100) return res.status(400).json({ error: 'village is required and must be 1–100 characters' });
    if (!craft || craft.length > 100) return res.status(400).json({ error: 'craft is required and must be 1–100 characters' });
    if (!state || state.length > 50) return res.status(400).json({ error: 'state is required and must be 1–50 characters' });
    if (!district || district.length > 50) return res.status(400).json({ error: 'district is required and must be 1–50 characters' });
    if (db.prepare('SELECT id FROM artisans WHERE pehchan_id = ?').get(pehchan.value)) {
      return res.status(409).json({ error: 'This PEHCHAN ID is already registered' });
    }
  }
  if (artisanId && !db.prepare('SELECT id FROM artisans WHERE id = ?').get(artisanId)) return res.status(400).json({ error: 'artisanId does not match any artisan' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists' });

  const id = newUserId();
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (role === 'artisan' && !artisanId) {
      artisanId = newArtisanId();
      db.prepare(`
        INSERT INTO artisans
          (id, name, village, craft, state, district, pehchan_id, pehchan_verification_status,
           pehchan_submitted_at, pehchan_verification_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'manual_official_portal_review')
      `).run(artisanId, name, village, craft, state, district, pehchan.value, now);
    }
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, artisan_id, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(id, name, email, hashPassword(password), role, artisanId || null);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (String(error.message).includes('artisans.pehchan_id')) {
      return res.status(409).json({ error: 'This PEHCHAN ID is already registered' });
    }
    throw error;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  await sendVerification(user);
  audit(req, { action: 'auth.registered', entityType: 'user', entityId: id, metadata: { role, pehchanVerificationStatus: role === 'artisan' ? 'pending' : null } });
  res.status(201).json({ user: publicUser(user), verificationRequired: true });
}));

router.post('/login', asyncRoute(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  if (requireVerifiedEmail && !row.email_verified) return res.status(403).json({ error: 'Verify your email before signing in', code: 'EMAIL_NOT_VERIFIED' });

  if (row.role === 'admin' && row.mfa_enabled) {
    const challengeToken = issueAuthToken(row.id, 'mfa_login', MFA_TOKEN_TTL);
    return res.status(202).json({ mfaRequired: true, challengeToken });
  }

  const token = createSession(row.id, undefined, { mfaVerified: row.role !== 'admin' });
  setSessionCookie(res, token);
  audit({ ...req, user: { user_id: row.id, role: row.role } }, { action: 'auth.login', entityType: 'user', entityId: row.id, metadata: { mfa: false } });
  res.json({ token, user: publicUser(row) });
}));

router.post('/mfa/login', asyncRoute(async (req, res) => {
  const challenge = findAuthToken(req.body?.challengeToken, 'mfa_login');
  if (!challenge) return res.status(401).json({ error: 'MFA challenge is invalid or expired' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(challenge.user_id);
  if (!user?.mfa_enabled || !user.mfa_secret_encrypted) return res.status(409).json({ error: 'MFA is not configured' });
  if (!(await verifyMfaCode(decryptSecret(user.mfa_secret_encrypted), req.body?.code))) return res.status(401).json({ error: 'Invalid authentication code' });
  if (!consumeAuthToken(challenge.id)) return res.status(401).json({ error: 'MFA challenge was already used' });
  const token = createSession(user.id, undefined, { mfaVerified: true });
  setSessionCookie(res, token);
  audit({ ...req, user: { user_id: user.id, role: user.role } }, { action: 'auth.login', entityType: 'user', entityId: user.id, metadata: { mfa: true } });
  res.json({ token, user: publicUser(user) });
}));

router.post('/mfa/setup', (req, res) => {
  const user = currentUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Administrator session required' });
  const generated = newMfaSecret(user.email);
  const setupToken = issueAuthToken(user.user_id, 'mfa_setup', MFA_TOKEN_TTL, { encryptedSecret: encryptSecret(generated.secret) });
  res.json({ setupToken, uri: generated.uri, secret: generated.secret, expiresInSeconds: MFA_TOKEN_TTL / 1000 });
});

router.post('/mfa/confirm', asyncRoute(async (req, res) => {
  const user = currentUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Administrator session required' });
  const setup = findAuthToken(req.body?.setupToken, 'mfa_setup');
  if (!setup || setup.user_id !== user.user_id) return res.status(401).json({ error: 'MFA setup is invalid or expired' });
  const encrypted = setup.metadata.encryptedSecret;
  if (!encrypted || !(await verifyMfaCode(decryptSecret(encrypted), req.body?.code))) return res.status(401).json({ error: 'Invalid authentication code' });
  if (!consumeAuthToken(setup.id)) return res.status(401).json({ error: 'MFA setup was already used' });
  db.prepare('UPDATE users SET mfa_enabled = 1, mfa_secret_encrypted = ? WHERE id = ?').run(encrypted, user.user_id);
  db.prepare('UPDATE sessions SET mfa_verified = 1 WHERE token = ?').run(sessionToken(req));
  audit(req, { action: 'auth.mfa_enabled', entityType: 'user', entityId: user.user_id });
  res.json({ ok: true });
}));

router.post('/forgot-password', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    const token = issueAuthToken(user.id, 'password_reset', RESET_TOKEN_TTL);
    const link = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail({ to: user.email, subject: 'Reset your Virasā password', text: `Reset your password within 30 minutes:\n\n${link}\n\nIf you did not request this, ignore this message.` });
    audit({ ...req, user: { user_id: user.id, role: user.role } }, { action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id });
  }
  res.status(202).json({ ok: true, message: 'If the account exists, a reset link has been sent.' });
}));

router.post('/reset-password', (req, res) => {
  const reset = findAuthToken(req.body?.token, 'password_reset');
  const password = String(req.body?.password || '');
  if (!reset) return res.status(400).json({ error: 'Reset link is invalid or expired' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ error: 'password must be 10–128 characters' });
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!consumeAuthToken(reset.id)) throw new Error('Reset token already consumed');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), reset.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
    audit({ ...req, user: { user_id: reset.user_id, role: 'user' } }, { action: 'auth.password_reset', entityType: 'user', entityId: reset.user_id });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ ok: true });
});

router.post('/verify-email', (req, res) => {
  const verification = findAuthToken(req.body?.token, 'email_verification');
  if (!verification) return res.status(400).json({ error: 'Verification link is invalid or expired' });
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!consumeAuthToken(verification.id)) throw new Error('Verification token already consumed');
    db.prepare('UPDATE users SET email_verified = 1, email_verified_at = ? WHERE id = ?').run(new Date().toISOString(), verification.user_id);
    audit({ ...req, user: { user_id: verification.user_id, role: 'user' } }, { action: 'auth.email_verified', entityType: 'user', entityId: verification.user_id });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ ok: true });
});

router.post('/resend-verification', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user && !user.email_verified) await sendVerification(user);
  res.status(202).json({ ok: true, message: 'If verification is required, a new link has been sent.' });
}));

router.post('/logout', (req, res) => {
  destroySession(sessionToken(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: publicUser(user) });
});

export default router;
