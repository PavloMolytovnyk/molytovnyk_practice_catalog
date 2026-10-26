import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

// Resolve from this module, not from the terminal's working directory.
export const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) {
  const values = parseEnv(readFileSync(envPath, 'utf8'));
  const conflicts = Object.keys(values).filter((key) =>
    /^(DATABASE_URL|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PORT|FRONTEND_ORIGIN|SERVE_CLIENT)$/.test(key)
    && process.env[key] !== undefined && process.env[key] !== values[key]);
  if (conflicts.length) console.warn(`System environment overrides server/.env: ${conflicts.join(', ')}. Remove those system variables or update them. Values are not logged.`);
  loadEnvFile(envPath);
}
