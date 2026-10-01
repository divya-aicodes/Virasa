import db from '../db.js';
import { sha256, buildCanonical } from './canonical.js';

function lastBlock() {
  const row = db.prepare(
    'SELECT * FROM products ORDER BY chain_index DESC LIMIT 1'
  ).get();
  return row || null;
}

export function chainLength() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  return row ? row.n : 0;
}

export function makeHash(productRow) {
  const canonical = buildCanonical(productRow);
  const prev = lastBlock();
  const prevHash = prev ? prev.hash : 'GENESIS';
  const hash = sha256(canonical + '|' + prevHash);
  return { hash, prevHash };
}

function verifyRows(rows) {
  const errors = [];
  let expectedPrevHash = 'GENESIS';

  rows.forEach((row, offset) => {
    const expectedIndex = offset + 1;
    if (row.chain_index !== expectedIndex) {
      errors.push({ id: row.id, code: 'INDEX_GAP', expected: expectedIndex, actual: row.chain_index });
    }
    if (row.prev_hash !== expectedPrevHash) {
      errors.push({ id: row.id, code: 'PREVIOUS_HASH_MISMATCH', index: row.chain_index });
    }
    const recomputed = sha256(buildCanonical(row) + '|' + row.prev_hash);
    if (recomputed !== row.hash) {
      errors.push({ id: row.id, code: 'HASH_MISMATCH', index: row.chain_index });
    }
    expectedPrevHash = row.hash;
  });

  return { valid: errors.length === 0, length: rows.length, errors };
}

export function verifyChain(throughIndex = null) {
  const rows = throughIndex === null
    ? db.prepare('SELECT * FROM products ORDER BY chain_index ASC').all()
    : db.prepare('SELECT * FROM products WHERE chain_index <= ? ORDER BY chain_index ASC').all(throughIndex);
  return verifyRows(rows);
}

export function verifyProduct(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) return { valid: false, reason: 'Product not found' };

  const recomputed = sha256(buildCanonical(row) + '|' + row.prev_hash);
  const prefix = verifyChain(row.chain_index);
  const chainLink = !prefix.errors.some((error) => error.id === row.id && error.code === 'PREVIOUS_HASH_MISMATCH');

  return {
    valid: recomputed === row.hash && prefix.valid,
    hash: row.hash,
    prevHash: row.prev_hash,
    chainIndex: row.chain_index,
    chainLength: chainLength(),
    recomputed,
    chainLink,
    chainValid: prefix.valid,
    errors: prefix.errors,
  };
}

export function fullChain() {
  return db.prepare('SELECT id, title, hash, prev_hash, chain_index FROM products ORDER BY chain_index ASC').all();
}

// Re-link and re-hash every block from `startIndex` onward (inclusive), keeping
// their existing chain_index values. Used after a product is updated so the
// ledger stays internally consistent.
export function rebuildChainFrom(startIndex) {
  const rows = db.prepare('SELECT * FROM products ORDER BY chain_index ASC').all();
  const first = rows.find((r) => r.chain_index === startIndex);
  if (!first) return 0;
  let prevHash = startIndex === 1 ? 'GENESIS' : rows[startIndex - 2].hash;
  const updateHash = db.prepare('UPDATE products SET hash = ?, prev_hash = ? WHERE id = ?');
  let count = 0;
  for (let i = startIndex - 1; i < rows.length; i++) {
    const row = rows[i];
    const hash = sha256(buildCanonical(row) + '|' + prevHash);
    updateHash.run(hash, prevHash, row.id);
    prevHash = hash;
    count++;
  }
  return count;
}

// Renumber all blocks contiguously from 1 and re-link every hash. Used after a
// block is deleted so the ledger has no gaps and every link remains valid.
export function compactChain() {
  const rows = db.prepare('SELECT * FROM products ORDER BY chain_index ASC').all();
  const updateIndex = db.prepare('UPDATE products SET chain_index = ? WHERE id = ?');
  const updateHash = db.prepare('UPDATE products SET hash = ?, prev_hash = ? WHERE id = ?');
  let prevHash = 'GENESIS';
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    updateIndex.run(i + 1, row.id);
    const hash = sha256(buildCanonical(row) + '|' + prevHash);
    updateHash.run(hash, prevHash, row.id);
    prevHash = hash;
    count++;
  }
  return count;
}
