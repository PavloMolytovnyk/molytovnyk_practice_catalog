import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { databaseOptions, assertDatabaseConfigured } from '../src/db-config.js';

function cleanEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PG|DATABASE_URL$|PORT$|SERVE_CLIENT$)/.test(key)));
}

test('separate PG variables preserve special password characters and validate the port', () => {
  const env = { PGHOST: 'localhost', PGPORT: '5432', PGDATABASE: 'forma_store', PGUSER: 'postgres', PGPASSWORD: 'p@ss:#/ ?%$' };
  const options = databaseOptions(env);
  assert.equal(options.password, env.PGPASSWORD);
  assert.equal(options.port, 5432);
  assert.equal(options.user, 'postgres');
  assert.doesNotThrow(() => assertDatabaseConfigured(env));
  assert.throws(() => databaseOptions({ ...env, PGPORT: 'abc' }), /PGPORT/);
  assert.throws(() => databaseOptions({ ...env, PGPORT: '70000' }), /PGPORT/);
  assert.throws(() => assertDatabaseConfigured({}), /server\/.env/);
});

test('URL works by itself; mixed or malformed connection settings are rejected without exposing secrets', () => {
  const url = 'postgresql://postgres:secret%40password@localhost:5432/forma_store';
  assert.equal(databaseOptions({ DATABASE_URL: url }).connectionString, url);
  assert.throws(() => databaseOptions({ DATABASE_URL: url, PGPASSWORD: 'different-secret' }), (error) => !error.message.includes('secret') && /either DATABASE_URL/.test(error.message));
  assert.throws(() => databaseOptions({ DATABASE_URL: 'not-a-url' }), /Invalid DATABASE_URL/);
  assert.throws(() => databaseOptions({ DATABASE_URL: 'https://localhost/db' }), /postgresql/);
});

test('server/.env loads from its own path, and external overrides emit only key names', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'forma-config-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await mkdir(join(fixture, 'server', 'src'), { recursive: true });
  await copyFile(new URL('../src/config.js', import.meta.url), join(fixture, 'server', 'src', 'config.mjs'));
  await writeFile(join(fixture, 'server', '.env'), 'PGHOST=localhost\nPGPORT=5432\nPGUSER=postgres\nPGDATABASE=forma_store\nPGPASSWORD="p@ss #/?%$"\n');
  const moduleUrl = pathToFileURL(join(fixture, 'server', 'src', 'config.mjs')).href;
  const code = `await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify({ password: process.env.PGPASSWORD, user: process.env.PGUSER }));`;
  const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: tmpdir(), env: cleanEnv(), encoding: 'utf8' });
  assert.equal(loaded.status, 0, loaded.stderr);
  assert.deepEqual(JSON.parse(loaded.stdout), { password: 'p@ss #/?%$', user: 'postgres' });
  const override = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: tmpdir(), env: { ...cleanEnv(), PGPASSWORD: 'system-secret' }, encoding: 'utf8' });
  assert.equal(JSON.parse(override.stdout).password, 'system-secret');
  assert.match(override.stderr, /overrides server\/\.env: PGPASSWORD/);
  assert.ok(!override.stderr.includes('system-secret'));
  assert.ok(!override.stderr.includes('p@ss'));
});

test('real pg driver receives password rejection: API exits before listening and does not log secrets', async (t) => {
  // A minimal PostgreSQL wire server sends SQLSTATE 28P01 to exercise pg itself.
  const server = createServer((socket) => socket.once('data', () => {
    const fields = Buffer.from('SFATAL\0C28P01\0Mpassword authentication failed: private-test-secret\0\0');
    const packet = Buffer.alloc(5 + fields.length);
    packet[0] = 69; // ErrorResponse
    packet.writeInt32BE(4 + fields.length, 1);
    fields.copy(packet, 5);
    socket.end(packet);
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const fixture = await mkdtemp(join(tmpdir(), 'forma-startup-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await cp(new URL('../src/', import.meta.url), join(fixture, 'src'), { recursive: true });
  await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
  await symlink(fileURLToPath(new URL('../node_modules/', import.meta.url)), join(fixture, 'node_modules'), 'junction');
  const env = { ...cleanEnv(), PGHOST: '127.0.0.1', PGPORT: String(server.address().port), PGUSER: 'postgres', PGDATABASE: 'forma_store', PGPASSWORD: 'private-test-secret' };
  const child = spawn(process.execPath, ['src/index.js'], { cwd: fixture, env });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const [exitCode] = await once(child, 'close');
  assert.equal(exitCode, 1, output);
  assert.match(output, /PostgreSQL відхилив/);
  assert.ok(!output.includes('FORMA API listening'));
  assert.ok(!output.includes('private-test-secret'));
  assert.match(output, /"user":"postgres"/);
});
