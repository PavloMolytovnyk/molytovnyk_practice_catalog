export function databaseOptions(env = process.env) {
  // Keep FORMA tables isolated from unrelated or older tables in public.
  const options = { max: 10, connectionTimeoutMillis: 5000, options: '-c search_path=forma,public' };
  const url = env.DATABASE_URL?.trim();
  const pgKeys = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
  if (url) {
    if (pgKeys.some((key) => env[key] !== undefined)) {
      throw new Error('Use either DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD. Remove the other settings, including system environment variables.');
    }
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Invalid DATABASE_URL. Use separate PG* variables for passwords with special characters.'); }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length < 2) {
      throw new Error('DATABASE_URL must be postgresql://user:password@host:port/database.');
    }
    return { ...options, connectionString: url };
  }
  const port = Number(env.PGPORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PGPORT must be an integer between 1 and 65535.');
  return { ...options, host: env.PGHOST || 'localhost', port, database: env.PGDATABASE, user: env.PGUSER, password: env.PGPASSWORD };
}

export function assertDatabaseConfigured(env = process.env) {
  if (!env.DATABASE_URL?.trim() && !(env.PGHOST && env.PGDATABASE && env.PGUSER)) {
    throw new Error('Configure server/.env: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (or DATABASE_URL). Copy server/.env.example and enter your PostgreSQL credentials.');
  }
}
