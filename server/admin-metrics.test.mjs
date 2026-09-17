import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMetrics, canViewMetrics } from './admin-metrics.mjs';

const now = Date.parse('2026-09-17T12:00:00Z');
test('only the configured personal owner can view metrics; fail closed', () => {
  assert.equal(canViewMetrics('owner', undefined), false);
  assert.equal(canViewMetrics('adm', 'adm'), false);
  assert.equal(canViewMetrics('other', 'owner'), false);
  assert.equal(canViewMetrics('owner', 'owner'), true);
});
test('excludes demo and keeps missing metrics out rather than fabricating them', () => {
  const result = aggregateMetrics([{ username:'adm',created_at:now },{username:'owner',created_at:now}], [], now);
  assert.equal(result.newAccounts,1); assert.equal(result.totalAccounts,1);
  assert.equal(result.games,0); assert.equal(result.daily.length,30);
  assert.equal(JSON.stringify(result).includes('owner'),false);
});
test('counts active accounts once, skips corrupted saves and sums season games', () => {
  const state = JSON.stringify({player:{position:'QB'},stage:'high_school',currentSeasonGameStats:[{}],statHistory:[{gamesPlayed:10}]});
  const careers = [{user_id:'owner',updated_at:now,state_json:state},{user_id:'owner',updated_at:now,state_json:state},{user_id:'adm',updated_at:now,state_json:state},{user_id:'owner',updated_at:now,state_json:'broken'}];
  const result=aggregateMetrics([{username:'owner',created_at:now},{username:'adm',created_at:now}],careers,now);
  assert.equal(result.activeAccounts,1);assert.equal(result.games,22);assert.equal(result.savedCareers,2);assert.equal(result.invalidSaves,1);
});
test('uses exact UTC window boundaries and separates the previous period', () => {
  const start=Date.parse('2026-08-19T00:00:00Z');
  const result=aggregateMetrics([{username:'a',created_at:start},{username:'b',created_at:start-1},{username:'c',created_at:now+1}],[],now);
  assert.equal(result.newAccounts,1);assert.equal(result.previousAccounts,1);assert.equal(result.daily[0].accounts,1);
});
