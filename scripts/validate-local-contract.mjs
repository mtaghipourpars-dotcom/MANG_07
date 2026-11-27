import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const registry = JSON.parse(read('DEV/local/contracts.json'));
const api = JSON.parse(read('DEV/api-contract.json'));
const owners = Object.keys(registry.owners);
const gates = new Set();
for (const gate of registry.gates) {
  assert(!gates.has(gate.id), 'Duplicate gate ' + gate.id);
  assert(owners.includes(gate.owner), 'Unknown owner for ' + gate.id);
  assert(gate.needs.every(dependency => gates.has(dependency)), 'Unresolved gate dependency ' + gate.id);
  gates.add(gate.id);
}
assert.deepEqual([...gates], ['G0', 'G1', 'G2', 'G3', 'G4', 'G5']);
for (const item of registry.interfaces) {
  assert(owners.includes(item.producer) && owners.includes(item.consumer), 'Unknown interface owner');
  assert(existsSync(new URL(item.source, root)), 'Missing interface source ' + item.source);
  if (item.basePath) assert(read('server.js').includes(item.basePath), 'Unset HTTP mount');
}
const signatures = api.routes.map(route => route.method + ' ' + route.path);
assert.equal(signatures.length, new Set(signatures).size, 'Duplicate API route');
console.log('Local contract registry passed: ' + gates.size + ' ordered gates, ' + signatures.length + ' API routes.');
