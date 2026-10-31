import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { currentUser, hasAdminAccess } from '../lib/auth.js';
import { appendRevision } from '../lib/ledger.js';
import { audit } from '../lib/audit.js';

const router = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', (req, res) => {
  const productId = String(req.body?.productId || '').trim().toUpperCase();
  const reporterName = String(req.body?.reporterName || '').trim();
  const reporterEmail = String(req.body?.reporterEmail || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  const evidenceUrl = String(req.body?.evidenceUrl || '').trim();
  if (!db.prepare("SELECT id FROM products WHERE id = ? AND status != 'archived'").get(productId)) return res.status(404).json({ error: 'Product not found' });
  if (reporterName.length < 2 || reporterName.length > 100) return res.status(400).json({ error: 'Reporter name must be 2–100 characters' });
  if (!EMAIL.test(reporterEmail)) return res.status(400).json({ error: 'A valid contact email is required' });
  if (reason.length < 20 || reason.length > 2000) return res.status(400).json({ error: 'Dispute details must be 20–2000 characters' });
  if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl) && !/^\/uploads\//.test(evidenceUrl)) return res.status(400).json({ error: 'Evidence URL must use HTTPS or an uploaded file' });

  const user = currentUser(req);
  const id = `DSP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO disputes
        (id, product_id, opened_by_user_id, reporter_name, reporter_email, reason, evidence_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, productId, user?.user_id || null, reporterName, reporterEmail, reason, evidenceUrl, now, now);
    db.prepare("UPDATE products SET status = 'disputed', verification_status = 'disputed' WHERE id = ?").run(productId);
    appendRevision(productId, { action: 'disputed', reason: `Dispute ${id} opened`, actorUserId: user?.user_id || null, actorRole: user?.role || 'public' });
    audit({ ...req, user }, { action: 'dispute.opened', entityType: 'dispute', entityId: id, metadata: { productId } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.status(201).json({ id, productId, status: 'open', createdAt: now });
});

router.get('/', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.role === 'admin' && !hasAdminAccess(user)) {
    return res.status(403).json({ error: 'Administrator MFA verification required', code: 'MFA_REQUIRED' });
  }
  const params = [];
  let where = '';
  if (!hasAdminAccess(user)) {
    if (!user.artisan_id) return res.json({ data: [], total: 0 });
    where = 'WHERE p.artisan_id = ?';
    params.push(user.artisan_id);
  }
  const rows = db.prepare(`
    SELECT d.*, p.title AS product_title, p.artisan_id
    FROM disputes d JOIN products p ON p.id = d.product_id
    ${where} ORDER BY d.created_at DESC
  `).all(...params);
  res.json({ data: rows, total: rows.length });
});

router.patch('/:id', (req, res) => {
  const user = currentUser(req);
  if (!hasAdminAccess(user)) return res.status(403).json({ error: 'Administrator access required' });
  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  const status = String(req.body?.status || '');
  const resolution = String(req.body?.resolution || '').trim();
  if (!['under_review', 'resolved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid dispute status' });
  if (['resolved', 'rejected'].includes(status) && (resolution.length < 10 || resolution.length > 1000)) return res.status(400).json({ error: 'A resolution of 10–1000 characters is required' });
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      UPDATE disputes SET status = ?, resolution = ?, assigned_to = ?, updated_at = ?, resolved_at = ? WHERE id = ?
    `).run(status, resolution, user.user_id, now, ['resolved', 'rejected'].includes(status) ? now : null, dispute.id);
    if (status === 'rejected') {
      db.prepare("UPDATE products SET status = 'verified', verification_status = 'verified' WHERE id = ?").run(dispute.product_id);
    } else if (status === 'resolved') {
      db.prepare("UPDATE products SET status = 'pending', verification_status = 'pending' WHERE id = ?").run(dispute.product_id);
    }
    appendRevision(dispute.product_id, { action: `dispute_${status}`, reason: resolution || `Dispute ${status}`, actorUserId: user.user_id, actorRole: user.role });
    audit({ ...req, user }, { action: `dispute.${status}`, entityType: 'dispute', entityId: dispute.id, metadata: { productId: dispute.product_id, resolution } });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json(db.prepare('SELECT * FROM disputes WHERE id = ?').get(dispute.id));
});

export default router;
