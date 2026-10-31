import 'regenerator-runtime/runtime.js';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.join(__dirname, '..', 'assets', 'NotoSansDevanagari-Regular.ttf');
const GOLD = rgb(0.69, 0.54, 0.20);
const DARK = rgb(0.17, 0.14, 0.11);
const MUTED = rgb(0.39, 0.35, 0.30);
const GREEN = rgb(0.20, 0.38, 0.25);

function fitText(font, value, maxWidth, initialSize, minSize = 8) {
  const text = String(value ?? '');
  let size = initialSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size };
  let trimmed = text;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) trimmed = trimmed.slice(0, -1);
  return { text: `${trimmed}…`, size };
}
function drawFitted(page, font, value, options) {
  const fitted = fitText(font, value, options.maxWidth, options.size, options.minSize);
  page.drawText(fitted.text, { ...options, size: fitted.size, font });
}

export async function generateCertificate({ product, artisan, verifyUrl, verify }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes = await fs.readFile(FONT_PATH);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const page = doc.addPage([595, 842]);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.992, 0.98, 0.94) });
  page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, borderColor: GOLD, borderWidth: 2 });
  page.drawRectangle({ x: 47, y: 47, width: 501, height: 748, borderColor: rgb(0.82, 0.78, 0.68), borderWidth: 0.6 });

  page.drawText('Virasā', { x: 60, y: 758, size: 28, font, color: DARK });
  page.drawText('विरासत · प्रमाणित उत्पत्ति', { x: 60, y: 731, size: 12, font, color: GOLD });
  page.drawText('CERTIFICATE OF PROVENANCE', { x: 60, y: 702, size: 9, font, color: MUTED, characterSpacing: 1.5 });

  page.drawText('This certificate records the verified maker, place, evidence and revision history of', { x: 60, y: 661, size: 9.5, font, color: MUTED });
  drawFitted(page, font, product.title, { x: 60, y: 627, size: 23, minSize: 13, maxWidth: 470, color: DARK });

  const materials = JSON.parse(product.materials || '[]');
  const craftLine = product.category || artisan.craft;
  const lines = [
    ['Artisan / शिल्पकार', artisan.name],
    ['Craft / शिल्प', craftLine],
    ['Place / स्थान', `${artisan.village}${artisan.state ? `, ${artisan.state}` : ''}`],
    ['Materials / सामग्री', materials.join(', ') || 'Not recorded'],
    ['Accession ID', product.id],
    ['Revision', `${verify.revision} · ledger entry ${verify.chainIndex} of ${verify.chainLength}`],
  ];

  let y = 579;
  for (const [label, value] of lines) {
    page.drawText(label.toUpperCase(), { x: 60, y, size: 7.5, font, color: GOLD, characterSpacing: 0.5 });
    drawFitted(page, font, value, { x: 195, y: y - 1, size: 11, minSize: 8, maxWidth: 330, color: DARK });
    y -= 27;
  }

  page.drawRectangle({ x: 60, y: 376, width: 475, height: 42, color: rgb(0.92, 0.94, 0.89), borderColor: GREEN, borderWidth: 0.7 });
  page.drawText('✓  VERIFIED RECORD', { x: 76, y: 391, size: 12, font, color: GREEN });
  page.drawText(`SHA-256  ${product.hash}`, { x: 205, y: 393, size: 6.4, font, color: MUTED });

  const qrPng = await QRCode.toBuffer(verifyUrl, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  const qrImg = await doc.embedPng(qrPng);
  page.drawImage(qrImg, { x: 60, y: 193, width: 145, height: 145 });
  page.drawText('SCAN TO VERIFY', { x: 74, y: 176, size: 8, font, color: GOLD, characterSpacing: 1 });

  page.drawText('Public verification', { x: 235, y: 311, size: 10, font, color: GOLD });
  drawFitted(page, font, verifyUrl, { x: 235, y: 291, size: 8, minSize: 6, maxWidth: 285, color: MUTED });
  page.drawText('This record is backed by an append-only revision ledger.', { x: 235, y: 253, size: 9, font, color: DARK });
  page.drawText('Corrections remain visible; earlier revisions are never erased.', { x: 235, y: 235, size: 9, font, color: DARK });
  page.drawText('Evidence was reviewed before this certificate was issued.', { x: 235, y: 217, size: 9, font, color: DARK });

  page.drawText('Virasā preserves provenance; it does not replace legal ownership documentation.', { x: 60, y: 91, size: 7.5, font, color: MUTED });
  page.drawText('Generated from the live registry · Unicode text preserved', { x: 60, y: 72, size: 7.5, font, color: MUTED });

  return Buffer.from(await doc.save());
}
