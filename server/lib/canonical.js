import crypto from 'node:crypto';

export const CANONICAL_FIELDS = [
  'id',
  'artisan_id',
  'title',
  'description',
  'image',
  'steps',
  'materials',
  'price',
  'category',
  'created_at',
];

export function buildCanonical(productRow) {
  const obj = {};
  for (const key of CANONICAL_FIELDS) {
    obj[key] = productRow[key];
  }
  return JSON.stringify(obj);
}

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}