export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.safe = true;
  return err;
}

const ID_PATTERN = /^[A-Z0-9-]{1,20}$/;
const PEHCHAN_PATTERN = /^[A-Z0-9/-]{4,32}$/;
const IMAGE_PATTERN = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|svg)$/i;

function isImage(value) {
  if (IMAGE_PATTERN.test(value)) return true;
  const cdnBase = String(process.env.CDN_BASE_URL || '').replace(/\/$/, '');
  if (!cdnBase || !/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    const base = new URL(cdnBase);
    return url.origin === base.origin && url.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/`) && /\.(png|jpe?g|webp)$/i.test(url.pathname);
  } catch { return false; }
}

function isString(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}

export function normalizePehchanId(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function validatePehchanId(value, { required = false } = {}) {
  const normalized = normalizePehchanId(value);
  if (!normalized && !required) return { ok: true, value: '' };
  if (!PEHCHAN_PATTERN.test(normalized)) {
    return { ok: false, error: 'PEHCHAN ID must be 4–32 letters, numbers, hyphens, or slashes' };
  }
  return { ok: true, value: normalized };
}

export function validateArtisan(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!isString(b.name, 100)) return { ok: false, error: 'name is required and must be 1–100 characters' };
  if (!isString(b.village, 100)) return { ok: false, error: 'village is required and must be 1–100 characters' };
  if (!isString(b.craft, 100)) return { ok: false, error: 'craft is required and must be 1–100 characters' };
  if (b.bio !== undefined && b.bio !== null && (typeof b.bio !== 'string' || b.bio.length > 500)) {
    return { ok: false, error: 'bio must be 500 characters or fewer' };
  }
  if (b.photo !== undefined && b.photo !== null && b.photo !== '' && !isImage(b.photo)) {
    return { ok: false, error: 'photo must be a valid uploaded image path' };
  }
  if (b.state !== undefined && b.state !== null && b.state !== '' && !isString(b.state, 50)) {
    return { ok: false, error: 'state must be 1–50 characters' };
  }
  if (b.district !== undefined && b.district !== null && b.district !== '' && !isString(b.district, 50)) {
    return { ok: false, error: 'district must be 1–50 characters' };
  }
  const pehchan = validatePehchanId(b.pehchanId ?? b.pehchan_id);
  if (!pehchan.ok) return pehchan;
  return {
    ok: true,
    value: {
      name: b.name.trim(),
      village: b.village.trim(),
      craft: b.craft.trim(),
      state: (b.state || '').trim().slice(0, 50),
      district: (b.district || '').trim().slice(0, 50),
      bio: (b.bio || '').slice(0, 500),
      photo: b.photo || '',
      pehchanId: pehchan.value,
    },
  };
}

export function validateProduct(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (!isString(b.artisan_id, 20) || !ID_PATTERN.test(b.artisan_id.trim())) {
    return { ok: false, error: 'artisan_id is required and must be a valid id' };
  }
  if (!isString(b.title, 120)) return { ok: false, error: 'title is required and must be 1–120 characters' };
  if (b.description !== undefined && b.description !== null && (typeof b.description !== 'string' || b.description.length > 2000)) {
    return { ok: false, error: 'description must be 2000 characters or fewer' };
  }
  if (typeof b.price !== 'number' || !Number.isFinite(b.price) || b.price < 0 || b.price > 10_000_000) {
    return { ok: false, error: 'price must be a number between 0 and 10,000,000' };
  }
  if (!isString(b.image, 500) || !isImage(b.image.trim())) {
    return { ok: false, error: 'image must be a valid uploaded image path' };
  }
  if (b.category !== undefined && b.category !== null && b.category !== '' && !isString(b.category, 60)) {
    return { ok: false, error: 'category must be 1–60 characters' };
  }
  if (!Array.isArray(b.steps) || b.steps.length > 10) {
    return { ok: false, error: 'steps must be an array of at most 10 items' };
  }
  const steps = [];
  for (const s of b.steps) {
    if (!s || typeof s !== 'object' || !isString(s.image, 500) || !isImage(s.image) ||
        (s.caption !== undefined && (typeof s.caption !== 'string' || s.caption.length > 80))) {
      return { ok: false, error: 'each step must have a valid image and a caption of 80 characters or fewer' };
    }
    steps.push({ image: s.image, caption: s.caption || '' });
  }
  if (!Array.isArray(b.materials) || b.materials.length > 12) {
    return { ok: false, error: 'materials must be an array of at most 12 items' };
  }
  const materials = [];
  for (const m of b.materials) {
    if (typeof m !== 'string' || m.trim().length === 0 || m.trim().length > 40) {
      return { ok: false, error: 'each material must be 1–40 characters' };
    }
    materials.push(m.trim());
  }
  return {
    ok: true,
    value: {
      artisan_id: b.artisan_id.trim(),
      title: b.title.trim(),
      description: (b.description || '').slice(0, 2000),
      price: b.price,
      image: b.image.trim(),
      category: (b.category || '').trim().slice(0, 60),
      steps,
      materials,
    },
  };
}
