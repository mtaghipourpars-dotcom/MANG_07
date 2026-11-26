import { createHash, randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';

const sections = ['legacy', 'cases', 'preferences'];
const defaults = { legacy: null, cases: [], preferences: {} };
export const workspaceCookie = 'pvpt_workspace';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const recordId = value => typeof value === 'string' && value.length > 0 && value.length <= 160;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function transaction(db, run) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrate(db) {
  transaction(db, () => {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 2) throw new Error('The PVPT database schema is newer than this application.');
    if (version === 0) db.exec(`
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

    `);
    if (version < 2) db.exec(`
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

      PRAGMA user_version = 2;
    `);
  });
}

function importReference(db, seeds) {
  const write = db.prepare(`
    INSERT INTO reference_datasets(name, seed_digest, value) VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET seed_digest = excluded.seed_digest, value = excluded.value
    WHERE reference_datasets.seed_digest <> excluded.seed_digest
  `);
  const datasets = Object.entries(seeds).map(([name, filename]) => {
    const value = readFileSync(filename, 'utf8');
    if (!object(JSON.parse(value))) throw new Error('PVPT reference dataset must be a JSON object.');
    return [name, digest(value), value];
  });
  transaction(db, () => {
    for (const dataset of datasets) write.run(...dataset);
  });
}

function indexRecords(value) {
  if (!Array.isArray(value)) return null;
  const index = new Map();
  for (const row of value) {
    if (!object(row) || !recordId(row.id) || index.has(row.id)) return null;
    index.set(row.id, row);
  }
  return index;
}

function catalogueLinks(fixture, reference, legacy) {
  const orders = [...(reference.orders ?? []), ...(fixture.production_orders ?? [])];
  const operations = [...(reference.operations ?? []), ...(fixture.operations ?? [])];
  const commitments = [...(reference.ceoCommitments ?? []), ...(fixture.commitments ?? []), ...(legacy?.commitments ?? [])];
  const resources = [...(reference.moneyResources ?? []), ...(fixture.resources ?? []), ...(legacy?.catalogResources ?? [])];
  const suppliers = [...(reference.suppliers ?? []), ...(fixture.suppliers ?? []), ...(legacy?.suppliers ?? [])];
  return {
    orders: new Map(orders.map(row => [row.production_order_id, row.project_id])),
    resources: new Set([
      ...operations.map(row => row.machine_resource_id?.split(' (')[0]),
      ...resources.map(row => row.resource_id ?? row.id),
    ].filter(Boolean)),
    suppliers: new Set(suppliers.map(row => row.supplier_id)),
    commitments,
    cashStages: reference.ceoCashStages ?? [],
  };
}

function effectInCatalogue(effect, catalogue, caseOrders) {
  const { order, project, type, reference } = effect;
  // Tolerate compact records produced by older fixture and import consumers.
  if ([order, project, type, reference].every(value => value === undefined)) return true;
  if (!recordId(order) || catalogue.orders.get(order) !== project || !recordId(project)) return false;
  if (caseOrders.length && !caseOrders.includes(order)) return false;
  if (type === 'completion' || type === 'cost') return reference === order;
  if (type === 'delivery') return catalogue.commitments.some(row =>
    row.project_id === project && row.commitment_id === reference && ['CUSTOMER_DELIVERY', 'SERVICE_OVERHAUL'].includes(row.type));
  if (type === 'collection') return catalogue.commitments.some(row =>
    row.project_id === project && row.commitment_id === reference && row.type === 'MILESTONE_PAYMENT') ||
    catalogue.cashStages.some(row => row.project_id === project && row.stage_id === reference);
  return false;
}

function validateCases(value, catalogue = null) {
  const cases = indexRecords(value);
  if (!cases) return 'invalid_case_ids';
  for (const item of cases.values()) {
    // The original demo did not store an explicit schema version. Unchanged
    // records may omit optional groups, while links within any supplied group
    // must still refer to their owning case and the selected version.
    const effects = indexRecords(item.effects ?? []);
    const options = indexRecords(item.options ?? []);
    const outcomes = indexRecords(item.outcomes ?? []);
    if (!effects || !options || !outcomes || !Array.isArray(item.lessons ?? [])) return 'invalid_case_records';
    if (!Array.isArray(item.routing ?? []) || (item.routing ?? []).some(review =>
        !object(review) || !Array.isArray(review.measures) || review.measures.some(metric => !object(metric)) ||
        typeof review.origin !== 'string' || !review.origin.trim() ||
        !['monitor','review','committee','senior','unit'].includes(review.recommendation))) return 'invalid_routing_history';
    const orders = item.orders ?? [];
    if (!Array.isArray(orders) || orders.some(id => !recordId(id)) || new Set(orders).size !== orders.length) return 'invalid_order_links';
    if (catalogue && (orders.some(id => !catalogue.orders.has(id)) ||
        (item.resource !== undefined && !catalogue.resources.has(item.resource)) ||
        [...effects.values()].some(effect => !effectInCatalogue(effect, catalogue, orders)))) return 'invalid_case_catalogue_link';
    for (const option of options.values()) {
      if (catalogue && option.resource && !catalogue.resources.has(option.resource) && !catalogue.suppliers.has(option.resource)) return 'invalid_option_resource_link';
      if (option.effects !== undefined &&
          (!object(option.effects) || Object.keys(option.effects).some(id => !effects.has(id)))) return 'invalid_option_effect_links';
      if (option.effectVersions !== undefined &&
          (!object(option.effectVersions) || Object.keys(option.effectVersions).some(id => !effects.has(id)))) return 'invalid_option_version_links';
    }
    const decision = item.decision;
    if (decision != null) {
      if (!object(decision) || !recordId(decision.id) || !options.has(decision.optionId)) return 'invalid_decision_option_link';
      if (!Array.isArray(decision.rows) || decision.rows.some(row => !object(row) || !object(row.row) ||
          !isDeepStrictEqual(effects.get(row.row.id), row.row))) return 'invalid_decision_effect_links';
      if (new Set(decision.rows.map(row => row.row.id)).size !== effects.size || decision.rows.length !== effects.size) return 'invalid_decision_effect_links';
    }
    for (const outcome of outcomes.values()) {
      if (outcome.caseId !== item.id || !decision || outcome.decisionId !== decision.id || !effects.has(outcome.effectId)) return 'invalid_outcome_links';
    }
    for (const lesson of item.lessons ?? []) {
      if (!object(lesson) || lesson.caseId !== item.id || !decision || lesson.decisionId !== decision.id || !outcomes.has(lesson.outcomeId)) return 'invalid_lesson_links';
    }
  }
  return null;
}

function prefixUnchanged(before, after) {
  return Array.isArray(after) && before.length <= after.length &&
    before.every((value, index) => isDeepStrictEqual(value, after[index]));
}

function decisionSnapshot(decision) {
  const { status, startedAt, completedAt, completionNote, ...snapshot } = decision;
  return snapshot;
}

function checkCaseHistory(before, after) {
  const next = new Map(after.map(item => [item.id, item]));
  for (const previous of before) {
    const current = next.get(previous.id);
    if (!current) return 'case_history_removed';
    if (!prefixUnchanged(previous.routing ?? [], current.routing ?? []) ||
        (previous.decision && (previous.routing ?? []).length !== (current.routing ?? []).length)) return 'routing_history_immutable';
    if (!previous.decision) {
      if (current.decision && current.decision.status !== 'approved') return 'invalid_decision_transition';
      const effects = new Map((current.effects ?? []).map(item => [item.id, item]));
      if ((previous.effects ?? []).some(item => !effects.has(item.id) ||
          !prefixUnchanged(item.versions ?? [], effects.get(item.id).versions ?? []))) return 'effect_history_immutable';
      continue;
    }
    const decision = current.decision;
    if (!decision) return 'approved_case_immutable';
    const immutableFields = ['title','resource','description','orders','effects','options','occurredAt','downtime','conditionHistory','evidence','registrant','projectOrigin','at','dataClass'];
    if (immutableFields.some(key => !isDeepStrictEqual(previous[key], current[key])) ||
        !isDeepStrictEqual(decisionSnapshot(previous.decision), decisionSnapshot(decision))) return 'approved_case_immutable';
    const status = previous.decision.status;
    if (decision.status !== status && !(status === 'approved' && decision.status === 'started') &&
        !(status === 'started' && decision.status === 'completed')) return 'invalid_decision_transition';
    for (const key of ['startedAt','completedAt','completionNote']) {
      if (previous.decision[key] !== undefined && previous.decision[key] !== decision[key]) return 'approved_case_immutable';
    }
    if (!prefixUnchanged(previous.outcomes ?? [], current.outcomes ?? []) ||
        !prefixUnchanged(previous.lessons ?? [], current.lessons ?? [])) return 'closed_case_history_immutable';
    if (status === 'approved' && (current.outcomes ?? []).length > (previous.outcomes ?? []).length) return 'outcome_requires_start';
  }
  return null;
}

export function validateWorkspaceWrite(section, body) {
  if (!sections.includes(section)) return 'unknown_section';
  if (!object(body) || !Number.isSafeInteger(body.revision) || body.revision < 0 || !Object.hasOwn(body, 'value')) return 'invalid_workspace_write';
  if (section === 'cases') return validateCases(body.value);
  if (!object(body.value)) return 'invalid_section_value';
  if (section === 'legacy') {
    for (const key of ['issues','solutions','resources','projects','commitments','catalogResources','suppliers','sources','decisions','outcomes','lessons','assumptions','events']) {
      if (Object.hasOwn(body.value, key) && (!Array.isArray(body.value[key]) || body.value[key].some(row => !object(row)))) return 'invalid_legacy_records';
    }
  }
  return null;
}

export function openWorkspaceDb(filename, seeds) {
  if (filename !== ':memory:') {
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    closeSync(openSync(filename, 'a', 0o600));
  }
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    migrate(db);
    importReference(db, seeds);
  } catch (error) {
    db.close();
    throw error;
  }

  const exists = db.prepare('SELECT 1 AS found FROM workspaces WHERE id = ?');
  const add = db.prepare('INSERT INTO workspaces(id, created_at) VALUES (?, ?)');
  const readSections = db.prepare('SELECT name, revision, value FROM workspace_sections WHERE workspace_id = ?');
  const readSection = db.prepare('SELECT revision, value FROM workspace_sections WHERE workspace_id = ? AND name = ?');
  const update = db.prepare(`
    INSERT INTO workspace_sections(workspace_id, name, revision, value, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, name) DO UPDATE
    SET revision = excluded.revision, value = excluded.value, updated_at = excluded.updated_at
  `);
  const audit = db.prepare('INSERT INTO workspace_changes(workspace_id, name, revision, changed_at) VALUES (?, ?, ?, ?)');
  const readActions = db.prepare(`
    SELECT revision, action, actor, status, reason, at FROM total_demo_actions
    WHERE workspace_id = ? AND scenario_id = ? ORDER BY revision
  `);
  const latestAction = db.prepare(`
    SELECT revision, source FROM total_demo_actions
    WHERE workspace_id = ? AND scenario_id = ? ORDER BY revision DESC LIMIT 1
  `);
  const addAction = db.prepare(`
    INSERT INTO total_demo_actions (workspace_id, scenario_id, revision, source, action, actor, status, reason, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const dataset = db.prepare('SELECT value FROM reference_datasets WHERE name = ?');
  const reference = JSON.parse(dataset.get('reference')?.value ?? '{}');
  const fixture = JSON.parse(dataset.get('fixture')?.value ?? '{}');

  return {
    workspaceId(token) {
      if (typeof token !== 'string' || !tokenPattern.test(token)) return null;
      const id = digest(token);
      return exists.get(id) ? id : null;
    },
    createWorkspace() {
      const token = randomBytes(32).toString('base64url');
      const id = digest(token);
      add.run(id, new Date().toISOString());
      return { id, token };
    },
    readWorkspace(id) {
      const workspace = { ...defaults, revisions: { legacy: 0, cases: 0, preferences: 0 } };
      for (const row of readSections.all(id)) {
        workspace[row.name] = JSON.parse(row.value);
        workspace.revisions[row.name] = row.revision;
      }
      return workspace;
    },
    saveWorkspace(id, section, expectedRevision, value) {
      return transaction(db, () => {
        const current = readSection.get(id, section);
        const revision = current?.revision ?? 0;
        if (revision !== expectedRevision) {
          return { conflict: true, revision, value: current ? JSON.parse(current.value) : defaults[section] };
        }
        if (section === 'cases') {
          const legacy = JSON.parse(readSection.get(id, 'legacy')?.value ?? 'null');
          const links = catalogueLinks(fixture, reference, legacy);
          const invalid = validateCases(value, links) ?? checkCaseHistory(current ? JSON.parse(current.value) : [], value);
          if (invalid) return { invalid };
        }
        const stamp = new Date().toISOString();
        update.run(id, section, revision + 1, JSON.stringify(value), stamp);
        audit.run(id, section, revision + 1, stamp);
        return { revision: revision + 1, value };
      });
    },
    readTotalDemoHistory(workspace, scenario) {
      return readActions.all(workspace, scenario);
    },
    appendTotalDemoAction(workspace, scenario, revision, record) {
      return transaction(db, () => {
        const latest = latestAction.get(workspace, scenario);
        if ((latest?.revision ?? 0) !== revision) return { error: 'revision_conflict' };
        if (latest && latest.source !== record.source) return { error: 'scenario_source_changed' };
        addAction.run(workspace, scenario, revision + 1, record.source, record.action, record.actor,
          record.status, record.reason, new Date().toISOString());
        return { revision: revision + 1 };
      });
    },
    readReference(name) {
      const row = dataset.get(name);
      return row ? JSON.parse(row.value) : null;
    },
    health() {
      return db.prepare('SELECT 1 AS ok').get().ok === 1;
    },
    close() {
      db.close();
    }
  };
}
