import { checkDatabase, databaseTarget, pool } from './db.js';
import { databaseFailure } from './db-errors.js';

try {
  console.log('Database target:', JSON.stringify(databaseTarget()));
  const connection = await checkDatabase({ schema: true });
  console.log(`PostgreSQL OK: database=${connection.database}, user=${connection.username}; application tables found.`);
} catch (error) {
  console.error(databaseFailure(error)?.message || error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
