import nodemailer from 'nodemailer';
import db from '../db.js';

let transporter;

function transport() {
  if (!process.env.SMTP_URL) return null;
  if (!transporter) transporter = nodemailer.createTransport(process.env.SMTP_URL);
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO email_outbox (recipient, subject, text_body, created_at)
    VALUES (?, ?, ?, ?)
  `).run(to, subject, text, now);
  const id = Number(result.lastInsertRowid);
  const mailer = transport();

  if (!mailer) {
    if (process.env.NODE_ENV !== 'test') {
      console.info(JSON.stringify({ level: 'info', event: 'email.queued', outboxId: id, recipient: to, subject }));
    }
    return { queued: true, outboxId: id };
  }

  try {
    const sent = await mailer.sendMail({
      from: process.env.EMAIL_FROM || 'Virasā <no-reply@virasa.invalid>',
      to,
      subject,
      text,
    });
    db.prepare("UPDATE email_outbox SET status = 'sent', provider_id = ?, sent_at = ? WHERE id = ?")
      .run(String(sent.messageId || ''), new Date().toISOString(), id);
    return { queued: false, sent: true, outboxId: id };
  } catch (error) {
    db.prepare("UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?")
      .run(String(error.message || error).slice(0, 1000), id);
    throw error;
  }
}
