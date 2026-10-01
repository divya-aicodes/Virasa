import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { makeHash, rebuildChainFrom, compactChain, verifyProduct } from '../lib/hashchain.js';
import { validateProduct } from '../lib/validate.js';
import { isPrivilegedRequest } from '../lib/auth.js';

const router = Router();

export function serializeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    steps: JSON.parse(row.steps || '[]'),
    materials: JSON.parse(row.materials || '[]'),
  };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

const SELECT_JOIN = `
  SELECT p.*, a.name AS artisan_name, a.village AS artisan_village, a.craft AS artisan_craft,
         a.photo AS artisan_photo, a.state AS artisan_state, a.district AS artisan_district
  FROM products p JOIN artisans a ON a.id = p.artisan_id
`;

function listQuery({ q, category, craft }) {
  const where = [];
  const params = [];
  if (q && String(q).trim()) {
    const like = `%${escapeLike(q.trim())}%`;
    where.push(`(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR a.village LIKE ? ESCAPE '\\' OR p.materials LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like, like);
  }
  if (category && String(category).trim()) {
    where.push('p.category = ?');
    params.push(String(category).trim());
  }
  if (craft && String(craft).trim()) {
    where.push('a.craft = ?');
    params.push(String(craft).trim());
  }
  return {
    where: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

router.get('/', (req, res) => {
  const { q, category, craft, page, limit } = req.query;
  const { where, params } = listQuery({ q, category, craft });

  // Paginated mode is used when the client asks for page/limit explicitly.
  const wantsPagination = page !== undefined || limit !== undefined;
  if (!wantsPagination) {
    const rows = db.prepare(`${SELECT_JOIN} ${where} ORDER BY p.chain_index ASC`).all(...params);
    return res.json(rows.map(serializeProduct));
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p JOIN artisans a ON a.id = p.artisan_id ${where}`).get(...params).n;
  const rows = db.prepare(`${SELECT_JOIN} ${where} ORDER BY p.chain_index ASC LIMIT ? OFFSET ?`)
    .all(...params, limitNum, offset);

  res.json({
    data: rows.map(serializeProduct),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT_JOIN} WHERE p.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(serializeProduct(row));
});

router.post('/', (req, res) => {
  const v = validateProduct(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const { artisan_id, title, description, image, steps, materials, price, category } = v.value;
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== artisan_id) {
    return res.status(403).json({ error: 'You can only create products for your linked artisan profile' });
  }
  const artisan = db.prepare('SELECT id FROM artisans WHERE id = ?').get(artisan_id);
  if (!artisan) return res.status(400).json({ error: 'Artisan does not exist' });

  const id = `KC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();
  const productRow = {
    id,
    artisan_id,
    title,
    description,
    image,
    steps: JSON.stringify(steps),
    materials: JSON.stringify(materials),
    price,
    category,
    created_at: now,
  };
  const insert = db.prepare(`INSERT INTO products (id, artisan_id, title, description, image, steps, materials, price, category, hash, prev_hash, chain_index, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  db.exec('BEGIN IMMEDIATE');
  try {
    const { hash, prevHash } = makeHash(productRow);
    const chainIndex = (db.prepare('SELECT COALESCE(MAX(chain_index), 0) AS n FROM products').get().n) + 1;
    insert.run(id, artisan_id, title, description, image, productRow.steps, productRow.materials, price, category, hash, prevHash, chainIndex, now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.status(201).json(serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== existing.artisan_id) {
    return res.status(403).json({ error: 'You can only update products linked to your artisan profile' });
  }

  const merged = { ...existing, ...req.body };
  const v = validateProduct(merged);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const { artisan_id, title, description, image, steps, materials, price, category } = v.value;
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== artisan_id) {
    return res.status(403).json({ error: 'You cannot transfer a product to another artisan profile' });
  }
  const artisan = db.prepare('SELECT id FROM artisans WHERE id = ?').get(artisan_id);
  if (!artisan) return res.status(400).json({ error: 'Artisan does not exist' });

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE products SET artisan_id = ?, title = ?, description = ?, image = ?, steps = ?, materials = ?, price = ?, category = ? WHERE id = ?`)
      .run(artisan_id, title, description, image, JSON.stringify(steps), JSON.stringify(materials), price, category, existing.id);
    rebuildChainFrom(existing.chain_index);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  res.json({ ...serializeProduct(row), verify: verifyProduct(existing.id) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== existing.artisan_id) {
    return res.status(403).json({ error: 'You can only delete products linked to your artisan profile' });
  }

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
    compactChain();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true, deleted: existing.id });
});

export default router;
