import { checkDatabase, pool } from './db.js';
import { databaseFailure } from './db-errors.js';
import { setupDatabase } from './setup-database.js';

let stage = 'перевірка підключення';
try {
  await checkDatabase();
  await setupDatabase(pool, process.env, (value) => { stage = value; });
  await checkDatabase({ schema: true });
  console.log('Schema and seed are ready.');
} catch (error) {
  const connectionFailure = databaseFailure(error);
  const connectionCodes = new Set(['DB_AUTH_FAILED', 'DB_NOT_FOUND', 'DB_UNAVAILABLE']);
  if (connectionFailure && connectionCodes.has(connectionFailure.code)) {
    console.error('Setup failed:', connectionFailure.message);
  } else {
    // setup is the operation that creates the schema, so telling the user to
    // run setup again hides the real SQL error and creates a circular message.
    console.error(`Setup failed during ${stage}.`);
    console.error(`PostgreSQL ${error.code ? `[${error.code}] ` : ''}${error.message || String(error)}`);
    if (error.detail) console.error(`Details: ${error.detail}`);
    if (error.hint) console.error(`Hint: ${error.hint}`);
  }
  process.exitCode = 1;
} finally { await pool.end(); }
