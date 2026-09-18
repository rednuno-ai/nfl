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

test('active time requires authentication, is bounded and does not double count tabs', async () => {
  const server=store();
  const response=await server.fetch(request('/api/auth/register',{username:'owner',password:'test-only-password'}));
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const tick=(seconds, extra={})=>server.fetch(new Request('https://test.invalid/api/playtime',{method:'POST',headers:{cookie,origin:'https://test.invalid','content-type':'application/json',...extra},body:JSON.stringify({seconds})}));
  assert.equal((await server.fetch(request('/api/playtime',{seconds:15}))).status,401);
  assert.equal((await tick(-1)).status,400);
  assert.equal((await tick(300)).status,400);
  assert.equal((await tick(15,{origin:'https://other.invalid'})).status,403);
  await tick(15);
  assert.equal(server.one('SELECT seconds FROM playtime WHERE username=?','owner').seconds,0);
  server.ctx.storage.sql.exec('UPDATE playtime SET last_tick=? WHERE username=?',Date.now()-15000,'owner');
  await Promise.all([tick(15),tick(15)]);
  assert.equal(server.one('SELECT seconds FROM playtime WHERE username=?','owner').seconds,15);
  server.ctx.storage.sql.exec('UPDATE playtime SET last_tick=? WHERE username=?',Date.now()-120000,'owner');
  await tick(30);
  await tick(15,{'dnt':'1'});
  assert.equal(server.one('SELECT seconds FROM playtime WHERE username=?','owner').seconds,15);
  const metrics=await (await server.fetch(request('/api/admin/metrics',null,cookie))).json();
  assert.equal(metrics.playtime.accounts[0].seconds,15);
  assert.ok(metrics.playtime.startedAt);
});
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
