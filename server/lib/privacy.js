import db from '../db.js';

export const CONSENT_TYPES = ['public_profile', 'location', 'media', 'certificate'];

export function consentSnapshot(artisanId) {
  const snapshot = Object.fromEntries(CONSENT_TYPES.map((type) => [type, false]));
  const rows = db.prepare(`
    SELECT c.consent_type, c.granted
    FROM artisan_consents c
    JOIN (
      SELECT consent_type, MAX(id) AS latest_id
      FROM artisan_consents WHERE artisan_id = ? GROUP BY consent_type
    ) latest ON latest.latest_id = c.id
    WHERE c.artisan_id = ?
  `).all(artisanId, artisanId);
  for (const row of rows) snapshot[row.consent_type] = Boolean(row.granted);
  return snapshot;
}

export function recordConsents(artisanId, userId, consents, note = '') {
  const insert = db.prepare(`
    INSERT INTO artisan_consents (artisan_id, user_id, consent_type, granted, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const type of CONSENT_TYPES) {
    if (typeof consents?.[type] === 'boolean') {
      insert.run(artisanId, userId || null, type, consents[type] ? 1 : 0, String(note || '').slice(0, 300), now);
    }
  }
  return consentSnapshot(artisanId);
}

export function publicArtisan(row) {
  if (!row) return null;
  const consent = consentSnapshot(row.id);
  if (!consent.public_profile) {
    return {
      id: row.id,
      name: 'Private artisan record',
      village: '', craft: row.craft, state: '', district: '', bio: '', photo: '',
      created_at: row.created_at,
      pehchan_verified: row.pehchan_verification_status === 'verified',
      consent,
    };
  }
  return {
    id: row.id,
    name: row.name,
    craft: row.craft,
    bio: row.bio,
    created_at: row.created_at,
    village: consent.location ? row.village : '',
    district: consent.location ? row.district : '',
    state: consent.location ? row.state : '',
    photo: consent.media ? row.photo : '',
    pehchan_verified: row.pehchan_verification_status === 'verified',
    consent,
  };
}
