import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { computeRiskBreakdown } from '../../server/total-demo.js';
import { openWorkspaceDb } from '../../server/workspace-db.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const seeds = {
  fixture: path.join(rootDir, 'data', 'product-project-fixture.json'),
  reference: path.join(rootDir, 'data', 'reference-datasets.json'),
};

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(err => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForHealth(origin, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(origin + '/api/health');
      if (res.status === 200) return true;
    } catch {
      // Server still booting or building bank.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

test('R5 & R16: legacy v3 SQLite workspace DB migrates cleanly to v5 preserving legacy cases/lessons, approvals, observations, and enabling shared portfolios', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pvpt-migrate-v3-'));
  const dbPath = path.join(dir, 'legacy-v3.sqlite');
  try {
    // 1. Seed a genuine schema v3 database (pre-R5/R9/R16 v4/v5 tables)
    const raw = new DatabaseSync(dbPath);
    raw.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE workspace_sections (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK(name IN ('legacy', 'cases', 'preferences')),
        revision INTEGER NOT NULL CHECK(revision > 0),
        value TEXT NOT NULL CHECK(json_valid(value)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, name)
      ) STRICT;
      CREATE TABLE workspace_changes (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK(name IN ('legacy', 'cases', 'preferences')),
        revision INTEGER NOT NULL CHECK(revision > 0),
        changed_at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, name, revision)
      ) STRICT;
      CREATE TABLE reference_datasets (
        name TEXT PRIMARY KEY,
        seed_digest TEXT NOT NULL,
        value TEXT NOT NULL CHECK(json_valid(value))
      ) STRICT;
      CREATE TABLE total_demo_actions (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        scenario_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK(revision > 0),
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, scenario_id, revision)
      ) STRICT;
      CREATE TABLE total_demo_approvals (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        scenario_id TEXT NOT NULL,
        decision_revision INTEGER NOT NULL CHECK(decision_revision > 0),
        source TEXT NOT NULL,
        actor TEXT NOT NULL,
        option_code TEXT NOT NULL,
        reason TEXT NOT NULL,
        approved_effects TEXT NOT NULL CHECK(json_valid(approved_effects)),
        at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, scenario_id, decision_revision)
      ) STRICT;
      CREATE TABLE total_demo_observations (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        scenario_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK(revision > 0),
        decision_revision INTEGER NOT NULL CHECK(decision_revision > 0),
        actor TEXT NOT NULL,
        verifier TEXT,
        outcome TEXT NOT NULL,
        observed_effects TEXT NOT NULL CHECK(json_valid(observed_effects)),
        reason TEXT NOT NULL,
        at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, scenario_id, revision),
        FOREIGN KEY(workspace_id, scenario_id, decision_revision)
          REFERENCES total_demo_approvals(workspace_id, scenario_id, decision_revision)
      ) STRICT;
      CREATE TABLE total_demo_reservations (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        scenario_id TEXT NOT NULL,
        decision_revision INTEGER NOT NULL CHECK(decision_revision > 0),
        resource TEXT NOT NULL,
        owner TEXT NOT NULL,
        order_id TEXT NOT NULL,
        start_min INTEGER NOT NULL,
        end_min INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        recorded_at INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        CHECK(start_min < end_min),
        CHECK(expires_at > recorded_at),
        PRIMARY KEY(workspace_id, id),
        FOREIGN KEY(workspace_id, scenario_id, decision_revision)
          REFERENCES total_demo_approvals(workspace_id, scenario_id, decision_revision)
      ) STRICT;
      CREATE TABLE total_demo_reservation_attempts (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        scenario_id TEXT NOT NULL,
        decision_revision INTEGER,
        resource TEXT NOT NULL,
        owner TEXT NOT NULL,
        order_id TEXT NOT NULL,
        start_min INTEGER NOT NULL,
        end_min INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        recorded_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(workspace_id, id)
      ) STRICT;
      CREATE TABLE total_demo_reservation_conflicts (
        workspace_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        reservation_id TEXT NOT NULL,
        PRIMARY KEY(workspace_id, attempt_id, reservation_id),
        FOREIGN KEY(workspace_id, attempt_id) REFERENCES total_demo_reservation_attempts(workspace_id, id),
        FOREIGN KEY(workspace_id, reservation_id) REFERENCES total_demo_reservations(workspace_id, id)
      ) STRICT;
      PRAGMA user_version = 3;
    `);

    const ws1 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ws2 = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const legacyCases = [
      {
        id: 'CASE-LEGACY-01',
        title: 'Legacy workspace case with lessons',
        lessons: [
          {
            id: 'LEG-LES-01',
            summary: 'Legacy lesson preserved across schema v3 -> v5 migration',
            reuseCondition: 'Thermal drawing review delay',
          },
        ],
      },
    ];
    raw.prepare('INSERT INTO workspaces VALUES (?, ?)').run(ws1, '2026-01-01T00:00:00.000Z');
    raw.prepare('INSERT INTO workspaces VALUES (?, ?)').run(ws2, '2026-01-01T00:00:00.000Z');
    raw.prepare('INSERT INTO workspace_sections VALUES (?, ?, ?, ?, ?)').run(
      ws1, 'cases', 1, JSON.stringify(legacyCases), '2026-01-01T00:00:00.000Z'
    );
    raw.prepare('INSERT INTO total_demo_actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      ws1, 'S000013', 1, 'SRC-V3', 'APPROVE', 'DECIDER', 'APPROVED', 'Legacy v3 approval', '2026-01-01T00:00:00.000Z'
    );
    raw.prepare('INSERT INTO total_demo_approvals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      ws1, 'S000013', 1, 'SRC-V3', 'DECIDER', 'overtime', 'Legacy v3 approval',
      JSON.stringify([{ node: 'dispatch', baseline: 10, proposed: 11 }]), '2026-01-01T00:00:00.000Z'
    );
    raw.prepare('INSERT INTO total_demo_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      ws1, 'S000013', 2, 1, 'OWNER', 'REVIEWER', 'VERIFIED',
      JSON.stringify([{ node: 'dispatch', baseline: 10, observed: 11 }]), 'Legacy v3 observe', '2026-01-01T01:00:00.000Z'
    );
    raw.prepare('INSERT INTO total_demo_reservations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'RES-LEGACY-01', ws1, 'S000013', 1, 'drawing', 'OWNER', 'ORD-LEG-01', 600, 780, 1000, 0, '2026-01-01T00:10:00.000Z'
    );
    raw.prepare('INSERT INTO total_demo_approvals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      ws2, 'S000014', 1, 'SRC-V3', 'DECIDER', 'overtime', 'Session 2 approval',
      JSON.stringify([{ node: 'dispatch', baseline: 10, proposed: 11 }]), '2026-01-01T00:00:00.000Z'
    );
    raw.close();

    // 2. Open migrated DB via application storage engine
    const storage = openWorkspaceDb(dbPath, seeds);
    try {
      const checkDb = new DatabaseSync(dbPath, { readOnly: true });
      const version = checkDb.prepare('PRAGMA user_version').get().user_version;
      checkDb.close();
      assert.equal(version, 5, 'Legacy v3 DB must migrate to schema v5');

      // Legacy cases[].lessons intact
      const wsData = storage.readWorkspace(ws1);
      assert.equal(wsData.cases.length, 1);
      assert.equal(wsData.cases[0].lessons[0].id, 'LEG-LES-01');
      assert.equal(wsData.revisions.cases, 1);

      // Legacy approval, observation, and reservation intact with default portfolio_id
      const approval = storage.readTotalDemoApproval(ws1, 'S000013');
      assert.equal(approval.decisionRevision, 1);
      const observations = storage.readTotalDemoObservations(ws1, 'S000013');
      assert.equal(observations.length, 1);
      assert.equal(observations[0].sourceType, 'WORKSPACE_DEMO_OBSERVATION');

      // R5: New versioned many-to-many commitment link works on migrated DB
      const savedLink = storage.saveTotalDemoCommitmentLink(ws1, {
        scenarioId: 'S000013',
        commitmentId: 'PUB-THERMAL-MGG72-SH2::dispatch',
        issueId: 'S000013::engineering::drawing',
        optionId: 'S000013::overtime',
        effectType: 'DIRECT',
        reviewStatus: 'CONFIRMED',
        evidenceRef: 'DEMO-MIG-01',
        actor: 'OWNER',
      });
      assert.equal(savedLink.version, 1);

      // R16: Structured lesson works alongside legacy workspace lessons
      const savedLesson = storage.recordTotalDemoLesson(ws1, {
        scenarioId: 'S000013',
        anchor: 'PUB-THERMAL-MGG72-SH2',
        closureType: 'OUTCOME_BASED_LESSON',
        decisionRevision: 1,
        observationRevision: 2,
        evidenceRef: 'DEMO-MIG-01',
        reuseCondition: 'Migrated v3 -> v5 check',
        summary: 'Structured lesson saved after migration',
        actor: 'EXPERT',
      });
      assert.equal(savedLesson.closureType, 'OUTCOME_BASED_LESSON');
      assert.equal(storage.readTotalDemoLessons(ws1, { scenarioId: 'S000013' }).length, 1);

      // R9: Cross-workspace shared portfolio conflict against migrated v3 reservation!
      const conflictAttempt = storage.reserveTotalDemoCapacity(ws2, {
        portfolioId: 'DEMO-PORTFOLIO-MAIN',
        scenarioId: 'S000014',
        decisionRevision: 1,
        resource: 'drawing',
        owner: 'OWNER',
        orderId: 'ORD-S2-OVERLAP',
        start: 700,
        end: 820,
        expires: 1100,
      });
      assert.equal(conflictAttempt.status, 'BLOCKED_CONFLICT');
      assert.deepEqual(conflictAttempt.conflictingOrders, ['ORD-LEG-01']);
    } finally {
      storage.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('R10: computeRiskBreakdown preserves confirmed delay alongside unknown nodes, surfaces donor side-effects, and never marks incomplete/unverified observations MET_VERIFIED', () => {
  const baseEffects = [
    { node: 'engineering', baseline: 10, without_action: 14, proposed: 10, observed: 10 },
    { node: 'dispatch', baseline: 20, without_action: 25, proposed: 20, observed: 20 },
    { node: 'collection', baseline: 30, without_action: 35, proposed: 30, observed: 30 },
    { node: 'donor_delivery', baseline: 18, without_action: 18, proposed: 18, observed: 18 },
  ];

  // State 1A: All nodes on-time + independent verifier => MET_VERIFIED
  const metVerified = computeRiskBreakdown(baseEffects, [
    { revision: 6, verifier: 'REVIEWER', effects: baseEffects },
  ]);
  assert.equal(metVerified.primaryChainRiskStatus, 'MET_VERIFIED');
  assert.equal(metVerified.donorSideEffectRiskStatus, 'NO_DONOR_IMPACT');
  assert.equal(metVerified.remainingRiskStatus, 'MET_VERIFIED');
  assert.equal(metVerified.observedDelayConfirmed, false);
  assert.deepEqual(metVerified.unknownNodes, []);

  // State 1B: All nodes on-time WITHOUT independent verifier => UNVERIFIED_OPEN (never MET_VERIFIED)
  const unverifiedOnTime = computeRiskBreakdown(baseEffects, [
    { revision: 6, verifier: null, effects: baseEffects },
  ]);
  assert.equal(unverifiedOnTime.primaryChainRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(unverifiedOnTime.remainingRiskStatus, 'UNVERIFIED_OPEN');

  // State 1C: On-time nodes + one unknown node (null) even with verifier => UNVERIFIED_OPEN (never MET_VERIFIED)
  const onTimeWithUnknown = computeRiskBreakdown(baseEffects, [
    {
      revision: 6,
      verifier: 'REVIEWER',
      effects: [
        { node: 'engineering', baseline: 10, observed: 10 },
        { node: 'dispatch', baseline: 20, observed: 20 },
        { node: 'collection', baseline: 30, observed: null },
        { node: 'donor_delivery', baseline: 18, observed: 18 },
      ],
    },
  ]);
  assert.equal(onTimeWithUnknown.primaryChainRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(onTimeWithUnknown.remainingRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(onTimeWithUnknown.observedDelayConfirmed, false);
  assert.deepEqual(onTimeWithUnknown.unknownNodes, ['collection']);

  // State 2: Confirmed primary delay + another node unknown (null) => LATE_REALIZED_PARTIAL_UNKNOWN (delay NEVER hidden!)
  const partialDelay = computeRiskBreakdown(baseEffects, [
    {
      revision: 6,
      verifier: 'REVIEWER',
      effects: [
        { node: 'engineering', baseline: 10, observed: 13 },
        { node: 'dispatch', baseline: 20, observed: 23 },
        { node: 'collection', baseline: 30, observed: null },
        { node: 'donor_delivery', baseline: 18, observed: 18 },
      ],
    },
  ]);
  assert.equal(partialDelay.primaryChainRiskStatus, 'LATE_REALIZED_PARTIAL_UNKNOWN');
  assert.equal(partialDelay.remainingRiskStatus, 'LATE_REALIZED_PARTIAL_UNKNOWN');
  assert.equal(partialDelay.observedDelayConfirmed, true);
  assert.deepEqual(partialDelay.unknownNodes, ['collection']);

  // State 3: Transfer donor side-effect delay confirmed + primary collection node unknown => donor LATE_REALIZED + remaining LATE_REALIZED_PARTIAL_UNKNOWN
  const donorBankEffects = [
    { node: 'engineering', baseline: 10, without_action: 14, proposed: 10, observed: null },
    { node: 'dispatch', baseline: 20, without_action: 25, proposed: 20, observed: null },
    { node: 'collection', baseline: 30, without_action: 35, proposed: 30, observed: null },
    { node: 'donor_delivery', baseline: 18, without_action: 18, proposed: 24, observed: null },
  ];
  const donorDelayWithUnknown = computeRiskBreakdown(donorBankEffects, [
    {
      revision: 6,
      verifier: 'REVIEWER',
      effects: [
        { node: 'engineering', baseline: 10, observed: 10 },
        { node: 'dispatch', baseline: 20, observed: 20 },
        { node: 'collection', baseline: 30, observed: null },
        { node: 'donor_delivery', baseline: 18, observed: 26 },
      ],
    },
  ]);
  assert.equal(donorDelayWithUnknown.primaryChainRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(donorDelayWithUnknown.donorSideEffectRiskStatus, 'LATE_REALIZED');
  assert.equal(donorDelayWithUnknown.observedDelayConfirmed, true);
  assert.equal(donorDelayWithUnknown.remainingRiskStatus, 'LATE_REALIZED_PARTIAL_UNKNOWN');
  assert.deepEqual(donorDelayWithUnknown.unknownNodes, ['collection']);

  // State 4: Missing observations altogether => UNVERIFIED_OPEN for primary and donor
  const noObs = computeRiskBreakdown(donorBankEffects, []);
  assert.equal(noObs.primaryChainRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(noObs.donorSideEffectRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(noObs.remainingRiskStatus, 'UNVERIFIED_OPEN');
  assert.equal(noObs.observedDelayConfirmed, false);
});

test('R21: one-command launcher fails cleanly without Python or with corrupt bank (no fallback data) and persists state across fresh start & restart', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pvpt-launcher-'));
  const launcher = path.join(rootDir, 'scripts', 'start-local.mjs');
  try {
    // 1. Missing Python binary on fresh bank path -> explicit non-zero exit [PVPT:PYTHON_REQUIRED]
    const missingPyDb = path.join(dir, 'no-python.sqlite');
    const missingPy = spawnSync(process.execPath, [launcher, '--check-only'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PVPT_PYTHON: 'nonexistent-python-binary-pvpt-check',
        PVPT_TOTAL_DEMO_DB: missingPyDb,
        PVPT_DATABASE_PATH: path.join(dir, 'ws-no-py.sqlite'),
      },
    });
    assert.notEqual(missingPy.status, 0, 'Missing Python must exit non-zero');
    assert.match(missingPy.stderr, /\[PVPT:PYTHON_REQUIRED\]/);

    // 2. Corrupt scenario bank file -> explicit non-zero exit [PVPT:INVALID_SCENARIO_BANK]
    const corruptDb = path.join(dir, 'corrupt.sqlite');
    writeFileSync(corruptDb, 'NOT_A_VALID_SQLITE_SCENARIO_BANK');
    const badBank = spawnSync(process.execPath, [launcher, '--check-only'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PVPT_TOTAL_DEMO_DB: corruptDb,
        PVPT_DATABASE_PATH: path.join(dir, 'ws-corrupt.sqlite'),
      },
    });
    assert.notEqual(badBank.status, 0, 'Corrupt scenario bank must exit non-zero');
    assert.match(badBank.stderr, /\[PVPT:INVALID_SCENARIO_BANK\]/);

    // 3. Fresh empty DB paths (no DATABASE_URL) -> builds bank, serves /, /demo/total-system/, 43,200 scenarios, and persists across stop/restart
    const freshBank = path.join(dir, 'fresh-total-demo.sqlite');
    const freshWorkspace = path.join(dir, 'fresh-workspace.sqlite');
    const port = await getFreePort();
    const origin = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      PORT: String(port),
      PVPT_TOTAL_DEMO_DB: freshBank,
      PVPT_DATABASE_PATH: freshWorkspace,
    };
    delete env.DATABASE_URL;

    let child;
    const stopChild = async () => {
      if (!child) return;
      const done = new Promise(resolve => child.once('close', resolve));
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await done;
      child = undefined;
    };

    try {
      // First run: fresh build of scenario bank + boot server
      child = spawn(process.execPath, [launcher], { cwd: rootDir, env, stdio: 'pipe' });
      let firstStderr = '';
      child.stderr.on('data', chunk => { firstStderr += chunk.toString(); });
      const healthy1 = await waitForHealth(origin, 60000);
      assert.equal(healthy1, true, `First launcher run failed to become healthy: ${firstStderr}`);

      const mainPage = await fetch(origin + '/');
      assert.equal(mainPage.status, 200);
      const demoPage = await fetch(origin + '/demo/total-system/');
      assert.equal(demoPage.status, 200);
      const summaryRes = await fetch(origin + '/api/total-demo/summary');
      assert.equal(summaryRes.status, 200);
      const summary = await summaryRes.json();
      assert.equal(summary.summary.scenarios, 43200);

      // Save a case action in workspace DB
      const caseInit = await fetch(origin + '/api/total-demo/cases/S000013');
      assert.equal(caseInit.status, 200);
      const cookie = caseInit.headers.get('set-cookie').split(';')[0];
      const reportRes = await fetch(origin + '/api/total-demo/cases/S000013/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ revision: 0, action: 'REPORT', actor: 'EXPERT', reason: 'R21 launcher persistence check' }),
      });
      assert.equal(reportRes.status, 200);
      await stopChild();

      // Second run: must REUSE existing bank & workspace DBs without overwriting
      child = spawn(process.execPath, [launcher], { cwd: rootDir, env, stdio: 'pipe' });
      let secondStdout = '';
      child.stdout.on('data', chunk => { secondStdout += chunk.toString(); });
      const healthy2 = await waitForHealth(origin, 15000);
      assert.equal(healthy2, true, 'Second launcher run failed to boot cleanly');
      assert.match(secondStdout, /Reusing existing verified scenario bank \(43200 scenarios\)/i);

      const afterRestart = await fetch(origin + '/api/total-demo/cases/S000013', {
        headers: { Cookie: cookie },
      });
      assert.equal(afterRestart.status, 200);
      const restored = await afterRestart.json();
      assert.equal(restored.status, 'REPORTED');
      assert.equal(restored.revision, 1);
    } finally {
      await stopChild();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
