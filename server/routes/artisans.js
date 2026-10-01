import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { validateArtisan } from '../lib/validate.js';
import { isPrivilegedRequest } from '../lib/auth.js';

const router = Router();

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function listQuery({ q, craft, state }) {
  const where = [];
  const params = [];
  if (q && String(q).trim()) {
    const like = `%${escapeLike(q.trim())}%`;
    where.push(`(name LIKE ? ESCAPE '\\' OR village LIKE ? ESCAPE '\\' OR craft LIKE ? ESCAPE '\\' OR bio LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like);
  }
  if (craft && String(craft).trim()) {
    where.push('craft = ?');
    params.push(String(craft).trim());
  }
  if (state && String(state).trim()) {
    where.push('state = ?');
    params.push(String(state).trim());
  }
  return {
    where: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

router.get('/', (req, res) => {
  const { q, craft, state, page, limit } = req.query;
  const { where, params } = listQuery({ q, craft, state });

  const wantsPagination = page !== undefined || limit !== undefined;
  if (!wantsPagination) {
    const rows = db.prepare(`SELECT * FROM artisans ${where} ORDER BY created_at ASC`).all(...params);
    return res.json(rows);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM artisans ${where}`).get(...params).n;
  const rows = db.prepare(`SELECT * FROM artisans ${where} ORDER BY created_at ASC LIMIT ? OFFSET ?`)
    .all(...params, limitNum, offset);

  res.json({
    data: rows,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM artisans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Artisan not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  if (!isPrivilegedRequest(req) && req.user?.role !== 'artisan') {
    return res.status(403).json({ error: 'Artisan or administrator access required' });
  }
  if (req.user?.role === 'artisan' && req.user.artisan_id) {
    return res.status(409).json({ error: 'This account is already linked to an artisan profile' });
  }

  const v = validateArtisan(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const { name, village, craft, state, district, bio, photo } = v.value;
  const id = newId('ART');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO artisans (id, name, village, craft, state, district, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, village, craft, state, district, bio, photo);
    if (req.user?.role === 'artisan') {
      db.prepare('UPDATE users SET artisan_id = ? WHERE id = ?').run(id, req.user.user_id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.status(201).json(db.prepare('SELECT * FROM artisans WHERE id = ?').get(id));
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM artisans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Artisan not found' });
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== existing.id) {
    return res.status(403).json({ error: 'You can only update your own artisan profile' });
  }

  const v = validateArtisan({ ...existing, ...req.body });
  if (!v.ok) return res.status(400).json({ error: v.error });

  const { name, village, craft, state, district, bio, photo } = v.value;
  db.prepare('UPDATE artisans SET name = ?, village = ?, craft = ?, state = ?, district = ?, bio = ?, photo = ? WHERE id = ?')
    .run(name, village, craft, state, district, bio, photo, existing.id);
  res.json(db.prepare('SELECT * FROM artisans WHERE id = ?').get(existing.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM artisans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Artisan not found' });
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== existing.id) {
    return res.status(403).json({ error: 'You can only delete your own artisan profile' });
  }

  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE artisan_id = ?').get(existing.id).n;
  if (productCount > 0) {
    return res.status(409).json({ error: `Cannot delete artisan with ${productCount} product(s) linked` });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE users SET artisan_id = NULL WHERE artisan_id = ?').run(existing.id);
    db.prepare('DELETE FROM artisans WHERE id = ?').run(existing.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true, deleted: existing.id });
});

export default router;
