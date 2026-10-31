import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || 'kalachain.db');
export const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || 'uploads');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS artisans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    village TEXT NOT NULL,
    craft TEXT NOT NULL,
    state TEXT DEFAULT '',
    district TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    photo TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    artisan_id TEXT NOT NULL REFERENCES artisans(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    steps TEXT DEFAULT '[]',
    materials TEXT DEFAULT '[]',
    price REAL DEFAULT 0,
    category TEXT DEFAULT '',
    hash TEXT NOT NULL,
    prev_hash TEXT DEFAULT '',
    chain_index INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_artisan ON products(artisan_id);
  CREATE INDEX IF NOT EXISTS idx_products_chain ON products(chain_index);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_products_chain_unique ON products(chain_index);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'artisan' CHECK (role IN ('artisan', 'admin')),
    artisan_id TEXT REFERENCES artisans(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS product_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL REFERENCES products(id),
    revision_no INTEGER NOT NULL,
    action TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    reason TEXT DEFAULT '',
    actor_user_id TEXT REFERENCES users(id),
    actor_role TEXT DEFAULT 'system',
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    UNIQUE(product_id, revision_no)
  );

  CREATE INDEX IF NOT EXISTS idx_revisions_product ON product_revisions(product_id, revision_no);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id TEXT REFERENCES users(id),
    actor_role TEXT DEFAULT 'system',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

  CREATE TABLE IF NOT EXISTS artisan_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artisan_id TEXT NOT NULL REFERENCES artisans(id),
    user_id TEXT REFERENCES users(id),
    consent_type TEXT NOT NULL CHECK (consent_type IN ('public_profile', 'location', 'media', 'certificate')),
    granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_consents_artisan ON artisan_consents(artisan_id, consent_type, id DESC);

  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT REFERENCES users(id),
    product_id TEXT REFERENCES products(id),
    url TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    alt_text TEXT DEFAULT '',
    consent_status TEXT NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending', 'granted', 'revoked')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TEXT NOT NULL,
    archived_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_media_owner ON media_assets(owner_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_media_product ON media_assets(product_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS evidence_items (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    media_id TEXT REFERENCES media_assets(id),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('primary', 'process', 'document', 'other')),
    url TEXT NOT NULL,
    mime_type TEXT DEFAULT '',
    sha256 TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_by TEXT REFERENCES users(id),
    verified_at TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    archived_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_product ON evidence_items(product_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    opened_by_user_id TEXT REFERENCES users(id),
    reporter_name TEXT NOT NULL,
    reporter_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
    resolution TEXT DEFAULT '',
    assigned_to TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_disputes_product ON disputes(product_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at DESC);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('products', 'status', "TEXT NOT NULL DEFAULT 'verified'");
ensureColumn('products', 'verification_status', "TEXT NOT NULL DEFAULT 'verified'");
ensureColumn('products', 'owner_user_id', 'TEXT REFERENCES users(id)');
ensureColumn('products', 'owner_approved', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('products', 'approved_by', 'TEXT REFERENCES users(id)');
ensureColumn('products', 'approved_at', 'TEXT');
ensureColumn('products', 'rejection_reason', "TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'latest_revision', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('products', 'archived_at', 'TEXT');
ensureColumn('artisans', 'status', "TEXT NOT NULL DEFAULT 'active'");
ensureColumn('artisans', 'archived_at', 'TEXT');
ensureColumn('artisans', 'pehchan_id', "TEXT NOT NULL DEFAULT ''");
ensureColumn('artisans', 'pehchan_verification_status', "TEXT NOT NULL DEFAULT 'verified'");
ensureColumn('artisans', 'pehchan_submitted_at', 'TEXT');
ensureColumn('artisans', 'pehchan_verified_at', 'TEXT');
ensureColumn('artisans', 'pehchan_verified_by', 'TEXT REFERENCES users(id)');
ensureColumn('artisans', 'pehchan_rejection_reason', "TEXT NOT NULL DEFAULT ''");
ensureColumn('artisans', 'pehchan_verification_method', "TEXT NOT NULL DEFAULT 'legacy_migration'");
ensureColumn('artisans', 'pehchan_review_note', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'email_verified_at', 'TEXT');
ensureColumn('users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'mfa_secret_encrypted', 'TEXT');
ensureColumn('sessions', 'mfa_verified', 'INTEGER NOT NULL DEFAULT 0');

db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_artisans_pehchan_unique ON artisans(pehchan_id) WHERE pehchan_id <> ''");

db.exec('CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
if (!db.prepare("SELECT value FROM schema_meta WHERE key = 'legacy_email_verification_migrated'").get()) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("UPDATE users SET email_verified = 1, email_verified_at = COALESCE(email_verified_at, created_at)").run();
    db.prepare("INSERT INTO schema_meta (key, value) VALUES ('legacy_email_verification_migrated', ?)").run(new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset', 'mfa_login', 'mfa_setup')),
    token_hash TEXT NOT NULL UNIQUE,
    metadata TEXT DEFAULT '{}',
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose, created_at DESC);

  CREATE TABLE IF NOT EXISTS email_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    text_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    provider_id TEXT DEFAULT '',
    error TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    sent_at TEXT
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS product_search USING fts5(
    product_id UNINDEXED,
    title,
    description,
    materials,
    category,
    artisan_name,
    artisan_village,
    tokenize = 'unicode61 remove_diacritics 2'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS artisan_search USING fts5(
    artisan_id UNINDEXED,
    name,
    village,
    craft,
    state,
    district,
    bio,
    tokenize = 'unicode61 remove_diacritics 2'
  );

  CREATE TRIGGER IF NOT EXISTS products_search_insert AFTER INSERT ON products BEGIN
    INSERT INTO product_search(product_id, title, description, materials, category, artisan_name, artisan_village)
    SELECT NEW.id, NEW.title, NEW.description, NEW.materials, NEW.category, a.name, a.village
    FROM artisans a WHERE a.id = NEW.artisan_id;
  END;

  CREATE TRIGGER IF NOT EXISTS products_search_update AFTER UPDATE ON products BEGIN
    DELETE FROM product_search WHERE product_id = OLD.id;
    INSERT INTO product_search(product_id, title, description, materials, category, artisan_name, artisan_village)
    SELECT NEW.id, NEW.title, NEW.description, NEW.materials, NEW.category, a.name, a.village
    FROM artisans a WHERE a.id = NEW.artisan_id;
  END;

  CREATE TRIGGER IF NOT EXISTS products_search_delete AFTER DELETE ON products BEGIN
    DELETE FROM product_search WHERE product_id = OLD.id;
  END;

  CREATE TRIGGER IF NOT EXISTS artisans_search_insert AFTER INSERT ON artisans BEGIN
    INSERT INTO artisan_search(artisan_id, name, village, craft, state, district, bio)
    VALUES (NEW.id, NEW.name, NEW.village, NEW.craft, NEW.state, NEW.district, NEW.bio);
  END;

  CREATE TRIGGER IF NOT EXISTS artisans_search_update AFTER UPDATE ON artisans BEGIN
    DELETE FROM artisan_search WHERE artisan_id = OLD.id;
    INSERT INTO artisan_search(artisan_id, name, village, craft, state, district, bio)
    VALUES (NEW.id, NEW.name, NEW.village, NEW.craft, NEW.state, NEW.district, NEW.bio);
    DELETE FROM product_search WHERE product_id IN (SELECT id FROM products WHERE artisan_id = NEW.id);
    INSERT INTO product_search(product_id, title, description, materials, category, artisan_name, artisan_village)
    SELECT p.id, p.title, p.description, p.materials, p.category, NEW.name, NEW.village
    FROM products p WHERE p.artisan_id = NEW.id;
  END;

  CREATE TRIGGER IF NOT EXISTS artisans_search_delete AFTER DELETE ON artisans BEGIN
    DELETE FROM artisan_search WHERE artisan_id = OLD.id;
  END;
`);

// Rebuild lightweight FTS projections on startup so upgrades and legacy rows
// are searchable immediately. Runtime changes remain synchronized by triggers.
db.exec(`
  DELETE FROM product_search;
  INSERT INTO product_search(product_id, title, description, materials, category, artisan_name, artisan_village)
  SELECT p.id, p.title, p.description, p.materials, p.category, a.name, a.village
  FROM products p JOIN artisans a ON a.id = p.artisan_id;
  DELETE FROM artisan_search;
  INSERT INTO artisan_search(artisan_id, name, village, craft, state, district, bio)
  SELECT id, name, village, craft, state, district, bio FROM artisans;
`);

// Existing public demo data predates consent tracking. Preserve its existing
// visibility by recording an explicit legacy grant for each public purpose.
const consentCount = db.prepare('SELECT COUNT(*) AS n FROM artisan_consents').get().n;
if (consentCount === 0) {
  const now = new Date().toISOString();
  const insertConsent = db.prepare(`
    INSERT INTO artisan_consents (artisan_id, consent_type, granted, note, created_at)
    VALUES (?, ?, 1, 'Legacy public record migrated with existing visibility', ?)
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const artisan of db.prepare('SELECT id FROM artisans').all()) {
      for (const type of ['public_profile', 'location', 'media', 'certificate']) {
        insertConsent.run(artisan.id, type, now);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Bootstrap an immutable revision ledger from the original product chain.
// Future changes append rows; existing ledger rows are never rewritten.
const revisionCount = db.prepare('SELECT COUNT(*) AS n FROM product_revisions').get().n;
if (revisionCount === 0) {
  const products = db.prepare('SELECT * FROM products ORDER BY chain_index ASC').all();
  const insertRevision = db.prepare(`
    INSERT INTO product_revisions
      (product_id, revision_no, action, snapshot, reason, actor_role, prev_hash, hash, created_at)
    VALUES (?, 1, 'created', ?, 'Legacy record imported', 'system', ?, ?, ?)
  `);
  const updateProduct = db.prepare(`
    UPDATE products
    SET hash = ?, prev_hash = ?, chain_index = ?, latest_revision = 1,
        status = 'verified', verification_status = 'verified', owner_approved = 1,
        approved_at = COALESCE(approved_at, created_at)
    WHERE id = ?
  `);
  let previous = 'GENESIS';
  db.exec('BEGIN IMMEDIATE');
  try {
    products.forEach((product, index) => {
      const snapshot = JSON.stringify({
        id: product.id,
        artisan_id: product.artisan_id,
        title: product.title,
        description: product.description,
        image: product.image,
        steps: product.steps,
        materials: product.materials,
        price: product.price,
        category: product.category,
        status: 'verified',
        verification_status: 'verified',
        owner_approved: 1,
        created_at: product.created_at,
      });
      const createdAt = product.created_at || new Date().toISOString();
      const hash = crypto.createHash('sha256')
        .update(JSON.stringify({ productId: product.id, revisionNo: 1, action: 'created', snapshot, reason: 'Legacy record imported', actorUserId: null, actorRole: 'system', createdAt }) + `|${previous}`)
        .digest('hex');
      insertRevision.run(product.id, snapshot, previous, hash, createdAt);
      updateProduct.run(hash, previous, index + 1, product.id);
      previous = hash;
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export default db;
