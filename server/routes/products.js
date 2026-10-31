import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { appendRevision, revisionHistory, verifyProductRevision } from '../lib/ledger.js';
import { validateProduct } from '../lib/validate.js';
import { currentUser, hasAdminAccess, isPrivilegedRequest } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { consentSnapshot } from '../lib/privacy.js';
import { ftsQuery } from '../lib/search.js';

const router = Router();

export function serializeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    owner_approved: Boolean(row.owner_approved),
    steps: JSON.parse(row.steps || '[]'),
    materials: JSON.parse(row.materials || '[]'),
  };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

const SELECT_JOIN = `
  SELECT p.*, a.name AS artisan_name, a.village AS artisan_village, a.craft AS artisan_craft,
         a.photo AS artisan_photo, a.state AS artisan_state, a.district AS artisan_district,
         a.pehchan_verification_status AS artisan_verification_status
  FROM products p JOIN artisans a ON a.id = p.artisan_id
`;

function visibility(req) {
  const user = req.user || currentUser(req);
  if (hasAdminAccess(user)) return { sql: '', params: [], user };
  if (user?.role === 'artisan' && user.artisan_id) {
    return { sql: '((p.status = ? AND a.pehchan_verification_status = ?) OR p.artisan_id = ?)', params: ['verified', 'verified', user.artisan_id], user };
  }
  return { sql: "p.status = 'verified' AND a.pehchan_verification_status = 'verified' AND p.archived_at IS NULL", params: [], user };
}

function listQuery(req, { q, category, craft, status }) {
  const where = [];
  const params = [];
  let relevance = '';
  const relevanceParams = [];
  const scope = visibility(req);
  if (scope.sql) {
    where.push(scope.sql);
    params.push(...scope.params);
  }
  if (q && String(q).trim()) {
    const match = ftsQuery(q);
    if (match) {
      where.push('p.id IN (SELECT product_id FROM product_search WHERE product_search MATCH ?)');
      params.push(match);
      relevance = 'COALESCE((SELECT bm25(product_search) FROM product_search WHERE product_search MATCH ? AND product_id = p.id), 999999), ';
      relevanceParams.push(match);
    }
  }
  if (category && String(category).trim()) {
    where.push('p.category = ?');
    params.push(String(category).trim());
  }
  if (craft && String(craft).trim()) {
    where.push('a.craft = ?');
    params.push(String(craft).trim());
  }
  if (status && hasAdminAccess(scope.user)) {
    where.push('p.status = ?');
    params.push(String(status).trim());
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params, order: `${relevance}p.created_at ASC`, relevanceParams };
}

function canManage(req, product) {
  return isPrivilegedRequest(req) || (req.user?.role === 'artisan' && req.user.artisan_id === product.artisan_id);
}

function canView(req, product) {
  const user = req.user || currentUser(req);
  return (product.status === 'verified' && product.artisan_verification_status === 'verified') || hasAdminAccess(user) || user?.artisan_id === product.artisan_id;
}

function artisanIsVerified(artisanId) {
  return db.prepare('SELECT pehchan_verification_status FROM artisans WHERE id = ?').get(artisanId)?.pehchan_verification_status === 'verified';
}

function evidenceId() {
  return `EVD-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function attachEvidence(productId, items, actorId, verified) {
  const insert = db.prepare(`
    INSERT INTO evidence_items
      (id, product_id, media_id, evidence_type, url, mime_type, sha256, caption,
       verification_status, verified_by, verified_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const findMedia = db.prepare('SELECT * FROM media_assets WHERE url = ? AND status = \'active\'');
  const linkMedia = db.prepare("UPDATE media_assets SET product_id = ?, consent_status = 'granted' WHERE id = ?");
  const now = new Date().toISOString();
  for (const item of items) {
    const media = findMedia.get(item.url);
    if (media) linkMedia.run(productId, media.id);
    insert.run(
      evidenceId(), productId, media?.id || null, item.type, item.url,
      media?.mime_type || '', media?.sha256 || '', String(item.caption || '').slice(0, 160),
      verified ? 'verified' : 'pending', verified ? actorId : null, verified ? now : null,
      actorId || null, now,
    );
  }
}

router.get('/', (req, res) => {
  const { q, category, craft, status, page, limit } = req.query;
  const { where, params, order, relevanceParams } = listQuery(req, { q, category, craft, status });
  const wantsPagination = page !== undefined || limit !== undefined;
  if (!wantsPagination) {
    const rows = db.prepare(`${SELECT_JOIN} ${where} ORDER BY ${order}`).all(...params, ...relevanceParams);
    return res.json(rows.map(serializeProduct));
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p JOIN artisans a ON a.id = p.artisan_id ${where}`).get(...params).n;
  const rows = db.prepare(`${SELECT_JOIN} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, ...relevanceParams, limitNum, offset);
  res.json({ data: rows.map(serializeProduct), total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
});

router.get('/:id/history', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!product || !canView(req, product)) return res.status(404).json({ error: 'Product not found' });
  res.json({ productId: product.id, revisions: revisionHistory(product.id) });
});

router.get('/:id/evidence', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!product || !canView(req, product)) return res.status(404).json({ error: 'Product not found' });
  const rows = db.prepare(`
    SELECT id, evidence_type, url, mime_type, sha256, caption, verification_status,
           verified_at, created_at
    FROM evidence_items WHERE product_id = ? AND archived_at IS NULL ORDER BY created_at ASC
  `).all(product.id);
  res.json({ productId: product.id, evidence: rows });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT_JOIN} WHERE p.id = ?`).get(req.params.id.toUpperCase());
  if (!row || !canView(req, row)) return res.status(404).json({ error: 'Product not found' });
  res.json(serializeProduct(row));
});

router.post('/', (req, res) => {
  const v = validateProduct(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const { artisan_id, title, description, image, steps, materials, price, category } = v.value;
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== artisan_id) {
    return res.status(403).json({ error: 'You can only create products for your linked artisan profile' });
  }
  const artisan = db.prepare('SELECT id, pehchan_verification_status FROM artisans WHERE id = ?').get(artisan_id);
  if (!artisan) {
    return res.status(400).json({ error: 'Artisan does not exist' });
  }

  const privileged = isPrivilegedRequest(req) && artisan.pehchan_verification_status === 'verified';
  const now = new Date().toISOString();
  const id = `KC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const chainIndex = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM product_revisions').get().n;
  const status = privileged ? 'verified' : 'draft';
  const verificationStatus = privileged ? 'verified' : 'unverified';
  const ownerApproved = privileged ? 1 : 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO products
        (id, artisan_id, title, description, image, steps, materials, price, category,
         hash, prev_hash, chain_index, created_at, status, verification_status,
         owner_user_id, owner_approved, approved_by, approved_at, latest_revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'GENESIS', ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id, artisan_id, title, description, image, JSON.stringify(steps), JSON.stringify(materials),
      price, category, chainIndex, now, status, verificationStatus, req.user?.user_id || null,
      ownerApproved, privileged ? req.user?.user_id || null : null, privileged ? now : null,
    );
    appendRevision(id, {
      action: 'created',
      reason: privileged ? 'Created by trusted registry operator' : 'Draft created by artisan',
      actorUserId: req.user?.user_id || null,
      actorRole: req.user?.role || (req.apiKeyAuthenticated ? 'api_key' : 'system'),
    });
    attachEvidence(id, [
      { type: 'primary', url: image, caption: 'Primary artwork image' },
      ...steps.map((step) => ({ type: 'process', url: step.image, caption: step.caption })),
    ], req.user?.user_id || null, privileged);
    audit(req, { action: 'product.created', entityType: 'product', entityId: id, metadata: { status } });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  res.status(201).json(serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
});

router.post('/:id/owner-approve', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!canManage(req, product)) return res.status(403).json({ error: 'Only the linked artisan can approve ownership' });
  if (!artisanIsVerified(product.artisan_id)) {
    return res.status(409).json({ error: 'PEHCHAN verification is required before a product can be submitted for publication' });
  }
  if (!isPrivilegedRequest(req)) {
    const consent = consentSnapshot(product.artisan_id);
    if (!consent.public_profile || !consent.media || !consent.certificate) {
      return res.status(409).json({ error: 'Public profile, media, and certificate consent are required before submission' });
    }
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE products SET owner_approved = 1, status = 'pending', verification_status = 'pending', rejection_reason = '' WHERE id = ?`).run(product.id);
    appendRevision(product.id, { action: 'owner_approved', reason: String(req.body?.statement || 'Ownership and publication approved by artisan').slice(0, 300), actorUserId: req.user?.user_id || null, actorRole: req.user?.role || 'api_key' });
    audit(req, { action: 'product.owner_approved', entityType: 'product', entityId: product.id });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json(serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(product.id)));
});

router.post('/:id/approve', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!isPrivilegedRequest(req)) return res.status(403).json({ error: 'Administrator access required' });
  if (!artisanIsVerified(product.artisan_id)) return res.status(409).json({ error: 'Verify the artisan PEHCHAN identity before approving this record' });
  if (!product.owner_approved) return res.status(409).json({ error: 'Artisan ownership approval is still required' });
  const evidenceCount = db.prepare('SELECT COUNT(*) AS n FROM evidence_items WHERE product_id = ? AND archived_at IS NULL').get(product.id).n;
  if (evidenceCount === 0) return res.status(409).json({ error: 'At least one evidence item is required' });
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE products SET status = 'verified', verification_status = 'verified', approved_by = ?, approved_at = ?, rejection_reason = '' WHERE id = ?`).run(req.user?.user_id || null, now, product.id);
    db.prepare(`UPDATE evidence_items SET verification_status = 'verified', verified_by = ?, verified_at = ? WHERE product_id = ? AND archived_at IS NULL`).run(req.user?.user_id || null, now, product.id);
    appendRevision(product.id, { action: 'verified', reason: String(req.body?.note || 'Evidence reviewed and record approved').slice(0, 300), actorUserId: req.user?.user_id || null, actorRole: req.user?.role || 'api_key' });
    audit(req, { action: 'product.verified', entityType: 'product', entityId: product.id, metadata: { evidenceCount } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json(serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(product.id)));
});

router.post('/:id/reject', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!isPrivilegedRequest(req)) return res.status(403).json({ error: 'Administrator access required' });
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'A rejection reason of 5–500 characters is required' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE products SET status = 'rejected', verification_status = 'rejected', rejection_reason = ? WHERE id = ?`).run(reason, product.id);
    appendRevision(product.id, { action: 'rejected', reason, actorUserId: req.user?.user_id || null, actorRole: req.user?.role || 'api_key' });
    audit(req, { action: 'product.rejected', entityType: 'product', entityId: product.id, metadata: { reason } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json(serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(product.id)));
});

router.patch('/:id/evidence/:evidenceId', (req, res) => {
  if (!isPrivilegedRequest(req)) return res.status(403).json({ error: 'Administrator access required' });
  const status = String(req.body?.status || '');
  if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be verified or rejected' });
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE evidence_items SET verification_status = ?, verified_by = ?, verified_at = ?
    WHERE id = ? AND product_id = ? AND archived_at IS NULL
  `).run(status, req.user?.user_id || null, now, req.params.evidenceId, req.params.id.toUpperCase());
  if (!result.changes) return res.status(404).json({ error: 'Evidence item not found' });
  audit(req, { action: `evidence.${status}`, entityType: 'evidence', entityId: req.params.evidenceId, metadata: { productId: req.params.id.toUpperCase() } });
  res.json({ ok: true, status });
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canManage(req, existing)) return res.status(403).json({ error: 'You can only update products linked to your artisan profile' });
  const correctionReason = String(req.body?.correctionReason || '').trim();
  if (existing.status === 'verified' && !isPrivilegedRequest(req) && correctionReason.length < 10) {
    return res.status(400).json({ error: 'A correction reason of at least 10 characters is required for a verified record' });
  }
  const merged = { ...serializeProduct(existing), ...req.body };
  const v = validateProduct(merged);
  if (!v.ok) return res.status(400).json({ error: v.error });
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== v.value.artisan_id) {
    return res.status(403).json({ error: 'You cannot transfer a product to another artisan profile' });
  }
  if (!db.prepare('SELECT id FROM artisans WHERE id = ?').get(v.value.artisan_id)) return res.status(400).json({ error: 'Artisan does not exist' });

  const privileged = isPrivilegedRequest(req);
  const nextStatus = privileged && existing.status === 'verified' ? 'verified' : 'pending';
  const nextVerification = nextStatus === 'verified' ? 'verified' : 'pending';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      UPDATE products SET artisan_id = ?, title = ?, description = ?, image = ?, steps = ?, materials = ?,
        price = ?, category = ?, status = ?, verification_status = ?, rejection_reason = '' WHERE id = ?
    `).run(v.value.artisan_id, v.value.title, v.value.description, v.value.image, JSON.stringify(v.value.steps), JSON.stringify(v.value.materials), v.value.price, v.value.category, nextStatus, nextVerification, existing.id);
    appendRevision(existing.id, { action: existing.status === 'verified' ? 'corrected' : 'updated', reason: correctionReason || (privileged ? 'Privileged registry correction' : 'Artisan updated draft'), actorUserId: req.user?.user_id || null, actorRole: req.user?.role || 'api_key' });
    audit(req, { action: existing.status === 'verified' ? 'product.corrected' : 'product.updated', entityType: 'product', entityId: existing.id, metadata: { reason: correctionReason, status: nextStatus } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  res.json({ ...serializeProduct(row), verify: verifyProductRevision(existing.id) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id.toUpperCase());
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  if (!canManage(req, existing)) return res.status(403).json({ error: 'You can only archive products linked to your artisan profile' });
  if (existing.status === 'verified' && !isPrivilegedRequest(req)) return res.status(403).json({ error: 'Only an administrator can archive a verified record' });
  const reason = String(req.body?.reason || 'Archived by registry operator').slice(0, 300);
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("UPDATE products SET status = 'archived', verification_status = 'unverified', archived_at = ? WHERE id = ?").run(now, existing.id);
    appendRevision(existing.id, { action: 'archived', reason, actorUserId: req.user?.user_id || null, actorRole: req.user?.role || 'api_key' });
    audit(req, { action: 'product.archived', entityType: 'product', entityId: existing.id, metadata: { reason } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ ok: true, archived: existing.id, deleted: existing.id });
});

export default router;
