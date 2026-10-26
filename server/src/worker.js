import nodemailer from 'nodemailer';
import { checkDatabase, pool } from './db.js';

if (!process.env.SMTP_URL || !process.env.MAIL_FROM) {
  throw new Error('SMTP_URL and MAIL_FROM are required for the email worker');
}
await checkDatabase({ schema: true });
const transport = nodemailer.createTransport(process.env.SMTP_URL);

async function workOnce() {
  await pool.query("UPDATE notification_outbox SET status='PENDING',updated_at=now() WHERE status='PROCESSING' AND updated_at < now() - interval '10 minutes'");
  const { rows } = await pool.query(`WITH candidate AS (
    SELECT id FROM notification_outbox WHERE status='PENDING' AND next_attempt_at <= now()
    ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
  ) UPDATE notification_outbox n SET status='PROCESSING',attempts=n.attempts+1,updated_at=now()
    FROM candidate WHERE n.id=candidate.id RETURNING n.*`);
  const job = rows[0];
  if (!job) return false;
  const subject = job.template_code === 'ORDER_CREATED' ? `FORMA: замовлення ${job.payload.number}` : `FORMA: статус замовлення ${job.payload.number}`;
  const text = job.template_code === 'ORDER_CREATED'
    ? `Ваше замовлення ${job.payload.number} створено. Сума: ${job.payload.total} грн. Оплата очікується.`
    : `Статус замовлення ${job.payload.number}: ${job.payload.status}.`;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM, to: job.recipient, subject, text });
    await pool.query("UPDATE notification_outbox SET status='SENT',updated_at=now() WHERE id=$1",[job.id]);
    console.log(`Email delivered for outbox ${job.id}`);
  } catch (error) {
    const failed = job.attempts >= 5;
    await pool.query("UPDATE notification_outbox SET status=$2,next_attempt_at=now()+($3::int * interval '1 minute'),updated_at=now() WHERE id=$1",[job.id,failed ? 'FAILED' : 'PENDING',2 ** Math.min(job.attempts,5)]);
    console.error(`Email outbox ${job.id} failed: ${error.message}`);
  }
  return true;
}

async function run() {
  while (true) {
    try { if (!(await workOnce())) await new Promise((resolve) => setTimeout(resolve,5000)); }
    catch (error) { console.error(error); await new Promise((resolve) => setTimeout(resolve,5000)); }
  }
}
run();
