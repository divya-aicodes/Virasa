import db from '../db.js';
import { verifyPassword } from './auth.js';

const KNOWN_DEMO_PASSWORDS = ['admin-virasa-2026', 'artisan-virasa-2026'];

export function assertProductionSecurity() {
  if (process.env.NODE_ENV !== 'production') return;

  const insecureAccounts = [];
  const users = db.prepare('SELECT email, password_hash FROM users').all();
  for (const user of users) {
    if (KNOWN_DEMO_PASSWORDS.some((password) => verifyPassword(password, user.password_hash))) {
      insecureAccounts.push(user.email);
    }
  }

  if (insecureAccounts.length > 0) {
    throw new Error(`Refusing to start in production with demo passwords: ${insecureAccounts.join(', ')}`);
  }

  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((origin) => origin.includes('localhost'))) {
    throw new Error('Production ALLOWED_ORIGINS must contain only explicit public origins');
  }

  const baseUrl = process.env.BASE_URL || '';
  if (!baseUrl.startsWith('https://')) {
    throw new Error('Production BASE_URL must use HTTPS');
  }
}

export function assertSafeProductionSeed() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.SEED_DEMO_DATA !== 'true') {
    throw new Error('Production demo seeding requires explicit SEED_DEMO_DATA=true');
  }

  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const artisanPassword = process.env.ARTISAN_PASSWORD || '';
  if (adminPassword.length < 12 || KNOWN_DEMO_PASSWORDS.includes(adminPassword)) {
    throw new Error('Set a non-default ADMIN_PASSWORD of at least 12 characters before production seeding');
  }
  if (artisanPassword.length < 12 || KNOWN_DEMO_PASSWORDS.includes(artisanPassword)) {
    throw new Error('Set a non-default ARTISAN_PASSWORD of at least 12 characters before production seeding');
  }
}
