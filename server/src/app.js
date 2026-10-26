import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { attachUser, emailSchema, endSession, hashPassword, passwordSchema, publicUser, requireRole, startSession, userSelect, verifyPassword } from './auth.js';
import { HttpError, errorHandler } from './errors.js';
import { productRouter, adminProductRouter } from './products.js';
import { orderRouter, adminOrderRouter } from './orders.js';
import { analyticsRouter } from './analytics.js';

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { req.id = randomUUID(); res.setHeader('X-Request-ID', req.id); next(); });
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use((req,_res,next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const allowed = process.env.FRONTEND_ORIGIN || `${req.protocol}://${req.get('host')}`;
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin !== allowed && origin !== sameOrigin) return next(new HttpError(403,'Недозволене джерело запиту.','ORIGIN_DENIED'));
  next();
});
app.get('/api/health', async (_req,res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });

const auth = Router();
const authLimit = rateLimit({ windowMs: 15*60*1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
auth.use(attachUser);
auth.post('/register', authLimit, async (req,res) => {
  const data = z.object({ email: emailSchema, password: passwordSchema, firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80) }).strict().parse(req.body);
  const hash = await hashPassword(data.password);
  const user = await transaction(async (client) => {
    const { rows } = await client.query('INSERT INTO users (email,first_name,last_name,password_hash) VALUES ($1,$2,$3,$4) RETURNING *', [data.email,data.firstName,data.lastName,hash]);
    await client.query("INSERT INTO user_roles (user_id,role_id) SELECT $1,id FROM roles WHERE code='customer'", [rows[0].id]);
    return { ...rows[0], role: 'customer' };
  });
  await startSession(res,user.id);
  res.status(201).json({ data: publicUser(user) });
});
auth.post('/login', authLimit, async (req,res) => {
  const data = z.object({ email: emailSchema, password: z.string() }).strict().parse(req.body);
  const { rows } = await pool.query(`${userSelect} WHERE lower(u.email)=$1 AND u.is_active`, [data.email]);
  if (!rows[0] || !(await verifyPassword(data.password,rows[0].password_hash))) throw new HttpError(401,'Невірна адреса або пароль.','INVALID_CREDENTIALS');
  await startSession(res,rows[0].id);
  res.json({ data: publicUser(rows[0]) });
});
auth.post('/logout', async (req,res) => { await endSession(req,res); res.status(204).end(); });
auth.get('/me', requireRole(), (req,res) => res.json({ data: publicUser(req.user) }));
app.use('/api/auth',auth);
app.use('/api',attachUser,productRouter,orderRouter);
app.use('/api/admin',attachUser,analyticsRouter,adminProductRouter,adminOrderRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Маршрут API не знайдено.', 'NOT_FOUND')));
if (process.env.SERVE_CLIENT === '1') {
  const clientDirectory = resolve(import.meta.dirname,'../../dist');
  if (!existsSync(resolve(clientDirectory,'index.html'))) throw new Error('Client build not found. Run npm run build in the project root.');
  app.use(express.static(clientDirectory));
  app.get('/{*path}', (_req,res) => res.sendFile(resolve(clientDirectory,'index.html')));
}
app.use((_req,_res,next) => next(new HttpError(404,'Маршрут не знайдено.','NOT_FOUND')));
app.use(errorHandler);
