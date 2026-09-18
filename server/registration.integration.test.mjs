import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';

// Execute the actual Worker handlers against isolated, in-memory SQLite.
// No production accounts or credentials are used.
let source = await readFile(new URL('../worker.mjs', import.meta.url), 'utf8');
source = source.replace('import { DurableObject } from "cloudflare:workers";', 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
for (const name of ['admin-metrics', 'admin-dashboard', 'funnel']) source = source.replace(`"./server/${name}.mjs"`, JSON.stringify(new URL(`./${name}.mjs`, import.meta.url).href));
const { AccountStore } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function store() {
  const db = new DatabaseSync(':memory:');
  const ctx = { storage: { sql: { exec: (query, ...args) => db.prepare(query).all(...args) } }, blockConcurrencyWhile: fn => fn() };
  return new AccountStore(ctx, {ADMIN_USERNAME:'owner'});
}
function request(path, body, cookie) {
  return new Request(`https://test.invalid${path}`, { method:body ? 'POST':'GET', headers:{'content-type':'application/json', ...(cookie ? {cookie}: {})}, ...(body ? {body:JSON.stringify(body)}:{}) });
}
test('registration creates a server account, authenticates and survives session reopening', async () => {
  const server=store();
  const response=await server.fetch(request('/api/auth/register',{username:'owner',password:'test-only-password'}));
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const reopened=await server.fetch(request('/api/auth/session',null,cookie));
  assert.equal((await reopened.json()).user.username,'owner');
  const metrics=await server.fetch(request('/api/admin/metrics',null,cookie));
  const snapshot=await metrics.json();
  assert.equal(snapshot.totalAccounts,1);
  assert.equal(snapshot.funnel.counts.register_created,1);
  assert.equal(JSON.stringify(snapshot).includes('test-only-password'),false);
});
test('duplicate simultaneous submissions yield one account, not an unhandled server error', async () => {
  const server=store();
  const responses=await Promise.all([1,2].map(()=>server.fetch(request('/api/auth/register',{username:'sameuser',password:'test-only-password'}))));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
});
test('invalid registration is counted without creating an account and normal users cannot read metrics', async () => {
  const server=store();
  const invalid=await server.fetch(request('/api/auth/register',{username:'player',password:'short'}));
  assert.equal(invalid.status,400);
  const response=await server.fetch(request('/api/auth/register',{username:'player',password:'test-only-password'}));
  const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await server.fetch(request('/api/admin/metrics',null,cookie))).status,403);
  assert.equal((await server.fetch(request('/api/admin/metrics'))).status,401);
});
