import db from '../db.js';
import { sha256, buildCanonical } from './canonical.js';
import {
  fullRevisionChain,
  verifyProductRevision,
  verifyRevisionChain,
} from './ledger.js';

// Kept for migration compatibility with older external callers. New writes
// use the append-only revision ledger in ledger.js.
export function makeHash(productRow) {
  const previous = db.prepare('SELECT hash FROM product_revisions ORDER BY id DESC LIMIT 1').get();
  const prevHash = previous?.hash || 'GENESIS';
  return { hash: sha256(buildCanonical(productRow) + `|${prevHash}`), prevHash };
}

export function chainLength() {
  return db.prepare('SELECT COUNT(*) AS n FROM product_revisions').get().n;
}

export function verifyChain(throughIndex = null) {
  return verifyRevisionChain(throughIndex);
}

export function verifyProduct(id) {
  return verifyProductRevision(id);
}

export function fullChain() {
  return fullRevisionChain();
}
