import { Router } from 'express';
import db from '../db.js';
import { verifyProduct, fullChain, verifyChain } from '../lib/hashchain.js';
import { generateCertificate } from '../lib/certificate.js';

const router = Router();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT p.*, a.name AS artisan_name, a.village AS artisan_village, a.craft AS artisan_craft, a.photo AS artisan_photo, a.state AS artisan_state, a.district AS artisan_district
    FROM products p JOIN artisans a ON a.id = p.artisan_id
    WHERE p.id = ?
  `).get(req.params.id.toUpperCase());

  if (!row) return res.json({ valid: false, reason: 'Product not found', id: req.params.id });

  const verify = verifyProduct(row.id);
  const verifyUrl = `${BASE_URL}/verify?id=${row.id}`;
  const product = {
    ...row,
    steps: JSON.parse(row.steps || '[]'),
    materials: JSON.parse(row.materials || '[]'),
  };
  res.json({ valid: verify.valid, verify, verifyUrl, product });
});

router.get('/:id/certificate', (req, res, next) => {
  (async () => {
    const row = db.prepare(`
      SELECT p.*, a.name AS artisan_name, a.village AS artisan_village, a.craft AS artisan_craft, a.photo AS artisan_photo, a.state AS artisan_state, a.district AS artisan_district
      FROM products p JOIN artisans a ON a.id = p.artisan_id
      WHERE p.id = ?
    `).get(req.params.id.toUpperCase());

    if (!row) return res.status(404).json({ error: 'Product not found' });

    const verify = verifyProduct(row.id);
    const verifyUrl = `${BASE_URL}/verify?id=${row.id}`;
    const pdf = await generateCertificate({
      product: row,
      artisan: { name: row.artisan_name, village: row.artisan_village, craft: row.artisan_craft, state: row.artisan_state },
      verifyUrl,
      verify,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Virasaa-certificate-${row.id}.pdf"`);
    res.send(pdf);
  })().catch(next);
});

router.get('/', (req, res) => {
  const chain = fullChain();
  res.json({ chain, length: chain.length, verification: verifyChain() });
});

export default router;
