import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistUpload, storageSummary } from '../lib/storage.js';

test('local storage returns a stable application URL without deleting the source', async () => {
  const stored = await persistUpload({ filename: 'example.webp' });
  assert.deepEqual(stored, { url: '/uploads/example.webp', removeLocal: false });
  assert.deepEqual(storageSummary(), { driver: 'local', cdn: false });
});
