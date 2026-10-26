import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { pool } from './db.js';
import { HttpError } from './errors.js';

const scrypt = promisify(scryptCallback);
const cookieName = 'forma_session';
const lifetime = 7 * 24 * 60 * 60 * 1000;
export const emailSchema = z.email().max(254).transform((value) => value.trim().toLowerCase());
export const passwordSchema = z.string().min(10).max(128);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [method, salt, expectedHex] = stored?.split(':') ?? [];
  if (method !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, expected);
}

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export const publicUser = (user) => ({ id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role });

export const userSelect = `SELECT u.*, (SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id ORDER BY CASE r.code WHEN 'admin' THEN 1 WHEN 'order_manager' THEN 2 WHEN 'catalog_manager' THEN 3 ELSE 4 END LIMIT 1) AS role FROM users u`;

export async function startSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [tokenHash(token), userId, new Date(Date.now() + lifetime)]);
  res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: lifetime });
}

export async function attachUser(req, _res, next) {
  try {
    const token = req.cookies?.[cookieName];
    if (token) {
      const { rows } = await pool.query(`${userSelect} JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at > now() AND u.is_active`, [tokenHash(token)]);
      req.user = rows[0] ?? null;
    } else req.user = null;
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Увійдіть у свій обліковий запис.', 'UNAUTHENTICATED'));
    if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'Недостатньо прав доступу.', 'FORBIDDEN'));
    next();
  };
}

export async function endSession(req, res) {
  const token = req.cookies?.[cookieName];
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
  res.clearCookie(cookieName, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
}
