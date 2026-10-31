import { sha256 } from './canonical.js';
import db from '../db.js';

const SNAPSHOT_FIELDS = [
  'id', 'artisan_id', 'title', 'description', 'image', 'steps', 'materials',
  'price', 'category', 'status', 'verification_status', 'owner_user_id',
  'owner_approved', 'approved_by', 'approved_at', 'rejection_reason',
  'archived_at', 'created_at',
];

export function productSnapshot(product) {
  const snapshot = {};
  for (const field of SNAPSHOT_FIELDS) snapshot[field] = product[field] ?? null;
  return JSON.stringify(snapshot);
}

function canonicalEntry({ productId, revisionNo, action, snapshot, reason, actorUserId, actorRole, createdAt }) {
  return JSON.stringify({ productId, revisionNo, action, snapshot, reason, actorUserId, actorRole, createdAt });
}

export function appendRevision(productId, { action, reason = '', actorUserId = null, actorRole = 'system' }) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error(`Cannot append revision for missing product ${productId}`);

  const latest = db.prepare('SELECT hash FROM product_revisions ORDER BY id DESC LIMIT 1').get();
  const previous = latest?.hash || 'GENESIS';
  const revisionNo = Number(product.latest_revision || 0) + 1;
  const createdAt = new Date().toISOString();
  const snapshot = productSnapshot(product);
  const hash = sha256(canonicalEntry({
    productId,
    revisionNo,
    action,
    snapshot,
    reason,
    actorUserId,
    actorRole,
    createdAt,
  }) + `|${previous}`);

  const result = db.prepare(`
    INSERT INTO product_revisions
      (product_id, revision_no, action, snapshot, reason, actor_user_id, actor_role, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(productId, revisionNo, action, snapshot, reason, actorUserId, actorRole, previous, hash, createdAt);

  db.prepare(`
    UPDATE products SET hash = ?, prev_hash = ?, chain_index = ?, latest_revision = ? WHERE id = ?
  `).run(hash, previous, Number(result.lastInsertRowid), revisionNo, productId);

  return db.prepare('SELECT * FROM product_revisions WHERE id = ?').get(result.lastInsertRowid);
}

export function revisionHistory(productId) {
  return db.prepare(`
    SELECT id, product_id, revision_no, action, reason, actor_user_id, actor_role,
           prev_hash, hash, created_at
    FROM product_revisions WHERE product_id = ? ORDER BY revision_no DESC
  `).all(productId);
}

export function verifyRevisionChain(throughId = null) {
  const rows = throughId === null
    ? db.prepare('SELECT * FROM product_revisions ORDER BY id ASC').all()
    : db.prepare('SELECT * FROM product_revisions WHERE id <= ? ORDER BY id ASC').all(throughId);
  const errors = [];
  let expectedPrevious = 'GENESIS';

  for (const row of rows) {
    if (row.prev_hash !== expectedPrevious) {
      errors.push({ id: row.id, productId: row.product_id, code: 'PREVIOUS_HASH_MISMATCH' });
    }
    const recomputed = sha256(canonicalEntry({
      productId: row.product_id,
      revisionNo: row.revision_no,
      action: row.action,
      snapshot: row.snapshot,
      reason: row.reason,
      actorUserId: row.actor_user_id,
      actorRole: row.actor_role,
      createdAt: row.created_at,
    }) + `|${row.prev_hash}`);
    if (recomputed !== row.hash) {
      errors.push({ id: row.id, productId: row.product_id, code: 'HASH_MISMATCH' });
    }
    expectedPrevious = row.hash;
  }

  return { valid: errors.length === 0, length: rows.length, errors };
}

export function verifyProductRevision(productId) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return { valid: false, reason: 'Product not found' };
  const revision = db.prepare(`
    SELECT * FROM product_revisions WHERE product_id = ? ORDER BY revision_no DESC LIMIT 1
  `).get(productId);
  if (!revision) return { valid: false, reason: 'No revision history found' };

  const chain = verifyRevisionChain(revision.id);
  const recomputed = sha256(canonicalEntry({
    productId: revision.product_id,
    revisionNo: revision.revision_no,
    action: revision.action,
    snapshot: revision.snapshot,
    reason: revision.reason,
    actorUserId: revision.actor_user_id,
    actorRole: revision.actor_role,
    createdAt: revision.created_at,
  }) + `|${revision.prev_hash}`);
  const projectionMatches = revision.snapshot === productSnapshot(product);
  const publishable = product.status === 'verified' && product.verification_status === 'verified' && !product.archived_at;
  return {
    valid: chain.valid && projectionMatches && publishable,
    ledgerValid: chain.valid,
    projectionMatches,
    publishable,
    status: product.status,
    verificationStatus: product.verification_status,
    hash: revision.hash,
    recomputed,
    prevHash: revision.prev_hash,
    chainLink: !chain.errors.some((error) => error.id === revision.id && error.code === 'PREVIOUS_HASH_MISMATCH'),
    chainIndex: revision.id,
    chainLength: db.prepare('SELECT COUNT(*) AS n FROM product_revisions').get().n,
    revision: revision.revision_no,
    errors: chain.errors,
    reason: !chain.valid
      ? 'Revision ledger integrity check failed'
      : !projectionMatches
        ? 'Current record does not match its latest signed revision'
        : !publishable
          ? `Record is ${product.status}`
          : '',
  };
}

export function fullRevisionChain() {
  return db.prepare(`
    SELECT r.id AS chain_index, r.product_id AS id,
           CASE WHEN p.status = 'verified' THEN p.title ELSE 'Private registry revision' END AS title,
           r.revision_no,
           r.action, r.hash, r.prev_hash, r.created_at
    FROM product_revisions r JOIN products p ON p.id = r.product_id
    ORDER BY r.id ASC
  `).all();
}
