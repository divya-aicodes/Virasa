import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const backup = process.argv[2];
if (!backup) throw new Error('Usage: npm run backup:test -- <path-to-backup.db.gz>');

function resolveBackupPath(value) {
  const fromCurrentDirectory = path.resolve(value);
  if (existsSync(fromCurrentDirectory)) return fromCurrentDirectory;

  const fromRepositoryRoot = path.resolve(process.cwd(), '..', value);
  if (existsSync(fromRepositoryRoot)) return fromRepositoryRoot;

  throw new Error(`Backup file not found: ${value}`);
}

const source = resolveBackupPath(backup);
const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'virasa-restore-'));
const restored = path.join(tempDir, 'restored.db');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function canonical(row) {
  return JSON.stringify({ productId: row.product_id, revisionNo: row.revision_no, action: row.action, snapshot: row.snapshot, reason: row.reason, actorUserId: row.actor_user_id, actorRole: row.actor_role, createdAt: row.created_at });
}

try {
  await pipeline(createReadStream(source), createGunzip(), createWriteStream(restored, { flags: 'wx' }));
  const db = new DatabaseSync(restored, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
    const required = ['users', 'artisans', 'products', 'product_revisions', 'audit_log'];
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    for (const table of required) if (!tables.has(table)) throw new Error(`Required table missing: ${table}`);

    let previous = 'GENESIS';
    const revisions = db.prepare('SELECT * FROM product_revisions ORDER BY id ASC').all();
    for (const row of revisions) {
      if (row.prev_hash !== previous) throw new Error(`Revision ${row.id} has a broken previous hash`);
      if (sha256(`${canonical(row)}|${row.prev_hash}`) !== row.hash) throw new Error(`Revision ${row.id} hash is invalid`);
      previous = row.hash;
    }
    console.log(JSON.stringify({ ok: true, backup: source, integrity, revisions: revisions.length }));
  } finally { db.close(); }
} finally {
  await fsp.rm(tempDir, { recursive: true, force: true });
}
