import { Router } from 'express';
import db from '../db.js';
import { currentUser, hasAdminAccess } from '../lib/auth.js';
import { parseAuditRow } from '../lib/audit.js';

const router = Router();

router.get('/', (req, res) => {
  const user = currentUser(req);
  if (!hasAdminAccess(user)) return res.status(403).json({ error: 'Administrator access required' });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = db.prepare(`
    SELECT a.*, u.name AS actor_name
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
    ORDER BY a.id DESC LIMIT ?
  `).all(limit).map(parseAuditRow);
  res.json({ data: rows, total: db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n });
});

export default router;
