import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';

const runtimeDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'virasa-e2e-'));
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3101';
process.env.DB_PATH = path.join(runtimeDir, 'e2e.db');
process.env.UPLOAD_DIR = path.join(runtimeDir, 'uploads');
process.env.BASE_URL = `http://127.0.0.1:${process.env.PORT}`;
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5174';

await import('./seed.js');
const { default: app } = await import('./app.js');
const server = app.listen(Number(process.env.PORT), '127.0.0.1', () => {
  console.log(`Virasā E2E API on http://127.0.0.1:${process.env.PORT}`);
});

async function shutdown() {
  server.close();
  server.closeAllConnections?.();
  await fsp.rm(runtimeDir, { recursive: true, force: true });
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
