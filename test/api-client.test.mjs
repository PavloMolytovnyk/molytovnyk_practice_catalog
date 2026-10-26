import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { api, ApiError, loadInitialState } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
globalThis.window = { setTimeout, clearTimeout };
afterEach(() => { globalThis.fetch = originalFetch; globalThis.window = { setTimeout, clearTimeout }; });
process.on('exit', () => { globalThis.window = originalWindow; });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'test-request-id' } });

test('preserves database failure message, code, status and request id', async () => {
  globalThis.fetch = async () => response({ message: 'PostgreSQL відхилив облікові дані API.', code: 'DB_AUTH_FAILED' }, 503);
  await assert.rejects(api.products(), (error) => error instanceof ApiError && error.status === 503 && error.code === 'DB_AUTH_FAILED' && error.requestId === 'test-request-id' && /PostgreSQL/.test(error.message));
});

test('handles stopped API, proxy error and an HTML response without treating them as a catalog', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(api.products(), (error) => error.code === 'NETWORK');
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(api.products(), (error) => error.code === 'API_UNAVAILABLE');
  globalThis.fetch = async () => new Response('<html>frontend</html>', { status: 200 });
  await assert.rejects(api.products(), (error) => error.code === 'INVALID_RESPONSE');
});

test('times out a stalled request', async () => {
  globalThis.window = { setTimeout: (fn) => { queueMicrotask(fn); return 0; }, clearTimeout: () => {} };
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  await assert.rejects(api.products(), (error) => error.code === 'TIMEOUT');
});

test('catalog pagination loads all items and preserves same-origin cookies', async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(options.credentials, 'same-origin');
    assert.ok(String(url).includes(`page=${calls}`));
    return response({ data: [{ id: String(calls) }], meta: { page: calls, limit: 100, total: 2 } });
  };
  assert.deepEqual(await api.products(), [{ id: '1' }, { id: '2' }]);
  assert.equal(calls, 2);
});

test('StrictMode shares in-flight initial requests; retry makes fresh requests after failure', async () => {
  let calls = 0;
  const pending = [];
  globalThis.fetch = (url) => { calls += 1; return new Promise((resolve) => pending.push({ url, resolve })); };
  const first = loadInitialState();
  const second = loadInitialState();
  assert.equal(first, second);
  assert.equal(calls, 2);
  for (const item of pending) item.resolve(response({ message: 'БД недоступна', code: 'DB_UNAVAILABLE' }, 503));
  const failures = await first;
  assert.ok(failures.every((result) => result.status === 'rejected'));
  globalThis.fetch = async (url) => {
    calls += 1;
    return String(url).includes('/products') ? response({ data: [{ id: 'recovered' }], meta: { total: 1 } }) : response({ code: 'UNAUTHENTICATED' }, 401);
  };
  const retried = await loadInitialState();
  assert.equal(calls, 4);
  assert.equal(retried[0].status, 'fulfilled');
  assert.deepEqual(retried[0].value, [{ id: 'recovered' }]);
  assert.equal(retried[1].reason.status, 401);
});

test('logout accepts empty 204 response; login sends JSON', async () => {
  globalThis.fetch = async (_url, options) => { assert.equal(options.method, 'POST'); return new Response(null, { status: 204 }); };
  assert.equal(await api.logout(), undefined);
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(JSON.parse(options.body), { email: 'user@example.com', password: 'secret' });
    return response({ data: { id: 'user' } });
  };
  assert.deepEqual(await api.login('user@example.com', 'secret'), { id: 'user' });
});

test('analytics sends the selected period and cancels a superseded request', async () => {
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url,'/api/admin/analytics?days=90');
    assert.equal(options.credentials,'same-origin');
    return new Promise((_resolve,reject) => options.signal.addEventListener('abort',() => reject(new Error('aborted')),{once:true}));
  };
  const result = api.analytics(90,controller.signal);
  controller.abort();
  await assert.rejects(result,(error) => error instanceof ApiError && error.status === 0);
  globalThis.fetch = async (url) => {
    assert.equal(url,'/api/admin/analytics?days=7');
    return response({data:{summary:{units:3}}});
  };
  assert.deepEqual(await api.analytics(7),{summary:{units:3}});
});
