import crypto from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';

function encryptionKey() {
  const source = process.env.MFA_ENCRYPTION_KEY || 'virasa-development-mfa-key-change-before-production';
  return crypto.createHash('sha256').update(source).digest();
}

export function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value) {
  const [ivRaw, tagRaw, encryptedRaw] = String(value || '').split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted MFA secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function newMfaSecret(email) {
  const secret = generateSecret();
  return { secret, uri: generateURI({ issuer: 'Virasa', label: email, secret }) };
}

export async function verifyMfaCode(secret, code) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  return verify({ secret, token: String(code) });
}
