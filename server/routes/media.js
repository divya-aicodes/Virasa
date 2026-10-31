import { Router } from 'express';
import db from '../db.js';
import { currentUser, hasAdminAccess } from '../lib/auth.js';
import { audit } from '../lib/audit.js';

const router = Router();

function scope(req) {
  const user = req.user || currentUser(req);
  if (!user) return null;
  if (user.role === 'admin' && !hasAdminAccess(user)) return { forbidden: true, user };
  return hasAdminAccess(user) ? { user, sql: '', params: [] } : { user, sql: 'WHERE m.owner_user_id = ?', params: [user.user_id] };
}

router.get('/', (req, res) => {
  const access = scope(req);
  if (!access) return res.status(401).json({ error: 'Authentication required' });
  if (access.forbidden) return res.status(403).json({ error: 'Administrator MFA verification required', code: 'MFA_REQUIRED' });
  const rows = db.prepare(`SELECT m.* FROM media_assets m ${access.sql} ORDER BY m.created_at DESC`).all(...access.params);
  res.json({ data: rows, total: rows.length });
});

router.patch('/:id', (req, res) => {
  const access = scope(req);
  if (!access) return res.status(401).json({ error: 'Authentication required' });
  if (access.forbidden) return res.status(403).json({ error: 'Administrator MFA verification required', code: 'MFA_REQUIRED' });
  const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Media asset not found' });
  if (!hasAdminAccess(access.user) && asset.owner_user_id !== access.user.user_id) return res.status(403).json({ error: 'You do not own this media asset' });
  const altText = String(req.body?.altText ?? asset.alt_text).trim().slice(0, 200);
  const consentStatus = String(req.body?.consentStatus || asset.consent_status);
  if (!['pending', 'granted', 'revoked'].includes(consentStatus)) return res.status(400).json({ error: 'Invalid consent status' });
  db.prepare('UPDATE media_assets SET alt_text = ?, consent_status = ? WHERE id = ?').run(altText, consentStatus, asset.id);
  audit(req, { action: 'media.updated', entityType: 'media', entityId: asset.id, metadata: { consentStatus } });
  res.json(db.prepare('SELECT * FROM media_assets WHERE id = ?').get(asset.id));
});

router.delete('/:id', (req, res) => {
  const access = scope(req);
  if (!access) return res.status(401).json({ error: 'Authentication required' });
  if (access.forbidden) return res.status(403).json({ error: 'Administrator MFA verification required', code: 'MFA_REQUIRED' });
  const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Media asset not found' });
  if (!hasAdminAccess(access.user) && asset.owner_user_id !== access.user.user_id) return res.status(403).json({ error: 'You do not own this media asset' });
  if (asset.product_id) return res.status(409).json({ error: 'Linked evidence cannot be archived; submit a correction or dispute instead' });
  db.prepare("UPDATE media_assets SET status = 'archived', archived_at = ? WHERE id = ?").run(new Date().toISOString(), asset.id);
  audit(req, { action: 'media.archived', entityType: 'media', entityId: asset.id });
  res.json({ ok: true, archived: asset.id });
});

export default router;
