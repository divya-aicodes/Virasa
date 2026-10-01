import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

const GOLD = rgb(0.83, 0.69, 0.32);
const DARK = rgb(0.10, 0.09, 0.14);
const MUTED = rgb(0.35, 0.33, 0.42);

// pdf-lib's built-in standard fonts only support the Latin-1 (WinAnsi) set.
// Normalise to an ASCII-safe representation so names, titles and brand copy
// with diacritics (e.g. "Virasā") or fallback scripts render without crashing.
const LATIN1_MAP = { '\u0152': 'OE', '\u0153': 'oe', '\u0178': 'Y', '\u20B9': 'Rs.' };
function pdfSafe(value) {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  let out = '';
  for (const ch of normalized) {
    const code = ch.codePointAt(0);
    if (code <= 0xff) out += ch;
    else out += LATIN1_MAP[ch] || '';
  }
  return out;
}

export async function generateCertificate({ product, artisan, verifyUrl, verify }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });

  page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, color: rgb(1, 1, 1), borderColor: GOLD, borderWidth: 2 });

  page.drawText(pdfSafe('Virasā'), { x: 60, y: 760, size: 26, font: bold, color: DARK });
  page.drawText('Certificate of Authenticity', { x: 60, y: 734, size: 13, font: italic, color: GOLD });

  page.drawText('This certifies that the following handmade artwork', { x: 60, y: 660, size: 11, font, color: MUTED });
  page.drawText(pdfSafe(product.title), { x: 60, y: 638, size: 24, font: bold, color: DARK });

  const materials = JSON.parse(product.materials || '[]');
  const steps = JSON.parse(product.steps || '[]');
  const craftLine = product.category || artisan.craft;

  let y = 590;
  page.drawText(`Artisan: ${pdfSafe(artisan.name)}`, { x: 60, y, size: 12, font, color: DARK }); y -= 20;
  page.drawText(`Craft: ${pdfSafe(craftLine)}`, { x: 60, y, size: 12, font, color: DARK }); y -= 20;
  page.drawText(`Village: ${pdfSafe(artisan.village)}${artisan.state ? `, ${pdfSafe(artisan.state)}` : ''}`, { x: 60, y, size: 12, font, color: DARK }); y -= 20;
  page.drawText(`Materials: ${pdfSafe(materials.join(', ')) || 'Handmade paper, natural pigments'}`, { x: 60, y, size: 12, font, color: DARK }); y -= 24;
  page.drawText(`Steps documented: ${steps.length}`, { x: 60, y, size: 12, font, color: DARK }); y -= 20;
  page.drawText(`Product ID: ${product.id}`, { x: 60, y, size: 12, font, color: GOLD }); y -= 20;
  page.drawText(`Chain Index: #${product.chain_index} of ${verify.chainLength}`, { x: 60, y, size: 12, font, color: GOLD }); y -= 20;
  page.drawText(`Status: ${verify.valid ? 'CHAIN VERIFIED' : 'INVALID'}`, { x: 60, y, size: 13, font: bold, color: verify.valid ? rgb(0.05, 0.55, 0.28) : rgb(0.8, 0.1, 0.1) }); y -= 28;

  page.drawText('Scan to verify authenticity:', { x: 60, y, size: 10, font, color: MUTED });

  const qrPng = await QRCode.toBuffer(verifyUrl, { width: 280, margin: 1 });
  const qrImg = await doc.embedPng(qrPng);
  page.drawImage(qrImg, { x: 60, y: y - 130, width: 130, height: 130 });

  page.drawText(`Verification link: ${pdfSafe(verifyUrl)}`, { x: 210, y: y - 60, size: 9, font, color: MUTED });
  page.drawText(`SHA-256: ${product.hash.slice(0, 40)}...`, { x: 210, y: y - 74, size: 8, font, color: MUTED });

  page.drawText('Every product is chained to the one before it.', { x: 60, y: 90, size: 10, font: italic, color: MUTED });
  page.drawText('Tampering with any record breaks the chain and is instantly detectable.', { x: 60, y: 74, size: 10, font: italic, color: MUTED });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
