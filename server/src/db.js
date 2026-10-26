import './config.js';
import pg from 'pg';
import { assertDatabaseConfigured, databaseOptions } from './db-config.js';
import { databaseFailure } from './db-errors.js';

export const pool = new pg.Pool(databaseOptions());
pool.on('error', (error) => {
  const failure = databaseFailure(error);
  console.error(JSON.stringify({ code: failure?.code || 'DB_POOL_ERROR', message: failure?.message || 'Idle PostgreSQL connection failed.' }));
});

export function databaseTarget() {
  const { host, port, database, user } = new pg.Client(pool.options).connectionParameters;
  return { host, port, database, user }; // Never return passwords or the connection URL.
}

export async function checkDatabase({ schema = false } = {}) {
  assertDatabaseConfigured();
  const { rows } = await pool.query('SELECT current_database() AS database, current_user AS username');
  if (schema) {
    const result = await pool.query("SELECT to_regclass('forma.products') AS products, to_regclass('forma.categories') AS categories, to_regclass('forma.users') AS users, to_regclass('forma.roles') AS roles, to_regclass('forma.sessions') AS sessions, to_regclass('forma.orders') AS orders");
    if (Object.values(result.rows[0]).some((value) => value == null)) {
      const error = new Error('Database schema missing');
      error.code = '42P01';
      throw error;
    }
  }
  return rows[0];
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original error if the connection is lost. */ }
    throw error;
  } finally {
    client.release();
  }
}
