import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Vercel Functions have an ephemeral, writable /tmp directory. The hosted
// prototype therefore gets an isolated seeded database per warm function
// instance. Durable production deployments must use the persistent-volume
// architecture documented in docs/production-deployment.md.
const runtimeDir = path.join(os.tmpdir(), 'virasa-vercel');
const databasePath = path.join(runtimeDir, 'virasa.db');
const uploadPath = path.join(runtimeDir, 'uploads');

fs.mkdirSync(uploadPath, { recursive: true });
process.env.DB_PATH = databasePath;
process.env.UPLOAD_DIR = uploadPath;
process.env.STORAGE_DRIVER ||= 'local';
process.env.VERCEL_DEMO_MODE = 'true';

const publicHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (publicHost) {
  const publicUrl = `https://${publicHost}`;
  process.env.BASE_URL ||= publicUrl;
  process.env.ALLOWED_ORIGINS ||= publicUrl;
}

if (!fs.existsSync(databasePath)) {
  const requestedEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  await import('../server/seed.js');
  process.env.NODE_ENV = requestedEnvironment || 'production';
}

const { default: app } = await import('../server/app.js');

export default app;
