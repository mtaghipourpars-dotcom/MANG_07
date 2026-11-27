import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';

const data_class = 'DEMO_SYNTHETIC';
const operationalStatus = 'INTERNAL_SOURCE_REQUIRED';
const actorMode = 'DEMO_SIMULATED_ROLE';
const enterpriseAuthStatus = 'BLOCKED_INTERNAL_SOURCE_REQUIRED';
const defaultPortfolioId = 'DEMO-PORTFOLIO-MAIN';
const portfolioPattern = /^[A-Z0-9_-]{3,40}$/;
const casePattern = /^S\d{6}$/;
const dimensions = ['stage', 'resource', 'option', 'profile', 'variant', 'gate', 'decision', 'execution', 'outcome'];
const filterKeys = ['anchor', ...dimensions];
const supportedQuery = new Set([...filterKeys, 'limit', 'offset']);
const knownNodes = new Set([
  'engineering', 'procurement', 'stock_release', 'manufacturing',
  'quality_fat', 'dispatch', 'acceptance', 'collection', 'donor_delivery',
]);
const reviewStatuses = new Set(['OBSERVED', 'CONFIRMED', 'UNKNOWN', 'NO_EFFECT']);
const verificationKinds = new Set(['OPERATIONAL', 'FINANCIAL', 'OUTCOME']);

const transitions = {
  DRAFT: [['REPORT', 'EXPERT', 'REPORTED']],
  REPORTED: [['SCOPE', 'OWNER', 'SCOPED']],
  SCOPED: [['ASSESS', 'ASSESSOR', 'ASSESSED']],
  ASSESSED: [['APPROVE', 'DECIDER', 'APPROVED'], ['DECLINE', 'DECIDER', 'DECLINED']],
  APPROVED: [['EXECUTE', 'OWNER', 'EXECUTED']],
  EXECUTED: [['OBSERVE', 'OWNER', 'OBSERVED']],
  OBSERVED: [['CLOSE', 'EXPERT', 'CLOSED']],
  DECLINED: [['CLOSE', 'EXPERT', 'CLOSED']],
};

function availableTransitions(scenario, status) {
  return (transitions[status] || []).filter(([action]) => {
    if (action === 'APPROVE') return scenario.gate === 'FEASIBLE' && scenario.decision === 'APPROVED';
    if (action === 'OBSERVE') return ['VERIFIED', 'PARTIALLY_VERIFIED'].includes(scenario.outcome);
    return true;
  });
}

function parsePortfolioId(raw) {
  if (raw === undefined || raw === null || raw === '') return defaultPortfolioId;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return portfolioPattern.test(trimmed) ? trimmed : null;
}

function rejectEnterpriseMode(request, response) {
  const mode = request.query?.mode ?? request.body?.mode;
  if (typeof mode === 'string' && mode.trim().toLowerCase() === 'enterprise') {
    response.status(503).json({
      error: 'enterprise_authority_required',
      status: 'BLOCKED',
      actorMode,
      enterpriseAuthStatus,
      operationalStatus,
      data_class,
    });
    return true;
  }
  return false;
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
    values: [data_class, ...keys.map(key => key === 'variant' ? variant : query[key])],
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

function makeIssueId(scenario) {
  return `${scenario.id}::${scenario.stage}::${scenario.resource}`;
}

function makeOptionId(scenario) {
  return `${scenario.id}::${scenario.option}`;
}

function makeCommitmentId(anchor, node) {
  return `${anchor}::${node}`;
}

function parseCommitmentId(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('::');
  if (parts.length !== 2) return null;
  const [anchor, node] = parts;
  if (!anchor || anchor.length > 120 || !knownNodes.has(node)) return null;
  return { anchor, node, commitmentId: `${anchor}::${node}` };
}

function buildScenarioLinks(scenario, effects, workspaceLinks) {
  const latestByKey = new Map();
  for (const row of workspaceLinks) {
    const key = `${row.commitment_id}|${row.issue_id}|${row.option_id}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }
  const issueId = makeIssueId(scenario);
  const optionId = makeOptionId(scenario);
  return effects.map(item => {
    const commitmentId = makeCommitmentId(scenario.anchor, item.node);
    const effectType = item.node === 'donor_delivery' ? 'SIDE_EFFECT_DONOR' : 'DIRECT';
    const key = `${commitmentId}|${issueId}|${optionId}`;
    const reviewed = latestByKey.get(key);
    const donorImpacted = item.node === 'donor_delivery' && (
      (item.proposed !== null && item.proposed > item.baseline) ||
      (item.without_action !== null && item.without_action > item.baseline) ||
      (item.observed !== null && item.observed > item.baseline)
    );
    let defaultStatus = 'UNKNOWN';
    let defaultEvidenceRef = null;
    if (item.observed !== null && item.observed !== undefined) {
      defaultStatus = 'OBSERVED';
      defaultEvidenceRef = `BANK_SCENARIO:${scenario.id}:${item.node}`;
    } else if (item.node === 'donor_delivery' && !donorImpacted && item.proposed !== null && item.without_action !== null) {
      defaultStatus = 'NO_EFFECT';
      defaultEvidenceRef = `BANK_SCENARIO:${scenario.id}:${item.node}`;
    }
    return {
      scenarioId: scenario.id,
      commitmentId,
      anchor: scenario.anchor,
      node: item.node,
      issueId,
      optionId,
      stage: scenario.stage,
      resource: scenario.resource,
      option: scenario.option,
      effectType,
      donorImpacted,
      reviewStatus: reviewed ? reviewed.review_status : defaultStatus,
      version: reviewed ? reviewed.version : 1,
      evidenceRef: reviewed ? reviewed.evidence_ref : defaultEvidenceRef,
      evidenceSource: reviewed ? 'WORKSPACE_REVIEW' : 'PRECOMPUTED_SCENARIO_BANK',
      reviewedBy: reviewed ? reviewed.actor : null,
      reviewedAt: reviewed ? reviewed.at : null,
      baseline: item.baseline,
      without_action: item.without_action,
      proposed: item.proposed,
      current_forecast: item.current_forecast,
      observed: item.observed,
    };
  });
}

export function computeRiskBreakdown(scenarioEffects, observations, verifications = []) {
  const latest = observations.length ? observations.at(-1) : null;
  const obsEffects = latest?.effects || [];
  const donorBankRow = scenarioEffects.find(item => item.node === 'donor_delivery');
  const donorObs = obsEffects.find(item => item.node === 'donor_delivery');
  const donorImpacted = Boolean(
    (donorBankRow && (
      (donorBankRow.proposed !== null && donorBankRow.proposed > donorBankRow.baseline) ||
      (donorBankRow.without_action !== null && donorBankRow.without_action > donorBankRow.baseline) ||
      (donorBankRow.observed !== null && donorBankRow.observed > donorBankRow.baseline)
    )) ||
    (donorObs && donorObs.observed !== null && donorObs.observed !== undefined && donorObs.observed > donorObs.baseline)
  );

  if (!latest) {
    const unknownNodes = scenarioEffects
      .filter(item => item.node !== 'donor_delivery' || donorImpacted)
      .map(item => item.node);
    return {
      primaryChainRiskStatus: 'UNVERIFIED_OPEN',
      donorSideEffectRiskStatus: donorImpacted ? 'UNVERIFIED_OPEN' : 'NO_DONOR_IMPACT',
      remainingRiskStatus: 'UNVERIFIED_OPEN',
      observedDelayConfirmed: false,
      unknownNodes,
    };
  }

  const primaryEffects = obsEffects.filter(item => item.node !== 'donor_delivery');
  const hasIndependentOutcomeVerification = Boolean(
    latest.verifier ||
    verifications.some(v => v.kind === 'OUTCOME' && v.target_revision === latest.revision)
  );

  const unknownPrimaryNodes = primaryEffects
    .filter(item => item.observed === null || item.observed === undefined)
    .map(item => item.node);
  const latePrimaryNodes = primaryEffects
    .filter(item => item.observed !== null && item.observed !== undefined && item.observed > item.baseline)
    .map(item => item.node);

  let primaryChainRiskStatus = 'UNVERIFIED_OPEN';
  if (latePrimaryNodes.length > 0 && unknownPrimaryNodes.length > 0) {
    primaryChainRiskStatus = 'LATE_REALIZED_PARTIAL_UNKNOWN';
  } else if (latePrimaryNodes.length > 0) {
    primaryChainRiskStatus = 'LATE_REALIZED';
  } else if (unknownPrimaryNodes.length > 0 || !primaryEffects.length) {
    primaryChainRiskStatus = 'UNVERIFIED_OPEN';
  } else if (hasIndependentOutcomeVerification) {
    primaryChainRiskStatus = 'MET_VERIFIED';
  } else {
    primaryChainRiskStatus = 'UNVERIFIED_OPEN';
  }

  let donorSideEffectRiskStatus = 'NO_DONOR_IMPACT';
  if (donorImpacted) {
    if (!donorObs || donorObs.observed === null || donorObs.observed === undefined) {
      donorSideEffectRiskStatus = 'UNVERIFIED_OPEN';
    } else if (donorObs.observed > donorObs.baseline) {
      donorSideEffectRiskStatus = 'LATE_REALIZED';
    } else if (hasIndependentOutcomeVerification) {
      donorSideEffectRiskStatus = 'MET_VERIFIED';
    } else {
      donorSideEffectRiskStatus = 'UNVERIFIED_OPEN';
    }
  }

  const observedDelayConfirmed =
    primaryChainRiskStatus === 'LATE_REALIZED' ||
    primaryChainRiskStatus === 'LATE_REALIZED_PARTIAL_UNKNOWN' ||
    donorSideEffectRiskStatus === 'LATE_REALIZED';

  const hasUnknownObservations =
    primaryChainRiskStatus === 'UNVERIFIED_OPEN' ||
    primaryChainRiskStatus === 'LATE_REALIZED_PARTIAL_UNKNOWN' ||
    donorSideEffectRiskStatus === 'UNVERIFIED_OPEN';

  let remainingRiskStatus = 'MET_VERIFIED';
  if (observedDelayConfirmed && hasUnknownObservations) {
    remainingRiskStatus = 'LATE_REALIZED_PARTIAL_UNKNOWN';
  } else if (observedDelayConfirmed) {
    remainingRiskStatus = 'LATE_REALIZED';
  } else if (hasUnknownObservations) {
    remainingRiskStatus = 'UNVERIFIED_OPEN';
  }

  const unknownNodes = [
    ...unknownPrimaryNodes,
    ...(donorSideEffectRiskStatus === 'UNVERIFIED_OPEN' ? ['donor_delivery'] : []),
  ];

  return {
    primaryChainRiskStatus,
    donorSideEffectRiskStatus,
    remainingRiskStatus,
    observedDelayConfirmed,
    unknownNodes,
  };
}

function caseState(db, storage, workspace, scenario) {
  const history = storage.readTotalDemoHistory(workspace, scenario.id);
  const status = history.at(-1)?.status || 'DRAFT';
  const approvedSnapshot = storage.readTotalDemoApproval(workspace, scenario.id);
  const observations = storage.readTotalDemoObservations(workspace, scenario.id);
  const verifications = storage.readTotalDemoVerifications(workspace, scenario.id);
  const lessons = storage.readTotalDemoLessons(workspace, { scenarioId: scenario.id });
  const { reservations, attempts: reservationAttempts } = storage.readTotalDemoReservations(workspace, { scenario: scenario.id });
  const scenarioEffects = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(scenario.id);
  const risk = computeRiskBreakdown(scenarioEffects, observations, verifications);
  return {
    scenarioId: scenario.id,
    data_class,
    actorMode,
    enterpriseAuthStatus,
    revision: history.length,
    status,
    history,
    allowedActions: availableTransitions(scenario, status).map(([action, actor]) => ({ action, actor })),
    approvedSnapshot,
    observations,
    verifications,
    lessons,
    reservations,
    reservationAttempts,
    primaryChainRiskStatus: risk.primaryChainRiskStatus,
    donorSideEffectRiskStatus: risk.donorSideEffectRiskStatus,
    remainingRiskStatus: risk.remainingRiskStatus,
    observedDelayConfirmed: risk.observedDelayConfirmed,
    unknownNodes: risk.unknownNodes,
  };
}

function deriveServerRecorder(history, fallbackActor) {
  const executeRow = [...history].reverse().find(item => item.action === 'EXECUTE');
  if (executeRow) return executeRow.actor;
  const reportRow = [...history].reverse().find(item => item.action === 'REPORT');
  if (reportRow) return reportRow.actor;
  const lastRow = history.at(-1);
  return lastRow ? lastRow.actor : fallbackActor;
}

function computeLiveFinanceTrace(db) {
  const plans = db.prepare('SELECT * FROM finance_plan ORDER BY id').all();
  const postings = db.prepare('SELECT * FROM finance_posting ORDER BY rowid').all();
  const options = db.prepare('SELECT * FROM finance_option ORDER BY id').all();
  const fundings = db.prepare('SELECT * FROM finance_funding ORDER BY option_id, available_at, reference').all();
  const nodes = db.prepare('SELECT * FROM finance_node ORDER BY rowid').all();
  const edges = db.prepare('SELECT * FROM finance_edge ORDER BY rowid').all();
  const cashStages = db.prepare('SELECT * FROM finance_cash_stage ORDER BY id').all();
  const measures = db.prepare('SELECT * FROM finance_measure ORDER BY rowid').all();

  const plan = plans[0] || null;
  const acceptedPostings = [];
  const excludedPostings = [];
  for (const row of postings) {
    const reasons = [];
    if (!plan || row.wbs !== plan.wbs || row.work_order !== plan.work_order) reasons.push('WBS_OR_ORDER_MISMATCH');
    if (plan && row.period !== plan.period) reasons.push('PERIOD_OUT_OF_WINDOW');
    if (plan && row.currency !== plan.currency) reasons.push('CURRENCY_MISMATCH');
    if (row.kind === 'INTERNAL' || row.matched_document !== null) reasons.push('INTERNAL_TRANSFER_ELIMINATED');
    if (reasons.length) {
      excludedPostings.push({ ...row, exclusionReasons: reasons });
    } else {
      acceptedPostings.push({ ...row, exclusionReasons: [] });
    }
  }

  const pv = plan ? plan.planned : null;
  const ev = plan ? plan.earned : null;
  const ac = plan ? acceptedPostings.reduce((sum, row) => sum + row.amount, 0) : null;
  const cv = ev !== null && ac !== null ? ev - ac : null;
  const cpi = ev !== null && ac ? Number((ev / ac).toFixed(4)) : null;

  // Single-counted critical-path DAG propagation per scenario
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const parents = new Map(nodes.map(n => [n.id, []]));
  for (const edge of edges) {
    if (parents.has(edge.child)) parents.get(edge.child).push(edge.parent);
  }
  const finishCache = new Map();
  function finishTimes(nodeId) {
    if (finishCache.has(nodeId)) return finishCache.get(nodeId);
    const node = nodeMap.get(nodeId);
    const parentIds = parents.get(nodeId) || [];
    const baseStart = parentIds.length ? Math.max(...parentIds.map(pid => finishTimes(pid)[0])) : 0;
    const delayedStart = parentIds.length ? Math.max(...parentIds.map(pid => finishTimes(pid)[1])) : 0;
    const pair = [baseStart + node.duration, delayedStart + node.duration + node.extra];
    finishCache.set(nodeId, pair);
    return pair;
  }
  const dagNodes = {};
  for (const node of nodes) dagNodes[node.id] = finishTimes(node.id);

  const stages = cashStages.map(stage => {
    const [baseFinish, delayedFinish] = dagNodes[stage.node] || [0, 0];
    const delayDays = delayedFinish - baseFinish;
    const timingCost = Number(((stage.principal * (stage.annual_rate_bps / 10000) * delayDays) / 365).toFixed(2));
    return {
      ...stage,
      baselineFinishDay: baseFinish,
      delayedFinishDay: delayedFinish,
      delay_days: delayDays,
      timing_cost_m_toman: timingCost,
      singleCountedCauses: nodes.filter(n => n.extra > 0).map(n => ({ id: n.id, extra_days: n.extra })),
    };
  });

  const fundingGate = options.map(opt => {
    const items = fundings.filter(f => f.option_id === opt.id);
    const availableByDeadline = items
      .filter(f => f.available_at <= opt.deadline)
      .reduce((sum, f) => sum + f.amount, 0);
    return {
      ...opt,
      available_by_deadline: availableByDeadline,
      feasible: availableByDeadline >= opt.required,
      gate_status: availableByDeadline >= opt.required ? 'CASH_FEASIBLE' : 'CASH_BLOCKED',
      sources: items,
    };
  });

  const manufacturingMeasure = measures.find(m => m.kind === 'manufacturing_cost_effect') || null;
  const capacityMeasure = measures.find(m => m.kind === 'released_capacity') || null;
  const economicOutputs = {
    separateOutputsEnforced: true,
    combinedTotalForbidden: true,
    manufacturing_cost_effect: manufacturingMeasure,
    financing_timing_cost: stages[0]
      ? { value: stages[0].timing_cost_m_toman, unit: 'M_TOMAN', stage_id: stages[0].id, delay_days: stages[0].delay_days, observed: stages[0].observed === 1 }
      : null,
    released_capacity: capacityMeasure,
    contractual_exposure: { value: null, status: 'NOT_QUANTIFIED_INTERNAL_SOURCE_REQUIRED', source: null },
  };

  return {
    data_class,
    sourceMode: 'LIVE_SQLITE_BANK_QUERY',
    operationalStatus,
    costControl: {
      linkedCaseId: cashStages[0]?.scenario ?? 'EXEC-FIN-01',
      baseline: plan?.baseline ?? null,
      plan,
      kpis: { PV: pv, EV: ev, AC: ac, CV: cv, CPI: cpi },
      acceptedPostings,
      excludedPostings,
      traceability: {
        documentCount: postings.length,
        acceptedCount: acceptedPostings.length,
        excludedCount: excludedPostings.length,
        wbs: plan?.wbs ?? null,
        workOrder: plan?.work_order ?? null,
        period: plan?.period ?? null,
        baseline: plan?.baseline ?? null,
      },
    },
    cashDag: {
      nodes: dagNodes,
      edges,
      stages,
    },
    fundingGate,
    economicOutputs,
  };
}

function computeLiveGovernanceQueue(db, asOfMinute = 0) {
  const authorities = db.prepare('SELECT * FROM gov_authority ORDER BY actor').all();
  const authorityByActor = new Map(authorities.map(row => [row.actor, row]));
  const cases = db.prepare('SELECT * FROM gov_case ORDER BY id').all();
  const assignments = db.prepare('SELECT * FROM gov_assignment ORDER BY id').all();
  const decisions = db.prepare('SELECT * FROM gov_decision ORDER BY id').all();
  const observations = db.prepare('SELECT * FROM gov_observation ORDER BY id').all();
  const events = db.prepare('SELECT * FROM gov_event ORDER BY sequence').all();

  const ceoQueue = [];
  const highRiskWatch = [];
  const deputyRouting = [];

  for (const item of cases) {
    const ownerAuth = authorityByActor.get(item.owner);
    const caseAssignments = assignments.filter(a => a.case_id === item.id);
    const currentAssignment = caseAssignments.at(-1) || null;
    const caseDecision = decisions.find(d => d.case_id === item.id) || null;
    const caseObservation = observations.find(o => o.case_id === item.id) || null;
    const caseEvents = events.filter(e => e.case_id === item.id);
    const requiresCeo = item.policy_ceo === 1 || !ownerAuth || item.amount > ownerAuth.ceiling;

    const expiredAssignments = caseAssignments.filter(a => a.accepted_at === null && a.accept_by < asOfMinute);
    if (expiredAssignments.length) {
      for (const expired of expiredAssignments) {
        const auth = authorityByActor.get(expired.actor);
        const successor = caseAssignments.find(a => a.id > expired.id) || null;
        deputyRouting.push({
          caseId: item.id,
          fromActor: expired.actor,
          expiredAcceptBy: expired.accept_by,
          configuredDeputy: auth?.deputy ?? null,
          routedToActor: successor?.actor ?? null,
          routedAcceptBy: successor?.accept_by ?? null,
          routedAt: successor?.assigned_at ?? null,
        });
      }
    }

    const enriched = {
      ...item,
      ownerCeiling: ownerAuth?.ceiling ?? null,
      requiresCeo,
      routingBucket: requiresCeo ? 'CEO_DECISION_QUEUE' : 'HIGH_RISK_WATCHLIST',
      assignments: caseAssignments.map(a => ({
        ...a,
        acceptanceStatus: a.accepted_at !== null
          ? 'ACCEPTED'
          : (a.accept_by < asOfMinute ? 'EXPIRED_UNACCEPTED' : 'PENDING_ACCEPTANCE'),
      })),
      currentAssignment,
      decision: caseDecision,
      observation: caseObservation,
      latestEvent: caseEvents.at(-1) || null,
    };

    if (requiresCeo) ceoQueue.push(enriched);
    else if (item.risk === 'HIGH') highRiskWatch.push(enriched);
  }

  return {
    data_class,
    sourceMode: 'LIVE_SQLITE_BANK_QUERY',
    actorMode,
    enterpriseAuthStatus,
    operationalStatus,
    asOfMinute,
    authorities,
    ceoQueue,
    highRiskWatch,
    deputyRouting,
    events,
  };
}

export function totalDemoRouter({ bank, storage, getWorkspace, allowWrite }) {
  const router = express.Router();
  const readView = (db, view) => JSON.parse(db.prepare('SELECT payload FROM scenario_bank_view WHERE view_id = ?').get(view)?.payload);
  const serve = handler => (request, response) => {
    if (rejectEnterpriseMode(request, response)) return;
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
    response.json({
      data_class,
      actorMode,
      enterpriseAuthStatus,
      operationalStatus,
      summary,
      filters,
    });
  }));

  router.get('/scenarios', serve((db, request, response) => {
    const criteria = scenarioCriteria(request.query);
    if (!criteria) return response.status(400).json({ error: 'invalid_scenario_query' });
    const { clause, values, limit, offset } = criteria;
    const total = db.prepare(`SELECT count(*) AS total FROM scenario WHERE ${clause}`).get(...values).total;
    const items = db.prepare(`SELECT * FROM scenario WHERE ${clause} ORDER BY id LIMIT ? OFFSET ?`).all(...values, limit, offset);
    response.json({ items, total, offset, limit, data_class });
  }));

  router.get('/scenarios/:id', withScenario((db, request, response, row) => {
    const anchor_details = db.prepare('SELECT * FROM anchor WHERE id = ?').get(row.anchor);
    const event = db.prepare('SELECT * FROM event WHERE scenario = ? ORDER BY sequence').all(row.id);
    const effect = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(row.id);
    const directEffects = effect.filter(item => item.node !== 'donor_delivery');
    const optionSideEffects = effect.filter(item => item.node === 'donor_delivery');
    const workspace = getWorkspace(request, response, true);
    const links = buildScenarioLinks(row, effect, storage.readTotalDemoCaseLinks(workspace, row.id));
    response.json({
      ...row,
      anchor_details,
      event,
      effect,
      directEffects,
      optionSideEffects,
      links,
      precomputedBankEvidence: true,
    });
  }));

  router.get('/executive', serve((db, _request, response) =>
    response.json({
      data_class,
      sourceMode: 'READ_ONLY_PRECOMPUTED_SCENARIO_BANK',
      actorMode,
      enterpriseAuthStatus,
      operationalStatus,
      executive: readView(db, 'executive'),
    })));

  // R11: Live SQLite Financial Traceability & Posting Validation
  router.get('/finance/trace', serve((db, _request, response) =>
    response.json(computeLiveFinanceTrace(db))));

  router.post('/finance/verify-posting', express.json({ limit: '8kb' }), serve((db, request, response) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const body = request.body || {};
    const { document, period, currency, confirmedByFinance } = body;
    if (typeof document !== 'string' || !document.trim() || document.length > 80 ||
        typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period) ||
        (currency !== undefined && (typeof currency !== 'string' || !currency.trim() || currency.length > 24))) {
      return response.status(400).json({ error: 'invalid_posting_request' });
    }
    const plan = db.prepare('SELECT * FROM finance_plan ORDER BY id LIMIT 1').get();
    const posting = db.prepare('SELECT * FROM finance_posting WHERE document = ?').get(document.trim());
    if (!posting) {
      return response.status(404).json({ error: 'posting_not_found', document: document.trim(), operationalStatus });
    }
    const reasons = [];
    if (!plan || posting.period !== period || period !== plan.period) reasons.push('PERIOD_MISMATCH');
    const expectedCurrency = currency ? currency.trim() : posting.currency;
    if (plan && expectedCurrency !== plan.currency) reasons.push('CURRENCY_MISMATCH');
    if (posting.kind === 'INTERNAL' || posting.matched_document !== null) reasons.push('INTERNAL_TRANSFER_EXCLUDED');
    if (confirmedByFinance !== true) reasons.push('FINANCE_CONFIRMATION_REQUIRED');
    if (reasons.length) {
      return response.status(422).json({
        error: 'invalid_financial_evidence',
        accepted: false,
        reasons,
        posting,
        planPeriod: plan?.period ?? null,
        operationalStatus,
      });
    }
    return response.json({
      data_class,
      sourceMode: 'LIVE_SQLITE_BANK_QUERY',
      operationalStatus,
      accepted: true,
      posting,
      plan,
    });
  }));

  // R6 & R15: Live SQLite Governance Authority, Queue, Watchlist, and Deputy Routing
  router.get('/governance/queue', serve((db, request, response) => {
    const asOfRaw = request.query.asOfMinute;
    const asOfMinute = asOfRaw === undefined ? 0 : (/^-?\d+$/.test(String(asOfRaw)) ? Number(asOfRaw) : NaN);
    if (!Number.isSafeInteger(asOfMinute)) return response.status(400).json({ error: 'invalid_governance_query' });
    response.json(computeLiveGovernanceQueue(db, asOfMinute));
  }));

  router.post('/governance/evaluate', express.json({ limit: '8kb' }), serve((db, request, response) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const body = request.body || {};
    const { caseId, actor, asOfMinute = 0 } = body;
    if (typeof caseId !== 'string' || !caseId.trim() || typeof actor !== 'string' || !actor.trim() ||
        !Number.isSafeInteger(asOfMinute)) {
      return response.status(400).json({ error: 'invalid_governance_request' });
    }
    const caseRow = db.prepare('SELECT * FROM gov_case WHERE id = ?').get(caseId.trim());
    if (!caseRow) return response.status(404).json({ error: 'governance_case_not_found' });
    const authRow = db.prepare('SELECT * FROM gov_authority WHERE actor = ?').get(actor.trim());
    if (!authRow) {
      return response.status(403).json({
        error: 'authority_exceeded',
        reason: 'unknown_demo_actor',
        actorMode,
        enterpriseAuthStatus,
      });
    }
    if (caseRow.policy_ceo === 1 && authRow.actor !== 'CEO') {
      return response.status(403).json({
        error: 'authority_exceeded',
        reason: 'policy_requires_ceo',
        requiredActor: 'CEO',
        actor: authRow.actor,
        caseId: caseRow.id,
        actorMode,
        enterpriseAuthStatus,
      });
    }
    if (caseRow.amount > authRow.ceiling) {
      return response.status(403).json({
        error: 'authority_exceeded',
        reason: 'amount_exceeds_ceiling',
        ceiling: authRow.ceiling,
        amount: caseRow.amount,
        actor: authRow.actor,
        caseId: caseRow.id,
        actorMode,
        enterpriseAuthStatus,
      });
    }
    const assignments = db.prepare('SELECT * FROM gov_assignment WHERE case_id = ? AND actor = ? ORDER BY id').all(caseRow.id, authRow.actor);
    const validAssignment = assignments.find(a => a.accepted_at !== null || (asOfMinute >= a.assigned_at && asOfMinute <= a.accept_by));
    if (!validAssignment) {
      return response.status(403).json({
        error: 'assignment_expired_or_unassigned',
        caseId: caseRow.id,
        actor: authRow.actor,
        deputy: authRow.deputy,
        asOfMinute,
        actorMode,
        enterpriseAuthStatus,
      });
    }
    return response.json({
      data_class,
      sourceMode: 'LIVE_SQLITE_BANK_QUERY',
      actorMode,
      enterpriseAuthStatus,
      allowed: true,
      caseId: caseRow.id,
      actor: authRow.actor,
      ceiling: authRow.ceiling,
      amount: caseRow.amount,
      assignment: validAssignment,
    });
  }));

  // R5: Many-to-many Commitment <-> Issue <-> Option endpoints
  router.get('/cases/:id/links', withScenario((db, request, response, scenario) => {
    const workspace = getWorkspace(request, response, true);
    const effects = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(scenario.id);
    const workspaceLinks = storage.readTotalDemoCaseLinks(workspace, scenario.id);
    const links = buildScenarioLinks(scenario, effects, workspaceLinks);
    response.json({
      data_class,
      scenarioId: scenario.id,
      issueId: makeIssueId(scenario),
      optionId: makeOptionId(scenario),
      links,
    });
  }));

  router.post('/cases/:id/links', express.json({ limit: '8kb' }), withScenario((db, request, response, scenario) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const body = request.body || {};
    const { commitmentId, reviewStatus, evidenceRef = null, actor = 'OWNER' } = body;
    const parsed = parseCommitmentId(commitmentId);
    if (!parsed || parsed.anchor !== scenario.anchor ||
        typeof reviewStatus !== 'string' || !reviewStatuses.has(reviewStatus) ||
        typeof actor !== 'string' || !actor.trim() || actor.length > 80 ||
        (evidenceRef !== null && (typeof evidenceRef !== 'string' || !evidenceRef.trim() || evidenceRef.length > 160))) {
      return response.status(400).json({ error: 'invalid_link_request' });
    }
    if ((reviewStatus === 'CONFIRMED' || reviewStatus === 'OBSERVED') && !evidenceRef) {
      return response.status(400).json({ error: 'evidence_ref_required' });
    }
    const effectType = parsed.node === 'donor_delivery' ? 'SIDE_EFFECT_DONOR' : 'DIRECT';
    const saved = storage.saveTotalDemoCommitmentLink(workspace, {
      scenarioId: scenario.id,
      commitmentId: parsed.commitmentId,
      issueId: makeIssueId(scenario),
      optionId: makeOptionId(scenario),
      effectType,
      reviewStatus,
      evidenceRef: evidenceRef ? evidenceRef.trim() : null,
      actor: actor.trim(),
    });
    const effects = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(scenario.id);
    const links = buildScenarioLinks(scenario, effects, storage.readTotalDemoCaseLinks(workspace, scenario.id));
    return response.status(201).json({ data_class, saved, links });
  }));

  router.get('/commitments/:commitmentId/links', serve((db, request, response) => {
    const parsed = parseCommitmentId(request.params.commitmentId);
    if (!parsed) return response.status(400).json({ error: 'invalid_commitment_id' });
    const anchorRow = db.prepare('SELECT * FROM anchor WHERE id = ?').get(parsed.anchor);
    if (!anchorRow) return response.status(404).json({ error: 'commitment_not_found' });

    const limitRaw = request.query.limit;
    const offsetRaw = request.query.offset;
    const limit = limitRaw === undefined ? 20 : (/^\d+$/.test(String(limitRaw)) ? Number(limitRaw) : NaN);
    const offset = offsetRaw === undefined ? 0 : (/^\d+$/.test(String(offsetRaw)) ? Number(offsetRaw) : NaN);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isSafeInteger(offset) || offset > 1000000) {
      return response.status(400).json({ error: 'invalid_link_query' });
    }
    const optionFilter = typeof request.query.option === 'string' && request.query.option.trim() ? request.query.option.trim() : null;
    const onlyImpactedDonor = request.query.donorImpacted === 'true';

    const where = ['s.data_class = ?', 's.anchor = ?', 'e.node = ?'];
    const params = [data_class, parsed.anchor, parsed.node];
    if (optionFilter) {
      where.push('s.option = ?');
      params.push(optionFilter);
    }
    if (onlyImpactedDonor) {
      where.push('(e.proposed > e.baseline OR e.without_action > e.baseline)');
    }
    const whereSql = where.join(' AND ');
    const total = db.prepare(`SELECT count(*) AS total FROM scenario s JOIN effect e ON e.scenario = s.id WHERE ${whereSql}`).get(...params).total;
    const rows = db.prepare(`
      SELECT s.*, e.node, e.baseline, e.without_action, e.proposed, e.current_forecast, e.observed
      FROM scenario s
      JOIN effect e ON e.scenario = s.id
      WHERE ${whereSql}
      ORDER BY s.id
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const workspace = getWorkspace(request, response, true);
    const wsLinks = storage.readTotalDemoCommitmentLinks(workspace, parsed.commitmentId);
    const wsByScenario = new Map();
    for (const row of wsLinks) {
      if (!wsByScenario.has(row.scenario_id)) wsByScenario.set(row.scenario_id, row);
    }

    const links = rows.map(row => {
      const reviewed = wsByScenario.get(row.id);
      const donorImpacted = row.node === 'donor_delivery' && (
        (row.proposed !== null && row.proposed > row.baseline) ||
        (row.without_action !== null && row.without_action > row.baseline)
      );
      let defaultStatus = 'UNKNOWN';
      let defaultEvidenceRef = null;
      if (row.observed !== null && row.observed !== undefined) {
        defaultStatus = 'OBSERVED';
        defaultEvidenceRef = `BANK_SCENARIO:${row.id}:${row.node}`;
      } else if (row.node === 'donor_delivery' && !donorImpacted && row.proposed !== null && row.without_action !== null) {
        defaultStatus = 'NO_EFFECT';
        defaultEvidenceRef = `BANK_SCENARIO:${row.id}:${row.node}`;
      }
      return {
        scenarioId: row.id,
        commitmentId: parsed.commitmentId,
        issueId: makeIssueId(row),
        optionId: makeOptionId(row),
        stage: row.stage,
        resource: row.resource,
        option: row.option,
        profile: row.profile,
        gate: row.gate,
        decision: row.decision,
        outcome: row.outcome,
        effectType: row.node === 'donor_delivery' ? 'SIDE_EFFECT_DONOR' : 'DIRECT',
        donorImpacted,
        reviewStatus: reviewed ? reviewed.review_status : defaultStatus,
        version: reviewed ? reviewed.version : 1,
        evidenceRef: reviewed ? reviewed.evidence_ref : defaultEvidenceRef,
        baseline: row.baseline,
        without_action: row.without_action,
        proposed: row.proposed,
        current_forecast: row.current_forecast,
        observed: row.observed,
      };
    });

    const donorSideEffectSummary = db.prepare(`
      SELECT count(*) AS total
      FROM scenario s
      JOIN effect e ON e.scenario = s.id
      WHERE s.data_class = ? AND s.anchor = ? AND e.node = 'donor_delivery' AND e.proposed > e.baseline
    `).get(data_class, parsed.anchor);
    const lessons = storage.readTotalDemoLessons(workspace, { anchor: parsed.anchor });

    response.json({
      data_class,
      commitmentId: parsed.commitmentId,
      anchor: anchorRow,
      node: parsed.node,
      effectType: parsed.node === 'donor_delivery' ? 'SIDE_EFFECT_DONOR' : 'DIRECT',
      total,
      limit,
      offset,
      donorImpactedScenarioCount: donorSideEffectSummary.total,
      links,
      lessons,
    });
  }));

  router.get('/issues/:id/commitments', withScenario((db, request, response, scenario) => {
    const workspace = getWorkspace(request, response, true);
    const effects = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(scenario.id);
    const links = buildScenarioLinks(scenario, effects, storage.readTotalDemoCaseLinks(workspace, scenario.id));
    const lessons = storage.readTotalDemoLessons(workspace, { scenarioId: scenario.id });
    response.json({
      data_class,
      scenarioId: scenario.id,
      issueId: makeIssueId(scenario),
      optionId: makeOptionId(scenario),
      anchor: scenario.anchor,
      stage: scenario.stage,
      resource: scenario.resource,
      option: scenario.option,
      directCommitments: links.filter(item => item.effectType === 'DIRECT'),
      donorSideEffectCommitments: links.filter(item => item.effectType === 'SIDE_EFFECT_DONOR'),
      commitments: links,
      lessons,
    });
  }));

  // R9: Server-controlled simulation clock & Portfolio-scoped transactional reservations
  router.get('/clock', serve((_db, request, response) => {
    const portfolioId = parsePortfolioId(request.query.portfolio_id);
    if (!portfolioId) return response.status(400).json({ error: 'invalid_portfolio_id' });
    const workspace = getWorkspace(request, response, true);
    response.json({ data_class, ...storage.readTotalDemoClock(workspace, portfolioId) });
  }));

  router.post('/clock/advance', express.json({ limit: '4kb' }), serve((_db, request, response) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const body = request.body || {};
    const portfolioId = parsePortfolioId(body.portfolio_id);
    const minute = body.minute;
    if (!portfolioId || !Number.isSafeInteger(minute) || minute < 0 || minute > 10000000) {
      return response.status(400).json({ error: 'invalid_clock_request' });
    }
    const result = storage.advanceTotalDemoClock(workspace, portfolioId, minute);
    if (result.error) return response.status(400).json(result);
    return response.json({ data_class, ...result });
  }));

  router.get('/reservations', serve((_db, request, response) => {
    if (request.query.now !== undefined) {
      return response.status(400).json({ error: 'client_time_forbidden' });
    }
    const portfolioId = parsePortfolioId(request.query.portfolio_id);
    if (!portfolioId) return response.status(400).json({ error: 'invalid_portfolio_id' });
    const workspace = getWorkspace(request, response, true);
    const resource = typeof request.query.resource === 'string' && request.query.resource.trim() ? request.query.resource.trim() : null;
    const clock = storage.readTotalDemoClock(workspace, portfolioId);
    const serverNow = clock.currentMinute;
    const { reservations, attempts } = storage.readTotalDemoReservations(workspace, { resource, portfolioId });
    response.json({
      data_class,
      engine: 'LIVE_SQLITE_TRANSACTION',
      portfolioId,
      clock,
      serverNow,
      reservations: reservations.map(row => ({ ...row, active: row.expires_at > serverNow && row.end_min > serverNow })),
      attempts,
    });
  }));

  router.get('/cases/:id', withScenario((db, request, response, scenario) =>
    response.json(caseState(db, storage, getWorkspace(request, response, true), scenario))));

  router.post('/cases/:id/actions', express.json({ limit: '8kb' }), withScenario((db, request, response, scenario) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const body = request.body || {};
    if (Object.hasOwn(body, 'recorder') && body.recorder !== undefined) {
      return response.status(400).json({ error: 'client_recorder_forbidden' });
    }
    const { revision, action, actor, reason, verifier, evidenceVersion, evidenceRef, reuseCondition, observedOverrides } = body;
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof action !== 'string' || typeof actor !== 'string' ||
        typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
      return response.status(400).json({ error: 'invalid_case_action' });
    }
    if (verifier !== undefined && (typeof verifier !== 'string' || !verifier.trim() || verifier.length > 160)) {
      return response.status(400).json({ error: 'invalid_case_action' });
    }
    if (evidenceVersion !== undefined && (!Number.isSafeInteger(evidenceVersion) || evidenceVersion <= 0)) {
      return response.status(400).json({ error: 'invalid_case_action' });
    }
    if (evidenceRef !== undefined && evidenceRef !== null && (typeof evidenceRef !== 'string' || !evidenceRef.trim() || evidenceRef.length > 160)) {
      return response.status(400).json({ error: 'invalid_case_action' });
    }
    if (reuseCondition !== undefined && (typeof reuseCondition !== 'string' || !reuseCondition.trim() || reuseCondition.length > 500)) {
      return response.status(400).json({ error: 'invalid_case_action' });
    }
    let overrideMap = null;
    if (observedOverrides !== undefined) {
      if (action !== 'OBSERVE' || !Array.isArray(observedOverrides) || !observedOverrides.length ||
          typeof evidenceRef !== 'string' || !evidenceRef.trim()) {
        return response.status(400).json({ error: 'invalid_case_action' });
      }
      overrideMap = new Map();
      for (const entry of observedOverrides) {
        if (!entry || typeof entry !== 'object' || !knownNodes.has(entry.node) ||
            (entry.observed !== null && (!Number.isSafeInteger(entry.observed) || entry.observed < 0 || entry.observed > 100000))) {
          return response.status(400).json({ error: 'invalid_case_action' });
        }
        overrideMap.set(entry.node, entry.observed);
      }
    }
    const state = caseState(db, storage, workspace, scenario);
    if (revision !== state.revision) return response.status(409).json({ error: 'revision_conflict', ...state });
    const next = availableTransitions(scenario, state.status).find(([code, role]) => code === action && role === actor);
    if (!next) return response.status(403).json({ error: 'action_not_allowed', ...state });

    const expectedEvidenceVersion = state.approvedSnapshot ? state.approvedSnapshot.decisionRevision : state.revision;
    if (evidenceVersion !== undefined && evidenceVersion !== expectedEvidenceVersion) {
      return response.status(409).json({ error: 'stale_evidence_version', expectedEvidenceVersion, ...state });
    }

    const serverRecorder = deriveServerRecorder(state.history, actor);
    const trimmedVerifier = typeof verifier === 'string' ? verifier.trim() : null;
    if (trimmedVerifier && (
      trimmedVerifier.toUpperCase() === actor.toUpperCase() ||
      trimmedVerifier.toUpperCase() === serverRecorder.toUpperCase()
    )) {
      return response.status(403).json({ error: 'self_verification_forbidden', serverRecorder, ...state });
    }

    const evidence = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY node').all(scenario.id);
    const orderedEffects = db.prepare('SELECT * FROM effect WHERE scenario = ? ORDER BY rowid').all(scenario.id);
    const source = createHash('sha256').update(JSON.stringify({ scenario, evidence })).digest('hex');
    const approvedEffects = action === 'APPROVE'
      ? orderedEffects.map(item => ({
          node: item.node,
          baseline: item.baseline,
          without_action: item.without_action,
          proposed: item.proposed,
          approved_forecast: item.proposed,
        }))
      : null;
    const observedEffects = action === 'OBSERVE'
      ? orderedEffects.map(item => ({
          node: item.node,
          baseline: item.baseline,
          current_forecast: item.current_forecast,
          observed: overrideMap && overrideMap.has(item.node) ? overrideMap.get(item.node) : item.observed,
        }))
      : null;

    let lesson = null;
    if (action === 'CLOSE') {
      const latestObs = state.observations.at(-1) || null;
      const defaultReuse = `stage=${scenario.stage}; resource=${scenario.resource}; option=${scenario.option}`;
      const normalizedReuse = typeof reuseCondition === 'string' ? reuseCondition.trim() : defaultReuse;
      if (state.status === 'OBSERVED' && state.approvedSnapshot && latestObs) {
        lesson = {
          anchor: scenario.anchor,
          closureType: 'OUTCOME_BASED_LESSON',
          decisionRevision: state.approvedSnapshot.decisionRevision,
          observationRevision: latestObs.revision,
          evidenceRef: (typeof evidenceRef === 'string' && evidenceRef.trim()) ? evidenceRef.trim() : (latestObs.evidenceRef ?? `OBS_REV:${latestObs.revision}`),
          reuseCondition: normalizedReuse,
          summary: reason.trim(),
        };
      } else if (state.status === 'DECLINED') {
        lesson = {
          anchor: scenario.anchor,
          closureType: 'DECLINED_CLOSURE_NOTE',
          decisionRevision: null,
          observationRevision: null,
          evidenceRef: (typeof evidenceRef === 'string' && evidenceRef.trim()) ? evidenceRef.trim() : null,
          reuseCondition: normalizedReuse,
          summary: reason.trim(),
        };
      }
    }

    const outcome = storage.appendTotalDemoAction(workspace, scenario.id, revision, {
      source,
      action,
      actor,
      serverRecorder,
      reason: reason.trim(),
      status: next[2],
      optionCode: scenario.option,
      approvedEffects,
      observedEffects,
      verifier: trimmedVerifier,
      sourceType: 'WORKSPACE_DEMO_OBSERVATION',
      evidenceRef: typeof evidenceRef === 'string' ? evidenceRef.trim() : null,
      outcome: scenario.outcome,
      lesson,
    });
    if (outcome.error) return response.status(409).json({ ...caseState(db, storage, workspace, scenario), error: outcome.error });
    return response.json(caseState(db, storage, workspace, scenario));
  }));

  // R7: Independent Version-Bound Verification Endpoint
  router.post('/cases/:id/verifications', express.json({ limit: '8kb' }), withScenario((db, request, response, scenario) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const body = request.body || {};
    if (Object.hasOwn(body, 'recorder') && body.recorder !== undefined) {
      return response.status(400).json({ error: 'client_recorder_forbidden' });
    }
    const { kind, targetRevision, decisionRevision, verifier, documentRef = null, period = null, evidenceRef = null } = body;
    if (typeof kind !== 'string' || !verificationKinds.has(kind) ||
        !Number.isSafeInteger(targetRevision) || targetRevision <= 0 ||
        typeof verifier !== 'string' || !verifier.trim() || verifier.length > 160 ||
        (decisionRevision !== undefined && (!Number.isSafeInteger(decisionRevision) || decisionRevision <= 0)) ||
        (documentRef !== null && (typeof documentRef !== 'string' || !documentRef.trim() || documentRef.length > 80)) ||
        (period !== null && (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period))) ||
        (evidenceRef !== null && (typeof evidenceRef !== 'string' || !evidenceRef.trim() || evidenceRef.length > 160))) {
      return response.status(400).json({ error: 'invalid_verification_request' });
    }
    const state = caseState(db, storage, workspace, scenario);
    if (targetRevision !== state.revision) {
      return response.status(409).json({ error: 'stale_evidence_version', expectedRevision: state.revision, ...state });
    }
    if (decisionRevision !== undefined && (!state.approvedSnapshot || decisionRevision !== state.approvedSnapshot.decisionRevision)) {
      return response.status(409).json({ error: 'stale_evidence_version', expectedDecisionRevision: state.approvedSnapshot?.decisionRevision ?? null, ...state });
    }
    const targetHistory = state.history.find(item => item.revision === targetRevision);
    if (!targetHistory) {
      return response.status(409).json({ error: 'stale_evidence_version', ...state });
    }
    const serverRecorder = targetHistory.actor;
    const trimmedVerifier = verifier.trim();
    if (trimmedVerifier.toLowerCase() === serverRecorder.toLowerCase()) {
      return response.status(403).json({ error: 'self_verification_forbidden', serverRecorder, ...state });
    }
    if (kind === 'FINANCIAL') {
      if (!documentRef || !period || !evidenceRef) {
        return response.status(422).json({ error: 'invalid_financial_evidence', reason: 'document_period_evidence_required' });
      }
      const plan = db.prepare('SELECT * FROM finance_plan ORDER BY id LIMIT 1').get();
      const posting = db.prepare('SELECT * FROM finance_posting WHERE document = ?').get(documentRef.trim());
      if (!posting || !plan || posting.period !== period || period !== plan.period || posting.kind === 'INTERNAL' || posting.matched_document !== null) {
        return response.status(422).json({
          error: 'invalid_financial_evidence',
          reason: !posting ? 'posting_not_found' : (posting.kind === 'INTERNAL' || posting.matched_document !== null ? 'internal_transfer_excluded' : 'period_mismatch'),
        });
      }
    }
    const verification = storage.recordTotalDemoVerification(workspace, {
      scenarioId: scenario.id,
      kind,
      targetRevision,
      decisionRevision: state.approvedSnapshot?.decisionRevision ?? null,
      recorder: serverRecorder,
      verifier: trimmedVerifier,
      documentRef: documentRef ? documentRef.trim() : null,
      period,
      evidenceRef: evidenceRef ? evidenceRef.trim() : null,
    });
    return response.status(201).json({
      data_class,
      verification,
      case: caseState(db, storage, workspace, scenario),
    });
  }));

  // R16: Retrievable Lessons Learned (Outcome-based vs Declined Closure Note)
  router.get('/lessons', serve((db, request, response) => {
    const workspace = getWorkspace(request, response, true);
    const scenarioId = typeof request.query.scenarioId === 'string' && request.query.scenarioId.trim() ? request.query.scenarioId.trim() : null;
    const commitmentIdRaw = typeof request.query.commitmentId === 'string' && request.query.commitmentId.trim() ? request.query.commitmentId.trim() : null;
    let anchor = typeof request.query.anchor === 'string' && request.query.anchor.trim() ? request.query.anchor.trim() : null;
    if (scenarioId && !casePattern.test(scenarioId)) {
      return response.status(400).json({ error: 'invalid_lesson_query' });
    }
    if (commitmentIdRaw) {
      const parsed = parseCommitmentId(commitmentIdRaw);
      if (!parsed) return response.status(400).json({ error: 'invalid_commitment_id' });
      anchor = parsed.anchor;
    }
    if (anchor && !db.prepare('SELECT 1 AS found FROM anchor WHERE id = ?').get(anchor)) {
      return response.status(404).json({ error: 'commitment_not_found' });
    }
    const items = storage.readTotalDemoLessons(workspace, { scenarioId, anchor });
    response.json({ data_class, scenarioId, anchor, items });
  }));

  router.post('/cases/:id/lessons', express.json({ limit: '8kb' }), withScenario((db, request, response, scenario) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const body = request.body || {};
    const { closureType, reuseCondition, summary, evidenceRef = null, actor = 'EXPERT' } = body;
    if (!['OUTCOME_BASED_LESSON', 'DECLINED_CLOSURE_NOTE'].includes(closureType) ||
        typeof reuseCondition !== 'string' || !reuseCondition.trim() || reuseCondition.length > 500 ||
        typeof summary !== 'string' || !summary.trim() || summary.length > 1000 ||
        typeof actor !== 'string' || !actor.trim() || actor.length > 80 ||
        (evidenceRef !== null && (typeof evidenceRef !== 'string' || !evidenceRef.trim() || evidenceRef.length > 160))) {
      return response.status(400).json({ error: 'invalid_lesson_request' });
    }
    const state = caseState(db, storage, workspace, scenario);
    const latestObs = state.observations.at(-1) || null;
    if (closureType === 'OUTCOME_BASED_LESSON') {
      if (!state.approvedSnapshot || !latestObs) {
        return response.status(409).json({ error: 'observation_required_for_lesson', ...state });
      }
      const lesson = storage.recordTotalDemoLesson(workspace, {
        scenarioId: scenario.id,
        anchor: scenario.anchor,
        closureType: 'OUTCOME_BASED_LESSON',
        decisionRevision: state.approvedSnapshot.decisionRevision,
        observationRevision: latestObs.revision,
        evidenceRef: evidenceRef ? evidenceRef.trim() : (latestObs.evidenceRef ?? `OBS_REV:${latestObs.revision}`),
        reuseCondition: reuseCondition.trim(),
        summary: summary.trim(),
        actor: actor.trim(),
      });
      return response.status(201).json({ data_class, lesson, case: caseState(db, storage, workspace, scenario) });
    }
    const wasDeclined = state.status === 'DECLINED' || state.history.some(h => h.action === 'DECLINE');
    if (!wasDeclined) {
      return response.status(409).json({ error: 'decline_required_for_note', ...state });
    }
    const lesson = storage.recordTotalDemoLesson(workspace, {
      scenarioId: scenario.id,
      anchor: scenario.anchor,
      closureType: 'DECLINED_CLOSURE_NOTE',
      decisionRevision: null,
      observationRevision: null,
      evidenceRef: evidenceRef ? evidenceRef.trim() : null,
      reuseCondition: reuseCondition.trim(),
      summary: summary.trim(),
      actor: actor.trim(),
    });
    return response.status(201).json({ data_class, lesson, case: caseState(db, storage, workspace, scenario) });
  }));

  router.post('/cases/:id/reservations', express.json({ limit: '8kb' }), withScenario((db, request, response, scenario) => {
    if (!allowWrite(request)) return response.status(403).json({ error: 'cross_origin_write' });
    const workspace = getWorkspace(request, response, false);
    if (!workspace) return response.status(428).json({ error: 'workspace_required' });
    const body = request.body || {};
    if (Object.hasOwn(body, 'now') && body.now !== undefined) {
      return response.status(400).json({ error: 'client_time_forbidden' });
    }
    const portfolioId = parsePortfolioId(body.portfolio_id);
    const start = body.start_min;
    const end = body.end_min;
    const expires = body.expires_at;
    const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
    const decisionRevision = body.decision_revision;
    if (!portfolioId || ![start, end, expires].every(Number.isSafeInteger) ||
        start >= end || !owner || owner.length > 120 ||
        (decisionRevision !== undefined && (!Number.isSafeInteger(decisionRevision) || decisionRevision <= 0))) {
      return response.status(400).json({ error: 'invalid_reservation_request' });
    }
    const result = storage.reserveTotalDemoCapacity(workspace, {
      portfolioId,
      scenarioId: scenario.id,
      decisionRevision,
      resource: scenario.resource,
      owner,
      orderId: `${scenario.id}:${scenario.anchor}`,
      start,
      end,
      expires,
    });
    if (result.error === 'invalid_reservation_window') {
      return response.status(400).json(result);
    }
    if (result.status === 'APPROVAL_REQUIRED') {
      return response.status(403).json({ error: 'approval_required', ...result });
    }
    if (result.status === 'BLOCKED_CONFLICT') {
      return response.status(409).json({ error: 'reservation_conflict', ...result });
    }
    return response.status(201).json({
      data_class,
      engine: 'LIVE_SQLITE_TRANSACTION',
      ...result,
      case: caseState(db, storage, workspace, scenario),
    });
  }));

  return router;
}
