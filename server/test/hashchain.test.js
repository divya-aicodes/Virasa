import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate from the app database: point DB_PATH at a throwaway file before
// importing the modules so chain mutation tests never touch real data.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'virasa-chain-'));
process.env.DB_PATH = path.join(dir, 'test.db');

const { default: db } = await import('../db.js');
const { verifyProduct, verifyChain, fullChain, chainLength } = await import('../lib/hashchain.js');
await import('../seed.js');

test('seed creates a non-empty chain', () => {
  assert.ok(chainLength() >= 1);
});

test('every product verifies as valid', () => {
  const ids = db.prepare('SELECT id FROM products').all();
  for (const { id } of ids) {
    const v = verifyProduct(id);
    assert.equal(v.valid, true, `${id} should verify`);
    assert.equal(v.recomputed, v.hash);
  }
});

test('full-chain verification checks the complete contiguous chain', () => {
  const result = verifyChain();
  assert.equal(result.valid, true);
  assert.equal(result.length, chainLength());
  assert.deepEqual(result.errors, []);
});

test('every block links to the previous hash (GENESIS first)', () => {
  const rows = db.prepare('SELECT * FROM products ORDER BY chain_index ASC').all();
  let prev = 'GENESIS';
  for (const row of rows) {
    assert.equal(row.prev_hash, prev, `block ${row.chain_index} prev mismatch`);
    prev = row.hash;
  }
});

test('chain_index is contiguous from 1', () => {
  const rows = db.prepare('SELECT chain_index FROM products ORDER BY chain_index ASC').all();
  rows.forEach((row, i) => assert.equal(row.chain_index, i + 1));
});

test('tampering with a record breaks its verification', () => {
  const victim = db.prepare('SELECT id, title FROM products ORDER BY chain_index ASC LIMIT 1').get();
  db.prepare('UPDATE products SET title = ? WHERE id = ?').run(`${victim.title} altered`, victim.id);
  const v = verifyProduct(victim.id);
  assert.equal(v.valid, false);
});

test('tampering breaks the chain link of the next block', () => {
  const victim = db.prepare('SELECT * FROM products ORDER BY chain_index ASC LIMIT 1').get();
  const next = db.prepare('SELECT * FROM products WHERE chain_index = ?').get(victim.chain_index + 1);
  assert.equal(next.prev_hash, victim.hash, 'control: next block references victim hash');
});

test('fullChain returns ordered blocks', () => {
  const chain = fullChain();
  assert.equal(chain.length, chainLength());
  assert.equal(chain[0].chain_index, 1);
  assert.ok(chain[0].hash);
});

test('unknown product does not verify', () => {
  const v = verifyProduct('DOES-NOT-EXIST');
  assert.equal(v.valid, false);
});
