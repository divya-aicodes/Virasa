import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { UPLOAD_DIR } from './db.js';
import { appendRevision } from './lib/ledger.js';
import { recordConsents } from './lib/privacy.js';
import { hashPassword } from './lib/auth.js';
import { assertSafeProductionSeed } from './lib/security.js';

assertSafeProductionSeed();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const RED = '#c0392b', GOLD = '#d4a017', GREEN = '#1e8449', INDIGO = '#1a1a2e',
  WHITE = '#fdf6e3', BLUE = '#2471a3', TERRA = '#8b4513', SAGE = '#6a7b3c',
  MAROON = '#7b1e2b', AMBER = '#b26a1f', TEAL = '#1f6f6b', PLUM = '#5b2a56';

function mandala(w, h, palette, stage) {
  const cx = w / 2, cy = h / 2;
  const shapes = [];
  const ring = (r, color, stroke = 3, fill = 'none') => {
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${color}" stroke-width="${stroke}"/>`);
  };
  if (stage >= 0) ring(240, palette[0], 4, stage === 0 ? 'none' : '#fdf6e3');
  if (stage >= 1) ring(180, palette[1], 3);
  if (stage >= 2) {
    ring(120, palette[2], 3);
    for (let i = 0; i < 12; i++) {
      const a = (i * 30) * Math.PI / 180;
      const x = cx + 120 * Math.cos(a), y = cy + 120 * Math.sin(a);
      shapes.push(`<circle cx="${x}" cy="${y}" r="${stage >= 3 ? 26 : 16}" fill="${stage >= 3 ? palette[i % 3] : 'none'}" stroke="${palette[0]}" stroke-width="3"/>`);
    }
  }
  if (stage >= 3) {
    ring(60, palette[1], 3);
    ring(30, palette[2], 2, palette[0]);
    shapes.push(`<path d="M ${cx - 40} ${cy} Q ${cx} ${cy - 60} ${cx + 40} ${cy} Q ${cx} ${cy + 60} ${cx - 40} ${cy} Z" fill="${GOLD}" stroke="${palette[0]}" stroke-width="3"/>`);
    for (let i = 0; i < 4; i++) {
      const a = (i * 90 + 45) * Math.PI / 180;
      const x = cx + 210 * Math.cos(a), y = cy + 210 * Math.sin(a);
      shapes.push(`<path d="M ${x - 8} ${y - 14} Q ${x} ${y - 26} ${x + 8} ${y - 14} L ${x + 8} ${y + 4} Q ${x} ${y + 12} ${x - 8} ${y + 4} Z" fill="${i % 2 ? GREEN : RED}" stroke="${palette[0]}" stroke-width="2"/>`);
    }
  }
  const bg = stage === 0 ? '#f4e9d8' : '#fdf6e3';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="${palette[0]}" stroke-width="4" stroke-dasharray="14 8"/>
  ${shapes.join('\n  ')}
</svg>`;
}

function avatar(name, color) {
  const initial = (name || 'A').trim().charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${INDIGO}"/>
  <circle cx="200" cy="200" r="150" fill="${color}" opacity="0.25"/>
  <circle cx="200" cy="160" r="60" fill="${color}" opacity="0.9"/>
  <path d="M 110 320 Q 200 240 290 320 Z" fill="${color}" opacity="0.9"/>
  <text x="200" y="205" font-family="Georgia, serif" font-size="110" fill="${WHITE}" text-anchor="middle" dominant-baseline="middle">${initial}</text>
</svg>`;
}

function writeSvg(name, svg) {
  const p = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(p, svg);
  return `/uploads/${name}`;
}

const artisans = [
  { id: 'ART-MITHILA1', name: 'Sunita Devi', village: 'Ranti, Madhubani', district: 'Madhubani', state: 'Bihar', craft: 'Madhubani Painting', bio: 'Third-generation Mithila artist. Her works have been exhibited in Delhi and Paris, painted with natural pigments on handmade paper.' },
  { id: 'ART-MITHILA2', name: 'Ram Prasad Jha', village: 'Jitwarpur, Madhubani', district: 'Madhubani', state: 'Bihar', craft: 'Madhubani Painting', bio: 'Master of the Kachni (line) style. Has trained 40+ village women in traditional Mithila art.' },
  { id: 'ART-MITHILA3', name: 'Kavita Kumari', village: 'Rasidpur, Madhubani', district: 'Madhubani', state: 'Bihar', craft: 'Madhubani Painting', bio: 'Young Mithila artist blending folk motifs with modern compositions. Winner of the district craft award 2025.' },
  { id: 'ART-WARLI1', name: 'Jivya Soma Mashe', village: 'Dahanu', district: 'Palghar', state: 'Maharashtra', craft: 'Warli Painting', bio: 'Padma Shri recipient who carried Warli from village walls to the international art stage with his rhythmic ritual motifs.' },
  { id: 'ART-WARLI2', name: 'Anil Vangad', village: 'Ganjad', district: 'Palghar', state: 'Maharashtra', craft: 'Warli Painting', bio: 'Contemporary Warli artist known for incorporating environment and technology narratives into the traditional white-on-mud idiom.' },
  { id: 'ART-PATTA1', name: 'Gitanjali Das', village: 'Raghurajpur', district: 'Puri', state: 'Odisha', craft: 'Pattachitra', bio: 'A Raghurajpur artist carrying the centuries-old temple painting tradition with natural colours and tussar silk surfaces.' },
  { id: 'ART-KALAM1', name: 'P. Srinivas Rao', village: 'Srikalahasti', district: 'Tirupati', state: 'Andhra Pradesh', craft: 'Kalamkari', bio: 'Practitioner of the Srikalahasti style of pen-drawn Kalamkari, painting mythologies with natural dyes on handwoven cotton.' },
  { id: 'ART-SOHRAI1', name: 'Meera Bhagat', village: 'Isco', district: 'Hazaribagh', state: 'Jharkhand', craft: 'Sohrai Art', bio: 'Sohrai muralist painting harvest-season murals with mud, cow dung and kaolin on the walls of her village.' },
  { id: 'ART-GOND1', name: 'Bhajju Shyam', village: 'Patangarh', district: 'Dindori', state: 'Madhya Pradesh', craft: 'Gond Art', bio: 'Celebrated Gond artist whose dot-and-line visions of forests and mythology have travelled from Patangarh to galleries worldwide.' },
];

const stepCaptions = [
  'Outline drawn by hand',
  'Base colours filled',
  'Fine detailing added',
  'Final artwork completed',
];

const products = [
  {
    id: 'KC-A1B2C3', artisan_id: 'ART-MITHILA1', title: 'Krishna Leela — Peacock Dance',
    description: 'A hand-painted Madhubani artwork depicting Krishna with dancing peacocks and lotus ponds. Painted with natural vegetable dyes on handmade paper over 12 days.',
    materials: ['Handmade paper', 'Vegetable dyes', 'Bamboo nib', 'Charcoal outline'],
    price: 4500, category: 'Madhubani', palette: [RED, GREEN, GOLD],
  },
  {
    id: 'KC-D4E5F6', artisan_id: 'ART-MITHILA2', title: 'Royal Wedding Procession',
    description: 'Kachni-style Madhubani painting of a royal wedding with elephants, musicians and dancers. Fine black line work with white on deep indigo.',
    materials: ['Handmade paper', 'Black ink', 'White pigment', 'Indigo dye'],
    price: 6800, category: 'Madhubani', palette: [INDIGO, GOLD, WHITE],
  },
  {
    id: 'KC-G7H8I9', artisan_id: 'ART-MITHILA3', title: 'Village Life — Sun & Moon',
    description: 'A vibrant composition of village life: women with water pots, fish, birds, sun and moon. Modern Mithila with a contemporary palette.',
    materials: ['Handmade paper', 'Acrylic colours', 'Fine brush'],
    price: 3200, category: 'Madhubani', palette: [BLUE, GOLD, GREEN],
  },
  {
    id: 'KC-W4R2X1', artisan_id: 'ART-WARLI1', title: 'Harvest Circle — Warli Ritual',
    description: 'White pigment on mud-washed board: the Tarpa circle dance, harvest figures and the timeless chaukat, drawn in Warli\'s unbroken dotted lines.',
    materials: ['Rice paste', 'Cow dung wash', 'Bamboo stick', 'Natural white'],
    price: 5400, category: 'Warli', palette: [TERRA, WHITE, RED],
  },
  {
    id: 'KC-W8P6Q2', artisan_id: 'ART-WARLI2', title: 'Tiger & the Village',
    description: 'A contemporary Warli narrative: village life encircled by the forest, where the tiger is both neighbour and myth.',
    materials: ['Rice paste', 'Mud board', 'Natural white', 'Fine twig'],
    price: 4100, category: 'Warli', palette: [TERRA, SAGE, WHITE],
  },
  {
    id: 'KC-P3T7R5', artisan_id: 'ART-PATTA1', title: 'Shri Jagannath — Dashavatara',
    description: 'Temple-style Pattachitra on tussar silk showing the ten incarnations of Vishnu, bordered with the lotus-and-paisley jala typical of Raghurajpur.',
    materials: ['Tussar silk', 'Natural colours', 'Tamrind paste', 'Thin brush'],
    price: 7200, category: 'Pattachitra', palette: [MAROON, GOLD, BLUE],
  },
  {
    id: 'KC-K9M2N4', artisan_id: 'ART-KALAM1', title: 'Gopuram of Srikalahasti',
    description: 'Pen-drawn Kalamkari in natural madder and indigo, depicting the temple gopuram, sacred processions and the flow of the river beneath.',
    materials: ['Handwoven cotton', 'Madder root', 'Indigo', 'Iron pen'],
    price: 5900, category: 'Kalamkari', palette: [AMBER, TEAL, TERRA],
  },
  {
    id: 'KC-S6H3J8', artisan_id: 'ART-SOHRAI1', title: 'Sohrai Harvest Mural',
    description: 'A harvest-season wall mural transferred to board: cattle, leaves and the sun in the red-and-kaolin palette of Hazaribagh\'s Sohrai festival.',
    materials: ['Cow dung wash', 'Kaolin', 'Red earth', 'Bamboo twig'],
    price: 3600, category: 'Sohrai', palette: [RED, TERRA, WHITE],
  },
  {
    id: 'KC-G2X7D1', artisan_id: 'ART-GOND1', title: 'The Trees of Patangarh',
    description: 'A Gond painting alive with dot-and-line textures: a great tree cradling birds, beasts and the stories of the forest.',
    materials: ['Handmade paper', 'Acrylic colours', 'Fine nib'],
    price: 4800, category: 'Gond', palette: [PLUM, GREEN, GOLD],
  },
];

const existingArtisans = db.prepare('SELECT COUNT(*) AS n FROM artisans').get().n;
if (existingArtisans === 0) {
  const insArt = db.prepare('INSERT INTO artisans (id, name, village, craft, state, district, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const tones = [RED, GOLD, GREEN, TERRA, BLUE, MAROON, AMBER, SAGE, PLUM];
  for (let i = 0; i < artisans.length; i++) {
    const a = artisans[i];
    const photo = writeSvg(`avatar-${a.id}.svg`, avatar(a.name.split(' ')[0], tones[i % tones.length]));
    insArt.run(a.id, a.name, a.village, a.craft, a.state, a.district, a.bio, photo);
  }
  console.log(`Seeded ${artisans.length} artisans`);
}

const existingProducts = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (existingProducts === 0) {
  const insProd = db.prepare(`INSERT INTO products
    (id, artisan_id, title, description, image, steps, materials, price, category,
     hash, prev_hash, chain_index, created_at, status, verification_status,
     owner_approved, approved_at, latest_revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'GENESIS', ?, ?, 'verified', 'verified', 1, ?, 0)`);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const image = writeSvg(`product-${p.id}-final.svg`, mandala(800, 600, p.palette, 3));
    const steps = [];
    for (let s = 0; s < 4; s++) {
      steps.push({ image: writeSvg(`product-${p.id}-step${s + 1}.svg`, mandala(600, 450, p.palette, s)), caption: stepCaptions[s] });
    }

    const fields = {
      id: p.id, artisan_id: p.artisan_id, title: p.title, description: p.description,
      image, steps: JSON.stringify(steps), materials: JSON.stringify(p.materials),
      price: p.price, category: p.category, created_at: new Date().toISOString(),
    };
    const chainIndex = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM product_revisions').get().n;
    insProd.run(fields.id, fields.artisan_id, fields.title, fields.description, image, fields.steps, fields.materials, p.price, p.category, chainIndex, fields.created_at, fields.created_at);
    appendRevision(fields.id, { action: 'created', reason: 'Seeded verified heritage record', actorRole: 'system' });

    const evidenceInsert = db.prepare(`
      INSERT INTO evidence_items
        (id, product_id, evidence_type, url, mime_type, caption, verification_status, created_at)
      VALUES (?, ?, ?, ?, 'image/svg+xml', ?, 'verified', ?)
    `);
    evidenceInsert.run(`EVD-${p.id}-MAIN`, p.id, 'primary', image, 'Primary artwork image', fields.created_at);
    steps.forEach((item, stepIndex) => {
      evidenceInsert.run(`EVD-${p.id}-${stepIndex + 1}`, p.id, 'process', item.image, item.caption, fields.created_at);
    });
  }
  console.log(`Seeded ${products.length} products (chain of ${products.length} blocks)`);
}

console.log('Seed complete. Chain blocks:', db.prepare('SELECT COUNT(*) AS n FROM products').get().n);

const insertUser = db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, artisan_id, email_verified, email_verified_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?)
`);
const seedUser = (id, name, email, password, role, artisanId = null) => {
  const normalized = email.toLowerCase();
  if (!db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) {
    insertUser.run(id, name, normalized, hashPassword(password), role, artisanId, new Date().toISOString());
    return true;
  }
  return false;
};

const adminPassword = process.env.ADMIN_PASSWORD || 'admin-virasa-2026';
const artisanPassword = process.env.ARTISAN_PASSWORD || 'artisan-virasa-2026';

if (seedUser('USR-ADMIN1', 'Archive Admin', process.env.ADMIN_EMAIL || 'admin@virasa.in', adminPassword, 'admin')) {
  console.log('Seeded administrator account');
}
if (seedUser('USR-ART001', 'Sunita Devi', process.env.ARTISAN_EMAIL || 'sunita@virasa.in', artisanPassword, 'artisan', 'ART-MITHILA1')) {
  console.log('Seeded artisan account');
}

for (const artisan of db.prepare('SELECT id FROM artisans').all()) {
  const hasConsent = db.prepare('SELECT 1 FROM artisan_consents WHERE artisan_id = ? LIMIT 1').get(artisan.id);
  if (!hasConsent) {
    recordConsents(artisan.id, null, {
      public_profile: true,
      location: true,
      media: true,
      certificate: true,
    }, 'Seeded demonstration record');
  }
}
