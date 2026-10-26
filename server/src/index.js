import { app } from './app.js';
import { checkDatabase, databaseTarget, pool } from './db.js';
import { databaseFailure } from './db-errors.js';

const port = Number(process.env.PORT || 4000);
try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  await checkDatabase({ schema: true });
  console.log('PostgreSQL connected:', JSON.stringify(databaseTarget()));
  const server = app.listen(port, '0.0.0.0', () => console.log(`FORMA API listening on ${port}`));
  server.on('error', async (error) => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the other API process or change PORT and API_PROXY_TARGET.` : 'API could not start.');
    await pool.end();
    process.exitCode = 1;
  });
  const shutdown = () => server.close(async () => { await pool.end(); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('FORMA API startup failed:', databaseFailure(error)?.message || error.message);
  console.error('Database target:', JSON.stringify(databaseTarget()));
  await pool.end();
  process.exitCode = 1;
}
