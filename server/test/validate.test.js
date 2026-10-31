import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePehchanId, validateArtisan, validatePehchanId, validateProduct } from '../lib/validate.js';

const validImage = '/uploads/foo.png';

test('validateArtisan accepts a valid profile', () => {
  const r = validateArtisan({ name: 'Sunita Devi', village: 'Ranti, Madhubani', craft: 'Madhubani Painting' });
  assert.equal(r.ok, true);
  assert.equal(r.value.name, 'Sunita Devi');
});

test('validateArtisan rejects a missing name', () => {
  const r = validateArtisan({ village: 'Ranti', craft: 'Madhubani' });
  assert.equal(r.ok, false);
  assert.match(r.error, /name/);
});

test('validateArtisan rejects a bad photo path', () => {
  const r = validateArtisan({ name: 'A', village: 'B', craft: 'C', photo: 'http://evil.com/x.png' });
  assert.equal(r.ok, false);
  assert.match(r.error, /photo/);
});

test('validateArtisan accepts optional state and district', () => {
  const r = validateArtisan({ name: 'A', village: 'B', craft: 'C', state: 'Bihar', district: 'Madhubani' });
  assert.equal(r.ok, true);
  assert.equal(r.value.state, 'Bihar');
  assert.equal(r.value.district, 'Madhubani');
});

test('PEHCHAN IDs are normalized and validated without accepting arbitrary text', () => {
  assert.equal(normalizePehchanId(' pch-123/ab '), 'PCH-123/AB');
  assert.equal(validatePehchanId('PCH-123/AB', { required: true }).ok, true);
  assert.equal(validatePehchanId('bad id!', { required: true }).ok, false);
});

test('validateProduct accepts a valid product', () => {
  const r = validateProduct({
    artisan_id: 'ART-MITHILA1',
    title: 'Krishna Leela',
    description: 'A painting',
    image: validImage,
    steps: [{ image: validImage, caption: 'Outline' }],
    materials: ['Handmade paper'],
    price: 4500,
    category: 'Madhubani',
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.category, 'Madhubani');
});

test('validateProduct rejects a negative price', () => {
  const r = validateProduct({
    artisan_id: 'ART-MITHILA1', title: 'X', image: validImage, price: -5,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /price/);
});

test('validateProduct rejects a bad artisan id', () => {
  const r = validateProduct({ artisan_id: '../evil', title: 'X', image: validImage, price: 1 });
  assert.equal(r.ok, false);
  assert.match(r.error, /artisan_id/);
});

test('validateProduct rejects too many steps', () => {
  const r = validateProduct({
    artisan_id: 'ART-1', title: 'X', image: validImage, price: 1,
    steps: Array.from({ length: 11 }, () => ({ image: validImage })),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /steps/);
});
