import { test } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { pool, transaction } from '../src/db.js';

const request = supertest(app);
test('database failures return actionable 503 errors with a request id and no raw database detail', async () => {
  const original = pool.query;
  try {
    for (const [pgCode, apiCode] of [['28P01', 'DB_AUTH_FAILED'], ['3D000', 'DB_NOT_FOUND'], ['42P01', 'DB_SCHEMA_MISSING'], ['ECONNREFUSED', 'DB_UNAVAILABLE']]) {
      pool.query = async () => { const error = new Error('private database details'); error.code = pgCode; throw error; };
      const response = await request.get('/api/products');
      assert.equal(response.status, 503);
      assert.equal(response.body.code, apiCode);
      assert.equal(response.body.requestId, response.headers['x-request-id']);
      assert.ok(!JSON.stringify(response.body).includes('private database details'));
    }
  } finally { pool.query = original; }
});

test('unknown API routes return JSON rather than the frontend page', async () => {
  const response = await request.get('/api/missing-route');
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'NOT_FOUND');
});

test('failed rollback preserves the original error and releases the connection', async () => {
  const original = pool.connect;
  const initial = new Error('original failure');
  let released = false;
  pool.connect = async () => ({ query: async (sql) => { if (sql === 'ROLLBACK') throw new Error('connection lost'); }, release: () => { released = true; } });
  try { await assert.rejects(transaction(async () => { throw initial; }), (error) => error === initial); }
  finally { pool.connect = original; }
  assert.equal(released, true);
});
