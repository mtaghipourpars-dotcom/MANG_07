import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync(new URL('technical-spec.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);
const knownStages = new Set();
for (const stage of spec.stages) {
  assert(!knownStages.has(stage.id), 'Duplicate stage: ' + stage.id);
  for (const dependency of stage.dependsOn) {
    assert(knownStages.has(dependency), 'Missing or forward dependency: ' + dependency);
  }
  assert(stage.checks.length > 0 && new Set(stage.checks).size === stage.checks.length, 'Invalid checks: ' + stage.id);
  knownStages.add(stage.id);
}
for (const path of [...spec.contracts, spec.apiContract, ...spec.data.approvedBootstrapFiles, ...spec.data.scenarioEvidence, spec.interface.homeReference, spec.data.scenarioBuilder]) {
  assert(existsSync(new URL(path, root)), 'Missing referenced file: ' + path);
}
assert.equal(spec.data.runtimeAuthority, 'SQLite');
assert.equal(spec.data.allowGeneratedBusinessRecords, false);
assert.equal(spec.data.allowSeedFromNarrative, false);
assert.equal(spec.data.missingValue, null);
assert.deepEqual(spec.interface.locales, { fa: 'rtl', en: 'ltr' });
assert.deepEqual(spec.interface.themes, ['light', 'dark']);
assert.equal(new Set(spec.interface.workspaces.map(({ id }) => id)).size, 4);
assert.equal(new Set(spec.interface.workspaces.map(({ level }) => level)).size, 3);
const api = JSON.parse(readFileSync(new URL(spec.apiContract, root), 'utf8'));
assert.equal(api.scenarioStorage.env, spec.data.scenarioDatabaseEnv);
assert.equal(api.workflowStorage.env, spec.data.workspaceDatabaseEnv);
assert.equal(api.workflow.actorsAreDemoRoles, true);
assert.equal(api.recorderPolicy, 'SERVER_DERIVED_NEVER_TRUST_CLIENT');
assert.equal(api.clockPolicy, 'SERVER_CONTROLLED_SIMULATION_CLOCK');
assert.equal(api.enterpriseAuthStatus, 'BLOCKED_INTERNAL_SOURCE_REQUIRED');
const routeKeys = new Set(api.routes.map(route => route.method + ' ' + route.path));
assert.equal(routeKeys.size, api.routes.length);
for (const requiredRoute of [
  'GET /summary',
  'GET /scenarios',
  'GET /scenarios/:id',
  'GET /executive',
  'GET /finance/trace',
  'POST /finance/verify-posting',
  'GET /governance/queue',
  'POST /governance/evaluate',
  'GET /cases/:id/links',
  'POST /cases/:id/links',
  'GET /commitments/:commitmentId/links',
  'GET /issues/:id/commitments',
  'GET /clock',
  'POST /clock/advance',
  'GET /reservations',
  'POST /cases/:id/reservations',
  'POST /cases/:id/actions',
  'POST /cases/:id/verifications',
  'GET /lessons',
  'POST /cases/:id/lessons',
]) {
  assert(routeKeys.has(requiredRoute), 'Missing contract route: ' + requiredRoute);
}
const actionRoute = api.routes.find(r => r.method === 'POST' && r.path === '/cases/:id/actions');
assert(actionRoute.forbiddenBodyFields.includes('recorder'), 'Actions route must forbid client recorder');
const reserveRoute = api.routes.find(r => r.method === 'POST' && r.path === '/cases/:id/reservations');
assert(reserveRoute.forbiddenBodyFields.includes('now'), 'Reservations route must forbid client now');
const workflowStates = new Set([api.workflow.initial.status]);
for (const transition of api.workflow.transitions) {
  assert(workflowStates.has(transition.from), 'Unreachable transition: ' + transition.from);
  workflowStates.add(transition.to);
}
console.log('DEV specification passed: ' + knownStages.size + ' stages, 4 workspaces, ' + api.routes.length + ' contracted routes, database-only runtime source.');
