import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { normalizePehchanId, validateArtisan } from '../lib/validate.js';
import { currentUser, hasAdminAccess, isPrivilegedRequest } from '../lib/auth.js';
import { consentSnapshot, publicArtisan, recordConsents } from '../lib/privacy.js';
import { audit } from '../lib/audit.js';
import { ftsQuery } from '../lib/search.js';

const router = Router();

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function listQuery({ q, craft, state }, user) {
  const where = ["status = 'active'"];
  const params = [];
  if (!hasAdminAccess(user)) {
    if (user?.artisan_id) {
      where.push('(pehchan_verification_status = ? OR id = ?)');
      params.push('verified', user.artisan_id);
    } else {
      where.push("pehchan_verification_status = 'verified'");
    }
  }
  let relevance = '';
  const relevanceParams = [];
  if (q && String(q).trim()) {
    const match = ftsQuery(q);
    if (match) {
      where.push('id IN (SELECT artisan_id FROM artisan_search WHERE artisan_search MATCH ?)');
      params.push(match);
      relevance = 'COALESCE((SELECT bm25(artisan_search) FROM artisan_search WHERE artisan_search MATCH ? AND artisan_id = artisans.id), 999999), ';
      relevanceParams.push(match);
    }
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
    order: `${relevance}created_at ASC`,
    relevanceParams,
  };
}

router.get('/', (req, res) => {
  const { q, craft, state, page, limit } = req.query;
  const user = currentUser(req);
  const { where, params, order, relevanceParams } = listQuery({ q, craft, state }, user);

  const wantsPagination = page !== undefined || limit !== undefined;
  if (!wantsPagination) {
    const rows = db.prepare(`SELECT * FROM artisans ${where} ORDER BY ${order}`).all(...params, ...relevanceParams);
    return res.json(rows.map((row) => (hasAdminAccess(user) || user?.artisan_id === row.id ? { ...row, consent: consentSnapshot(row.id) } : publicArtisan(row))));
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM artisans ${where}`).get(...params).n;
  const rows = db.prepare(`SELECT * FROM artisans ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, ...relevanceParams, limitNum, offset);

  res.json({
    data: rows.map((row) => {
      return hasAdminAccess(user) || user?.artisan_id === row.id ? { ...row, consent: consentSnapshot(row.id) } : publicArtisan(row);
    }),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM artisans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Artisan not found' });
  const user = currentUser(req);
  if (row.pehchan_verification_status !== 'verified' && !hasAdminAccess(user) && user?.artisan_id !== row.id) {
    return res.status(404).json({ error: 'Artisan not found' });
  }
  res.json(hasAdminAccess(user) || user?.artisan_id === row.id ? { ...row, consent: consentSnapshot(row.id) } : publicArtisan(row));
});

router.post('/:id/pehchan/verify', (req, res) => {
  if (!hasAdminAccess(req.user)) return res.status(403).json({ error: 'Administrator access required' });
  const artisan = db.prepare('SELECT * FROM artisans WHERE id = ?').get(req.params.id);
  if (!artisan) return res.status(404).json({ error: 'Artisan not found' });
  if (!artisan.pehchan_id) return res.status(409).json({ error: 'A PEHCHAN ID is required before verification' });
  const note = String(req.body?.note || 'Matched against the official Handicrafts artisan database').trim().slice(0, 500);
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE artisans SET pehchan_verification_status = 'verified', pehchan_verified_at = ?,
      pehchan_verified_by = ?, pehchan_rejection_reason = '', pehchan_review_note = ?,
      pehchan_verification_method = 'manual_official_portal_review'
    WHERE id = ?
  `).run(now, req.user.user_id, note, artisan.id);
  audit(req, { action: 'artisan.pehchan_verified', entityType: 'artisan', entityId: artisan.id, metadata: { method: 'manual_official_portal_review' } });
  res.json(db.prepare('SELECT * FROM artisans WHERE id = ?').get(artisan.id));
});

router.post('/:id/pehchan/reject', (req, res) => {
  if (!hasAdminAccess(req.user)) return res.status(403).json({ error: 'Administrator access required' });
  const artisan = db.prepare('SELECT * FROM artisans WHERE id = ?').get(req.params.id);
  if (!artisan) return res.status(404).json({ error: 'Artisan not found' });
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'A rejection reason of 5–500 characters is required' });
  db.prepare(`
    UPDATE artisans SET pehchan_verification_status = 'rejected', pehchan_verified_at = NULL,
      pehchan_verified_by = NULL, pehchan_rejection_reason = ?, pehchan_review_note = '',
      pehchan_verification_method = 'manual_official_portal_review'
    WHERE id = ?
  `).run(reason, artisan.id);
  audit(req, { action: 'artisan.pehchan_rejected', entityType: 'artisan', entityId: artisan.id, metadata: { reason } });
  res.json(db.prepare('SELECT * FROM artisans WHERE id = ?').get(artisan.id));
});

router.get('/:id/consents', (req, res) => {
  const artisan = db.prepare('SELECT id FROM artisans WHERE id = ?').get(req.params.id);
  if (!artisan) return res.status(404).json({ error: 'Artisan not found' });
  const user = currentUser(req);
  if (!user || (!hasAdminAccess(user) && user.artisan_id !== artisan.id)) {
    return res.status(403).json({ error: 'Only the artisan or an administrator can view consent settings' });
  }
  res.json({ artisanId: artisan.id, consents: consentSnapshot(artisan.id) });
});

router.post('/:id/consents', (req, res) => {
  const artisan = db.prepare('SELECT id FROM artisans WHERE id = ?').get(req.params.id);
  if (!artisan) return res.status(404).json({ error: 'Artisan not found' });
  if (!isPrivilegedRequest(req) && req.user?.artisan_id !== artisan.id) {
    return res.status(403).json({ error: 'You can only change consent for your own artisan profile' });
  }
  const consents = recordConsents(artisan.id, req.user?.user_id || null, req.body?.consents || {}, req.body?.note || 'Consent preferences updated');
  audit(req, { action: 'artisan.consent_updated', entityType: 'artisan', entityId: artisan.id, metadata: { consents } });
  res.json({ artisanId: artisan.id, consents });
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
  const { name, village, craft, state, district, bio, photo, pehchanId } = v.value;
  if (pehchanId && db.prepare('SELECT id FROM artisans WHERE pehchan_id = ?').get(pehchanId)) {
    return res.status(409).json({ error: 'This PEHCHAN ID is already registered' });
  }
  const id = newId('ART');
  const verificationStatus = pehchanId ? 'pending' : 'reverification_required';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO artisans
        (id, name, village, craft, state, district, bio, photo, pehchan_id,
         pehchan_verification_status, pehchan_submitted_at, pehchan_verification_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_official_portal_review')
    `).run(id, name, village, craft, state, district, bio, photo, pehchanId, verificationStatus, new Date().toISOString());
    if (req.user?.role === 'artisan') {
      db.prepare('UPDATE users SET artisan_id = ? WHERE id = ?').run(id, req.user.user_id);
    }
    recordConsents(id, req.user?.user_id || null, req.body?.consents || {}, 'Consent recorded during profile creation');
    audit(req, { action: 'artisan.created', entityType: 'artisan', entityId: id });
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

  const { name, village, craft, state, district, bio, photo, pehchanId } = v.value;
  const pehchanWasSupplied = Object.prototype.hasOwnProperty.call(req.body || {}, 'pehchanId') || Object.prototype.hasOwnProperty.call(req.body || {}, 'pehchan_id');
  const normalizedExisting = normalizePehchanId(existing.pehchan_id);
  const pehchanChanged = pehchanWasSupplied && pehchanId !== normalizedExisting;
  if (pehchanChanged && !hasAdminAccess(req.user)) {
    return res.status(403).json({ error: 'Only an administrator can change a PEHCHAN ID' });
  }
  if (pehchanChanged && pehchanId && db.prepare('SELECT id FROM artisans WHERE pehchan_id = ? AND id <> ?').get(pehchanId, existing.id)) {
    return res.status(409).json({ error: 'This PEHCHAN ID is already registered' });
  }
  const nextPehchanId = pehchanChanged ? pehchanId : normalizedExisting;
  const nextVerificationStatus = pehchanChanged ? (nextPehchanId ? 'pending' : 'reverification_required') : existing.pehchan_verification_status;
  db.prepare(`
    UPDATE artisans SET name = ?, village = ?, craft = ?, state = ?, district = ?, bio = ?, photo = ?,
      pehchan_id = ?, pehchan_verification_status = ?,
      pehchan_submitted_at = CASE WHEN ? THEN ? ELSE pehchan_submitted_at END,
      pehchan_verified_at = CASE WHEN ? THEN NULL ELSE pehchan_verified_at END,
      pehchan_verified_by = CASE WHEN ? THEN NULL ELSE pehchan_verified_by END,
      pehchan_rejection_reason = CASE WHEN ? THEN '' ELSE pehchan_rejection_reason END,
      pehchan_review_note = CASE WHEN ? THEN '' ELSE pehchan_review_note END
    WHERE id = ?
  `).run(
    name, village, craft, state, district, bio, photo, nextPehchanId, nextVerificationStatus,
    pehchanChanged ? 1 : 0, new Date().toISOString(), pehchanChanged ? 1 : 0,
    pehchanChanged ? 1 : 0, pehchanChanged ? 1 : 0, pehchanChanged ? 1 : 0, existing.id,
  );
  audit(req, { action: 'artisan.updated', entityType: 'artisan', entityId: existing.id });
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
    db.prepare("UPDATE artisans SET status = 'archived', archived_at = ? WHERE id = ?").run(new Date().toISOString(), existing.id);
    audit(req, { action: 'artisan.archived', entityType: 'artisan', entityId: existing.id });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ ok: true, deleted: existing.id });
});

export default router;
