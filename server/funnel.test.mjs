import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validClientSignal, funnelSummary } from './funnel.mjs';
test('accepts only anonymous allowlisted single-field signals', () => {
  assert.equal(validClientSignal({event:'landing_opened'}),true);
  assert.equal(validClientSignal({event:'register_created'}),false);
  assert.equal(validClientSignal({event:'register_opened',username:'private'}),false);
  assert.equal(validClientSignal({event:'register_opened',password:'private'}),false);
  assert.equal(validClientSignal({event:'arbitrary text'}),false);
});
test('sums only the provided daily totals without inventing historical data', () => {
  const result=funnelSummary([{event:'register_opened',count:2},{event:'register_opened',count:3},{event:'register_created',count:1}], '2026-09-18');
  assert.equal(result.counts.register_opened,5);
  assert.equal(result.counts.register_created,1);
  assert.equal(result.counts.landing_opened,undefined);
});
