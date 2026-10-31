import db from '../db.js';

export function audit(req, { action, entityType, entityId, metadata = {} }) {
  const actor = req?.user || null;
  db.prepare(`
    INSERT INTO audit_log
      (actor_user_id, actor_role, action, entity_type, entity_id, metadata, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actor?.user_id || null,
    actor?.role || (req?.apiKeyAuthenticated ? 'api_key' : 'system'),
    action,
    entityType,
    entityId,
    JSON.stringify(metadata || {}),
    String(req?.ip || '').slice(0, 80),
    new Date().toISOString(),
  );
}

export function parseAuditRow(row) {
  if (!row) return row;
  let metadata = {};
  try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
  return { ...row, metadata };
}
