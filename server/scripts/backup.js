import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.resolve(serverDir, process.env.DB_PATH || 'kalachain.db');
const backupDir = path.resolve(serverDir, process.env.BACKUP_DIR || 'backups');
const keepDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 30));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshot = path.join(backupDir, `virasa-${stamp}.db`);
const destination = `${snapshot}.gz`;

await fsp.mkdir(backupDir, { recursive: true });
const db = new DatabaseSync(sourcePath, { readOnly: true });
try {
  db.prepare('VACUUM INTO ?').run(snapshot);
} finally {
  db.close();
}
await pipeline(createReadStream(snapshot), createGzip({ level: 9 }), createWriteStream(destination, { flags: 'wx' }));
await fsp.unlink(snapshot);

const cutoff = Date.now() - keepDays * 86_400_000;
for (const entry of await fsp.readdir(backupDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/^virasa-.+\.db\.gz$/.test(entry.name)) continue;
  const fullPath = path.join(backupDir, entry.name);
  const stat = await fsp.stat(fullPath);
  if (stat.mtimeMs < cutoff) await fsp.unlink(fullPath);
}

console.log(JSON.stringify({ ok: true, backup: destination, source: sourcePath, retentionDays: keepDays }));
