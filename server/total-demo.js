import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';

const data_class = 'DEMO_SYNTHETIC';
const dimensions = ['stage', 'resource', 'option', 'profile', 'variant', 'gate', 'decision', 'execution', 'outcome'];
const filterKeys = ['anchor', ...dimensions];
const supportedQuery = new Set([...filterKeys, 'limit', 'offset']);
const casePattern = /^S\d{6}$/;
const transitions = {
  DRAFT: [['REPORT', 'EXPERT', 'REPORTED']],
  REPORTED: [['SCOPE', 'OWNER', 'SCOPED']],
  SCOPED: [['ASSESS', 'ASSESSOR', 'ASSESSED']],
  ASSESSED: [['APPROVE', 'DECIDER', 'APPROVED'], ['DECLINE', 'DECIDER', 'DECLINED']],
  APPROVED: [['EXECUTE', 'OWNER', 'EXECUTED']],
  EXECUTED: [['OBSERVE', 'OWNER', 'OBSERVED']],
  OBSERVED: [['CLOSE', 'EXPERT', 'CLOSED']],
  DECLINED: [['CLOSE', 'EXPERT', 'CLOSED']]
};

function availableTransitions(scenario, status) {
  return (transitions[status] || []).filter(([action]) => {
    if (action === 'APPROVE') return scenario.gate === 'FEASIBLE' && scenario.decision === 'APPROVED';
    if (action === 'OBSERVE') return ['VERIFIED', 'PARTIALLY_VERIFIED'].includes(scenario.outcome);
    return true;
  });
}

function scenarioCriteria(query) {
  for (const [key, value] of Object.entries(query)) {
    if (!supportedQuery.has(key) || typeof value !== 'string' || !value.length || value.length > 160) return null;
  }
  const numeric = (key, fallback) => query[key] === undefined ? fallback :
    (/^\d+$/.test(query[key]) ? Number(query[key]) : NaN);
  const limit = numeric('limit', 20);
  const offset = numeric('offset', 0);
  const variant = numeric('variant', undefined);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset > 1000000 ||
      (variant !== undefined && variant !== 0 && variant !== 1)) return null;
  const keys = filterKeys.filter(key => query[key] !== undefined);
  return {
    limit, offset,
    clause: ['data_class = ?', ...keys.map(key => key + ' = ?')].join(' AND '),
    values: [data_class, ...keys.map(key => key === 'variant' ? variant : query[key])]
  };
}

export function openTotalDemo(filename) {
  let db;
  let identity;
  function getBank() {
    const details = statSync(filename, { throwIfNoEntry: false });
    if (!details?.isFile()) {
      close();
      return null;
    }
    const signature = [details.dev, details.ino, details.size, details.mtimeMs].join(':');
    if (db && identity === signature) return db;
    close();
    try {
      db = new DatabaseSync(filename, { readOnly: true });
      const metadata = JSON.parse(db.prepare("SELECT payload FROM scenario_bank_view WHERE view_id='release'").get()?.payload);
      if (metadata.data_class !== data_class) throw Error('Unexpected bank classification');
      identity = signature;
      return db;
    } catch {
      close();
      return null;
    }
  }

  function close() {
    db?.close();
    db = undefined;
    identity = undefined;
  }
  return { getBank, close };
}

function scenarioRow(db, id) {
  return casePattern.test(id) && db.prepare('SELECT * FROM scenario WHERE id = ? AND data_class = ?').get(id, data_class);
}

function caseState(storage, workspace, scenario) {
  const history = storage.readTotalDemoHistory(workspace, scenario.id);
  const status = history.at(-1)?.status || 'DRAFT';
  return {
    scenarioId: scenario.id, data_class, revision: history.length, status, history,
    allowedActions: availableTransitions(scenario, status).map(([action, actor]) => ({ action, actor }))
  };
}

export function totalDemoRouter({ bank, storage, getWorkspace, allowWrite }) {
  const router = express.Router();
  const readView = (db, view) => JSON.parse(db.prepare('SELECT payload FROM scenario_bank_view WHERE view_id = ?').get(view)?.payload);
  const serve = handler => (request, response) => {
    const db = bank.getBank();
    if (!db) return response.status(503).json({ error: 'scenario_bank_unavailable', data_class });
    return handler(db, request, response);
  };
  const withScenario = handler => serve((db, request, response) => {
    const row = scenarioRow(db, request.params.id);
    if (!row) return response.status(404).json({ error: 'scenario_not_found' });
    return handler(db, request, response, row);
  });

  router.get('/summary', serve((db, _request, response) => {
    const summary = readView(db, 'summary');
    const filters = { anchor: db.prepare('SELECT id, family, provenance FROM anchor ORDER BY id').all() };
    for (const column of dimensions) {
      filters[column] = db.prepare(`SELECT DISTINCT ${column} AS value FROM scenario WHERE data_class = ? ORDER BY ${column}`)
        .all(data_class).map(row => row.value);
    }
    response.json({ data_class, operationalStatus: 'INTERNAL_SOURCE_REQUIRED', summary, filters });
  }));

  router.get('/scenarios', serve((db, request, response) => {
    const criteria = scenarioCriteria(request.query);
    if (!criteria) return response.status(400).json({ error: 'invalid_scenario_query' });
    const { clause, values, limit, offset } = criteria;
    const total = db.prepare(`SELECT count(*) AS total FROM scenario WHERE ${clause}`).get(...values).total;
    const items = db.prepare(`SELECT * FROM scenario WHERE ${clause} ORDER BY id LIMIT ? OFFSET ?`).all(...values, limit, offset);
    response.json({ items, total, offset, limit, data_class });
  }));
  router.get('/scenarios/:id', withScenario((db, _request, response, row) => {
    const anchor_details = db.prepare('SELECT * FROM anchor WHERE id = ?').get(row.anchor);
    const event = db.prepare('SELECT * FROM event WHERE scenario = ? ORDER BY sequence').all(row.id);
    const effect = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(row.id);
    response.json({ ...row, anchor_details, event, effect });
  }));
  router.get('/executive', serve((db, _request, response) =>
    response.json({ data_class, executive: readView(db, 'executive') })));

  router.get('/cases/:id', withScenario((_db, request, response, scenario) =>
    response.json(caseState(storage, getWorkspace(request, response, true), scenario))));

  router.post('/cases/:id/actions', express.json({ limit: '8kb' }), withScenario((db, request, response, scenario) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const { revision, action, actor, reason } = request.body || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof action !== 'string' || typeof actor !== 'string' ||
        typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
      return response.status(400).json({ error: 'invalid_case_action' });
    }
    const state = caseState(storage, workspace, scenario);
    if (revision !== state.revision) return response.status(409).json({ error: 'revision_conflict', ...state });
    const next = availableTransitions(scenario, state.status).find(([code, role]) => code === action && role === actor);
    if (!next) return response.status(403).json({ error: 'action_not_allowed', ...state });
    const evidence = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY node').all(scenario.id);
    const source = createHash('sha256').update(JSON.stringify({ scenario, evidence })).digest('hex');
    const outcome = storage.appendTotalDemoAction(workspace, scenario.id, revision, {
      source, action, actor, reason: reason.trim(), status: next[2]
    });
    if (outcome.error) return response.status(409).json({ ...caseState(storage, workspace, scenario), error: outcome.error });
    return response.json(caseState(storage, workspace, scenario));
  }));

  return router;
}
