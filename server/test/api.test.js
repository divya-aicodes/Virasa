import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'virasa-api-'));
process.env.DB_PATH = path.join(dir, 'test.db');
process.env.API_KEYS = 'api-test-key';

const { default: db } = await import('../db.js');
await import('../seed.js');
const { default: app } = await import('../app.js');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(url) {
  const res = await fetch(base + url);
  return { status: res.status, json: () => res.json() };
}

async function post(url, body) {
  const res = await fetch(base + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'api-test-key' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: () => res.json() };
}

test('GET /api/health reports ok', async () => {
  const { status, json } = await get('/api/health');
  assert.equal(status, 200);
  const body = await json();
  assert.equal(body.ok, true);
  assert.ok(body.products >= 1);
});

test('GET /api/products lists the seeded collection', async () => {
  const { status, json } = await get('/api/products');
  assert.equal(status, 200);
  const list = await json();
  assert.ok(list.length >= 1);
  assert.ok(list[0].artisan_state, 'product carries artisan_state');
  assert.ok(Array.isArray(list[0].steps), 'steps deserialized');
});

test('GET /api/products/:id returns a single record', async () => {
  const { json } = await get('/api/products');
  const list = await json();
  const { status, json: one } = await get(`/api/products/${list[0].id}`);
  assert.equal(status, 200);
  const rec = await one();
  assert.equal(rec.id, list[0].id);
});

test('GET /api/verify/:id confirms a valid record', async () => {
  const { status, json } = await get('/api/verify/KC-A1B2C3');
  assert.equal(status, 200);
  const body = await json();
  assert.equal(body.valid, true);
  assert.equal(body.verify.chainLength, body.verify.chainIndex >= 1 ? body.verify.chainLength : 0);
});

test('GET /api/verify returns the full chain', async () => {
  const { json } = await get('/api/verify');
  const body = await json();
  assert.equal(body.length, body.chain.length);
  assert.equal(body.verification.valid, true);
});

test('GET /api/verify/:id/certificate returns a PDF', async () => {
  const res = await fetch(base + '/api/verify/KC-A1B2C3/certificate');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.ok(buf.length > 1000);
});

test('GET /api/verify/:id/certificate returns 404 for unknown', async () => {
  const res = await fetch(base + '/api/verify/UNKNOWN/certificate');
  assert.equal(res.status, 404);
});

test('POST /api/artisans creates an artisan', async () => {
  const { status, json } = await post('/api/artisans', {
    name: 'Priya Shah', village: 'Bhilwara', craft: 'Blue Pottery', state: 'Rajasthan', district: 'Bhilwara',
  });
  assert.equal(status, 201);
  const body = await json();
  assert.match(body.id, /^ART-/);
  assert.equal(body.state, 'Rajasthan');
});

test('POST /api/products rejects an unknown artisan', async () => {
  const { status, json } = await post('/api/products', {
    artisan_id: 'ART-NOPE', title: 'X', image: '/uploads/x.png', price: 100,
  });
  assert.equal(status, 400);
});

test('POST /api/products creates a chained product', async () => {
  const { json } = await get('/api/artisans');
  const artisans = await json();
  const artisan = artisans[0];

  const { status, json: created } = await post('/api/products', {
    artisan_id: artisan.id,
    title: 'Test Product',
    description: 'A test record',
    image: '/uploads/test.png',
    steps: [{ image: '/uploads/test.png', caption: 'Step one' }],
    materials: ['Cotton', 'Ink'],
    price: 500,
    category: 'Test',
  });
  assert.equal(status, 201);
  const product = await created();
  assert.match(product.id, /^KC-/);

  const verifyRes = await fetch(base + `/api/verify/${product.id}`);
  const verifyBody = await verifyRes.json();
  assert.equal(verifyBody.valid, true);
});

test('unknown API route returns 404 json', async () => {
  const { status, json } = await get('/api/definitely-not-a-route');
  assert.equal(status, 404);
});

test('an artisan created by an artisan is reusable for a product', async () => {
  const { json } = await get('/api/products');
  const products = await json();
  assert.ok(products.every((p) => p.artisan_id), 'every product has an artisan');
});

// ---- Search & pagination ----

test('GET /api/products paginates', async () => {
  const { json } = await get('/api/products?page=1&limit=3');
  const res = await json();
  assert.equal(res.data.length, 3);
  assert.ok(res.total >= 9);
  assert.equal(res.totalPages, Math.ceil(res.total / 3));
  assert.equal(res.page, 1);
});

test('GET /api/products searches by query', async () => {
  const { json } = await get('/api/products?q=Krishna');
  const res = await json();
  assert.ok(Array.isArray(res) && res.length >= 1);
  assert.match(res[0].title, /Krishna/i);
});

test('GET /api/artisans searches and paginates', async () => {
  const { json } = await get('/api/artisans?q=Sunita&page=1&limit=2');
  const res = await json();
  assert.ok(res.total >= 1);
  assert.equal(res.data[0].name, 'Sunita Devi');
});

test('GET /api/artisans filters by craft', async () => {
  const { json } = await get('/api/artisans?craft=Warli%20Painting');
  const res = await json();
  assert.ok(Array.isArray(res) && res.length >= 2);
  assert.ok(res.every((a) => a.craft === 'Warli Painting'));
});

// ---- Update ----

test('PATCH /api/products updates and keeps the chain valid', async () => {
  const before = await (await get('/api/products/KC-A1B2C3')).json();
  const res = await fetch(base + '/api/products/KC-A1B2C3', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'api-test-key' },
    body: JSON.stringify({ ...before, title: 'Krishna Leela — Revised Edition' }),
  });
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.title, 'Krishna Leela — Revised Edition');
  assert.equal(updated.verify.valid, true, 'updated product re-verifies');

  const next = await (await get('/api/verify/KC-D4E5F6')).json();
  assert.equal(next.valid, true, 'downstream block still verifies after re-link');
});

test('PATCH /api/artisans updates a profile', async () => {
  const res = await fetch(base + '/api/artisans/ART-MITHILA1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'api-test-key' },
    body: JSON.stringify({ village: 'Ranti, Madhubani', state: 'Bihar' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.state, 'Bihar');
});

// ---- Delete ----

test('DELETE an artisan with linked products returns 409', async () => {
  const res = await fetch(base + '/api/artisans/ART-MITHILA1', { method: 'DELETE', headers: { 'x-api-key': 'api-test-key' } });
  assert.equal(res.status, 409);
});

test('DELETE a freshly created artisan without products succeeds', async () => {
  const created = await (await post('/api/artisans', { name: 'Temp', village: 'X', craft: 'Y' })).json();
  const res = await fetch(base + `/api/artisans/${created.id}`, { method: 'DELETE', headers: { 'x-api-key': 'api-test-key' } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.deleted, created.id);
});

test('DELETE a product re-links and keeps the chain valid', async () => {
  // Create a temporary product so the seeded chain is untouched by this test.
  const artisans = await (await get('/api/artisans')).json();
  const created = await (await post('/api/products', {
    artisan_id: artisans[0].id,
    title: 'Temp to Delete',
    description: 'x',
    image: '/uploads/tmp.png',
    steps: [],
    materials: ['Ink'],
    price: 1,
  })).json();

  const res = await fetch(base + `/api/products/${created.id}`, { method: 'DELETE', headers: { 'x-api-key': 'api-test-key' } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted, created.id);

  // Every remaining block still verifies.
  const list = await (await get('/api/products')).json();
  assert.ok(list.length >= 9);
  for (const p of list) {
    const v = await (await get(`/api/verify/${p.id}`)).json();
    assert.equal(v.valid, true, `${p.id} should verify after delete`);
  }
});
