import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setupDatabase } from '../src/setup-database.js';

test('FORMA schema does not conflict with an older public products table and is repeatable', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('CREATE TABLE public.products (id integer PRIMARY KEY, title text NOT NULL); INSERT INTO public.products VALUES (1, \'legacy product\');');
  const database = {
    query: (sql, params) => params ? db.query(sql, params) : db.exec(sql).then(() => ({ rows: [] })),
  };
  const environment = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'strong-admin-password' };
  await setupDatabase(database, environment);
  await setupDatabase(database, environment);
  const tables = await db.query("SELECT n.nspname AS schema, c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND ((n.nspname='public' AND c.relname='products') OR (n.nspname='forma' AND c.relname IN ('products','orders'))) ORDER BY 1,2");
  assert.deepEqual(tables.rows, [
    { schema: 'forma', table_name: 'orders' },
    { schema: 'forma', table_name: 'products' },
    { schema: 'public', table_name: 'products' },
  ]);
  const legacy = await db.query('SELECT title FROM public.products WHERE id=1');
  assert.equal(legacy.rows[0].title, 'legacy product');
  const path = await db.query('SHOW search_path');
  assert.match(path.rows[0].search_path, /forma/);
  const seeded = await db.query("SELECT (SELECT count(*)::int FROM forma.products) AS products, (SELECT count(*)::int FROM forma.users) AS users, (SELECT count(*)::int FROM forma.user_roles) AS user_roles");
  assert.deepEqual(seeded.rows[0], { products: 8, users: 1, user_roles: 1 });
});
