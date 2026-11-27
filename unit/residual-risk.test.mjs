import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRemainingRisk } from '../server/residual-risk.js';

// Generic relative-day fixtures are scoped to this test and never seed the demo.
const row = (node, observed, baseline = 2) => ({ node, observed, baseline });
for (const [name, option, effects, expected] of [
  ['late donor', 'transfer', [row('delivery', 2), row('donor_delivery', 3)], 'LATE_REALIZED'],
  ['on-time donor', 'transfer', [row('delivery', 2), row('donor_delivery', 2)], 'MET_VERIFIED'],
  ['missing donor', 'transfer', [row('delivery', 2)], 'UNVERIFIED_OPEN'],
  ['missing donor evidence', 'transfer', [row('delivery', 2), row('donor_delivery', null)], 'UNVERIFIED_OPEN'],
  ['missing primary evidence', 'transfer', [row('donor_delivery', 2)], 'UNVERIFIED_OPEN'],
  ['unknown baseline', 'alternate', [row('delivery', 2, null)], 'UNVERIFIED_OPEN'],
  ['irrelevant donor', 'alternate', [row('delivery', 2), row('donor_delivery', null)], 'MET_VERIFIED'],
  ['known delay with other unknown', 'transfer', [row('delivery', 3), row('donor_delivery', null)], 'LATE_REALIZED']
]) {
  test(name, () => assert.equal(computeRemainingRisk({ option }, [{ effects }]), expected));
}

test('no observation leaves risk open', () => {
  assert.equal(computeRemainingRisk({ option: 'alternate' }, []), 'UNVERIFIED_OPEN');
});

test('uses the latest observation without borrowing prior evidence', () => {
  assert.equal(computeRemainingRisk({ option: 'alternate' }, [
    { effects: [row('delivery', 2)] },
    { effects: [row('delivery', null)] }
  ]), 'UNVERIFIED_OPEN');
});
