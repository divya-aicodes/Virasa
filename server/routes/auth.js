import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import {
  hashPassword,
  verifyPassword,
  publicUser,
  createSession,
  currentUser,
  sessionToken,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
} from '../lib/auth.js';

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_SIGNUP_KEY = process.env.ADMIN_SIGNUP_KEY || '';

function newUserId() {
  return `USR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

router.post('/register', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const artisanId = body.artisanId ? String(body.artisanId).trim().slice(0, 20) : '';

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'name must be 2–100 characters' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'email must be a valid address' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'password must be 8–128 characters' });
  }

  let role = 'artisan';
  if (body.role === 'admin') {
    if (!ADMIN_SIGNUP_KEY || body.adminKey !== ADMIN_SIGNUP_KEY) {
      return res.status(403).json({ error: 'Admin registration requires a valid signup key' });
    }
    role = 'admin';
  }

  if (artisanId && !db.prepare('SELECT id FROM artisans WHERE id = ?').get(artisanId)) {
    return res.status(400).json({ error: 'artisanId does not match any artisan' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const id = newUserId();
  db.prepare('INSERT INTO users (id, name, email, password_hash, role, artisan_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, email, hashPassword(password), role, artisanId || null);

  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

router.post('/login', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSession(row.id);
  setSessionCookie(res, token);
  res.json({ token, user: publicUser(row) });
});

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
