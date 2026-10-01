import 'dotenv/config';
import db from './db.js';
import { hashPassword } from './lib/auth.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || '';

if (!email || !password) {
  console.error('Usage: node reset-password.js <email> <new-password>');
  console.error('       npm run reset-password -- <email> <new-password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const user = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(email);
if (!user) {
  console.error(`No account found for ${email}.`);
  process.exit(1);
}

db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
  .run(hashPassword(password), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

console.log(`Password reset for ${user.name} (${user.role}) <${email}>. All sessions were invalidated.`);