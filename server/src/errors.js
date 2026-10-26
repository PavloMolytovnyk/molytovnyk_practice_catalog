import { ZodError } from 'zod';
import { databaseFailure } from './db-errors.js';

export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(error, req, res, _next) {
  const failure = databaseFailure(error);
  if (failure) {
    console.error(JSON.stringify({ requestId: req.id, code: failure.code }));
    return res.status(503).json({ status: 503, ...failure, requestId: req.id });
  }
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    return res.status(400).json({ status: 400, code: 'INVALID_JSON', message: 'Некоректний формат запиту.' });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({ status: 400, code: 'VALIDATION_ERROR', message: 'Перевірте введені дані.', details: error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ status: error.status, code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) });
  }
  if (error?.code === '23505') return res.status(409).json({ status: 409, code: 'DUPLICATE', message: 'Такий запис уже існує.' });
  if (error?.code === '23503' || error?.code === '23514') return res.status(409).json({ status: 409, code: 'CONSTRAINT', message: 'Дані суперечать обмеженням бази.' });
  console.error(JSON.stringify({ requestId: req.id, error: error?.stack || String(error) }));
  return res.status(500).json({ status: 500, code: 'INTERNAL_ERROR', message: 'Сталася помилка сервера.', requestId: req.id });
}
