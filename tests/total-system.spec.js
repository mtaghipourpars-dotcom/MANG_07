import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const endpoint = '/api/total-demo';

test('scenario bank filters, paginates, and preserves unknown observations', async ({ request }) => {
  const summaryResponse = await request.get(endpoint + '/summary');
  expect(summaryResponse.ok()).toBeTruthy();
  const summary = await summaryResponse.json();
  expect(summary.data_class).toBe('DEMO_SYNTHETIC');
  expect(summary.operationalStatus).toBe('INTERNAL_SOURCE_REQUIRED');
  expect(summary.actorMode).toBe('DEMO_SIMULATED_ROLE');
  expect(summary.enterpriseAuthStatus).toBe('BLOCKED_INTERNAL_SOURCE_REQUIRED');
  expect(summary.summary.scenarios).toBe(43200);
  expect(summary.filters.anchor).toHaveLength(75);

  const url = endpoint + '/scenarios?stage=quality_fat&profile=unknown&limit=2';
  const firstResponse = await request.get(url);
  expect(firstResponse.ok()).toBeTruthy();
  const first = await firstResponse.json();
  expect(first.total).toBe(450);
  expect(first.items).toHaveLength(2);
  expect(first.items.every(item => item.stage === 'quality_fat' && item.profile === 'unknown')).toBe(true);

  const secondResponse = await request.get(url + '&offset=2');
  expect(secondResponse.ok()).toBeTruthy();
  const second = await secondResponse.json();
  expect(second.offset).toBe(2);
  expect(second.items.every(item => !first.items.some(other => other.id === item.id))).toBe(true);

  const detailResponse = await request.get(endpoint + '/scenarios/' + first.items[0].id);
  expect(detailResponse.ok()).toBeTruthy();
  const detail = await detailResponse.json();
  expect(detail.id).toBe(first.items[0].id);
  expect(detail.event.length).toBeGreaterThan(0);
  expect(detail.effect).toHaveLength(9);
  const fat = detail.effect.find(effect => effect.node === 'quality_fat');
  expect(fat.baseline).not.toBeNull();
  expect(fat.without_action).toBeNull();
  expect(fat.observed).toBeNull();
  expect(detail.anchor_details.id).toBe(detail.anchor);
});

test('scenario bank rejects invalid selection and shows executive evidence with provenance', async ({ request }) => {
  const invalid = await request.get(endpoint + '/scenarios?variant=2');
  expect(invalid.status()).toBe(400);
  const absent = await request.get(endpoint + '/scenarios/S999999');
  expect(absent.status()).toBe(404);
  const response = await request.get(endpoint + '/executive');
  expect(response.ok()).toBeTruthy();
  const { data_class, sourceMode, executive } = await response.json();
  expect(data_class).toBe('DEMO_SYNTHETIC');
  expect(sourceMode).toBe('READ_ONLY_PRECOMPUTED_SCENARIO_BANK');
  expect(executive.promises['24h']).toHaveLength(1);
  expect(executive.promises['72h']).toHaveLength(3);
  expect(executive.order_conflict.requested.status).toBe('BLOCKED_CONFLICT');
  expect(executive.order_conflict.alternative.status).toBe('RESERVED');
});

test('total demo opens four workspaces in both directions and themes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demo/total-system/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'fa');
  await expect(html).toHaveAttribute('dir', 'rtl');

  await page.locator('[data-language="en"]').click();
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  for (const role of ['owner', 'expert', 'assessor', 'executive']) {
    await page.locator('.role-nav [data-role="' + role + '"]').click();
  }
  await page.locator('#sections [data-section="scenarios"]').click();
  await page.locator('#sections [data-section="evidence"]').click();
  await page.locator('#sections [data-section="workspace"]').click();
  await page.locator('[data-theme-choice="light"]').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.locator('[data-language="fa"]').click();
  await expect(html).toHaveAttribute('dir', 'rtl');
  expect(errors).toEqual([]);
});

test('R5: many-to-many commitment <-> issue <-> option links expose donor side-effects and UNKNOWN when evidence is missing', async ({ page, request }) => {
  // 1. From a commitment -> ALL linked issues and options (including donor side-effects)
  const commitmentId = 'PUB-THERMAL-MGG72-SH2::dispatch';
  const fromCommitment = await request.get(endpoint + '/commitments/' + encodeURIComponent(commitmentId) + '/links?limit=10');
  expect(fromCommitment.ok()).toBeTruthy();
  const cData = await fromCommitment.json();
  expect(cData.commitmentId).toBe(commitmentId);
  expect(cData.total).toBeGreaterThan(100);
  expect(cData.donorImpactedScenarioCount).toBeGreaterThan(0);
  expect(cData.links).toHaveLength(10);
  expect(cData.links[0]).toMatchObject({
    commitmentId,
    effectType: 'DIRECT',
    version: 1,
  });
  expect(cData.links[0].issueId).toContain('::');
  expect(cData.links[0].optionId).toContain('::');

  // 2. From a donor commitment -> donor side-effect clearly tagged
  const donorCommitment = 'PUB-THERMAL-MGG72-SH2::donor_delivery';
  const donorRes = await request.get(endpoint + '/commitments/' + encodeURIComponent(donorCommitment) + '/links?option=transfer&donorImpacted=true&limit=5');
  expect(donorRes.ok()).toBeTruthy();
  const donorData = await donorRes.json();
  expect(donorData.effectType).toBe('SIDE_EFFECT_DONOR');
  expect(donorData.links.length).toBeGreaterThan(0);
  expect(donorData.links[0].effectType).toBe('SIDE_EFFECT_DONOR');
  expect(donorData.links[0].donorImpacted).toBe(true);
  expect(donorData.links[0].reviewStatus).toBe('UNKNOWN');
  expect(donorData.links[0].evidenceRef).toBeNull();

  // 3. From an issue (S000051, transfer) -> ALL affected commitments (direct + donor side-effect)
  const fromIssue = await request.get(endpoint + '/issues/S000051/commitments');
  expect(fromIssue.ok()).toBeTruthy();
  const iData = await fromIssue.json();
  expect(iData.directCommitments).toHaveLength(8);
  expect(iData.donorSideEffectCommitments).toHaveLength(1);
  expect(iData.donorSideEffectCommitments[0].donorImpacted).toBe(true);
  expect(iData.donorSideEffectCommitments[0].reviewStatus).toBe('UNKNOWN');
  expect(iData.donorSideEffectCommitments[0].evidenceRef).toBeNull();

  // 4. Attempting to mark a link CONFIRMED without evidenceRef must fail (400)
  const missingEv = await request.post(endpoint + '/cases/S000051/links', {
    data: { commitmentId: donorCommitment, reviewStatus: 'CONFIRMED', evidenceRef: null },
  });
  expect(missingEv.status()).toBe(400);
  expect((await missingEv.json()).error).toBe('evidence_ref_required');

  // 5. Recording a versioned review with evidenceRef increments link version
  const confirmed = await request.post(endpoint + '/cases/S000051/links', {
    data: { commitmentId: donorCommitment, reviewStatus: 'CONFIRMED', evidenceRef: 'DEMO-DONOR-CHECK-01', actor: 'OWNER' },
  });
  expect(confirmed.status()).toBe(201);
  const confirmedBody = await confirmed.json();
  expect(confirmedBody.saved.version).toBe(1);
  expect(confirmedBody.saved.evidenceRef).toBe('DEMO-DONOR-CHECK-01');

  // 6. Browser bidirectional data drill-down (not merely switching tabs)
  await page.goto('/demo/total-system/?scenario=S000013');
  await page.locator('[data-inspect-commitment]').first().click();
  await expect(page.locator('[data-commitment-links-panel]')).toBeVisible();
  await expect(page.locator('[data-commitment-links-panel]')).toContainText('PUB-THERMAL-MGG72-SH2::');
});

test('persisted case enforces role and revision gates as ownership moves across workspaces', async ({ request }) => {
  const url = endpoint + '/cases/S000013';
  const initial = await request.get(url);
  expect(initial.ok()).toBeTruthy();
  const original = await initial.json();
  expect(original.status).toBe('DRAFT');
  const reason = 'Acceptance test records an existing demo scenario transition.';

  const wrongRole = await request.post(url + '/actions', {
    data: { revision: original.revision, action: 'REPORT', actor: 'DECIDER', reason },
  });
  expect(wrongRole.status()).toBe(403);
  const unchanged = await request.get(url);
  expect(await unchanged.json()).toEqual(original);

  let current = original;
  for (const [action, actor, status] of [
    ['REPORT', 'EXPERT', 'REPORTED'],
    ['SCOPE', 'OWNER', 'SCOPED'],
    ['ASSESS', 'ASSESSOR', 'ASSESSED'],
    ['APPROVE', 'DECIDER', 'APPROVED'],
    ['EXECUTE', 'OWNER', 'EXECUTED'],
    ['OBSERVE', 'OWNER', 'OBSERVED'],
    ['CLOSE', 'EXPERT', 'CLOSED'],
  ]) {
    const data = { revision: current.revision, action, actor, reason };
    const accepted = await request.post(url + '/actions', { data });
    expect(accepted.ok(), action + ' must succeed from ' + current.status).toBeTruthy();
    current = await accepted.json();
    expect(current.status).toBe(status);
    expect(current.revision).toBe(data.revision + 1);
    expect(current.history.at(-1)).toMatchObject({ action, actor, reason, status });
    const replay = await request.post(url + '/actions', { data });
    expect(replay.status(), action + ' must reject an old revision').toBe(409);
    const saved = await request.get(url);
    expect(await saved.json()).toEqual(current);
  }
  expect(current.allowedActions).toEqual([]);
});

test('R6 & R7: blocks enterprise mode, forbids client recorder, enforces server-derived self-verification, stale version, and live authority ceilings', async ({ request }) => {
  // Enterprise mode is explicitly BLOCKED (INTERNAL_SOURCE_REQUIRED)
  const enterpriseBlocked = await request.get(endpoint + '/governance/queue?mode=enterprise');
  expect(enterpriseBlocked.status()).toBe(503);
  const entBody = await enterpriseBlocked.json();
  expect(entBody.error).toBe('enterprise_authority_required');
  expect(entBody.status).toBe('BLOCKED');

  // Out-of-ceiling OPS cannot approve EXEC-FIN-01 (amount 480 > ceiling 200 & policy_ceo=1)
  const opsBlocked = await request.post(endpoint + '/governance/evaluate', {
    data: { caseId: 'EXEC-FIN-01', actor: 'OPS', asOfMinute: 0 },
  });
  expect(opsBlocked.status()).toBe(403);
  expect((await opsBlocked.json()).error).toBe('authority_exceeded');

  // Expired OPS assignment on EXEC-GOV-02 rejected, while OPS-DEPUTY within [0, 60] is allowed
  const expiredOps = await request.post(endpoint + '/governance/evaluate', {
    data: { caseId: 'EXEC-GOV-02', actor: 'OPS', asOfMinute: 0 },
  });
  expect(expiredOps.status()).toBe(403);
  expect((await expiredOps.json()).error).toBe('assignment_expired_or_unassigned');

  const deputyOk = await request.post(endpoint + '/governance/evaluate', {
    data: { caseId: 'EXEC-GOV-02', actor: 'OPS-DEPUTY', asOfMinute: 15 },
  });
  expect(deputyOk.status()).toBe(200);
  expect((await deputyOk.json()).allowed).toBe(true);

  // Client-supplied recorder must be rejected with 400
  const url = endpoint + '/cases/S000013';
  const initial = await (await request.get(url)).json();
  const forgedRecorder = await request.post(url + '/actions', {
    data: { revision: initial.revision, action: 'REPORT', actor: 'EXPERT', recorder: 'FAKE', reason: 'Forged recorder must fail' },
  });
  expect(forgedRecorder.status()).toBe(400);
  expect((await forgedRecorder.json()).error).toBe('client_recorder_forbidden');

  // Record REPORT (rev 1, actor EXPERT) then test version-bound verification
  const rep = await request.post(url + '/actions', {
    data: { revision: initial.revision, action: 'REPORT', actor: 'EXPERT', reason: 'Initial report' },
  });
  expect(rep.ok()).toBeTruthy();
  const rev1 = await rep.json();

  // Self-verification on rev 1 (serverRecorder = EXPERT) must fail 403
  const selfVer = await request.post(url + '/verifications', {
    data: { kind: 'OPERATIONAL', targetRevision: rev1.revision, verifier: 'EXPERT', evidenceRef: 'DEMO-EV-1' },
  });
  expect(selfVer.status()).toBe(403);
  expect((await selfVer.json()).error).toBe('self_verification_forbidden');

  // Move to rev 2 (SCOPE) and verify stale targetRevision=1 fails with 409
  const sc = await request.post(url + '/actions', {
    data: { revision: rev1.revision, action: 'SCOPE', actor: 'OWNER', reason: 'Scope confirmed' },
  });
  expect(sc.ok()).toBeTruthy();
  const rev2 = await sc.json();

  const staleVer = await request.post(url + '/verifications', {
    data: { kind: 'OPERATIONAL', targetRevision: 1, verifier: 'REVIEWER', evidenceRef: 'DEMO-EV-1' },
  });
  expect(staleVer.status()).toBe(409);
  expect((await staleVer.json()).error).toBe('stale_evidence_version');

  // Independent verifier on current rev 2 succeeds
  const validVer = await request.post(url + '/verifications', {
    data: { kind: 'OPERATIONAL', targetRevision: rev2.revision, verifier: 'REVIEWER', evidenceRef: 'DEMO-EV-2' },
  });
  expect(validVer.status()).toBe(201);
  const verBody = await validVer.json();
  expect(verBody.verification.recorder).toBe('OWNER');
  expect(verBody.verification.verifier).toBe('REVIEWER');

  // Financial verification rejects excluded internal transfer SYN-SET-01 (422) and accepts valid SYN-MAT-01 in 2026-11
  const badFinVer = await request.post(url + '/verifications', {
    data: { kind: 'FINANCIAL', targetRevision: rev2.revision, verifier: 'FIN-CONTROLLER', documentRef: 'SYN-SET-01', period: '2026-11', evidenceRef: 'DEMO-FIN-1' },
  });
  expect(badFinVer.status()).toBe(422);
  expect((await badFinVer.json()).error).toBe('invalid_financial_evidence');

  const okFinVer = await request.post(url + '/verifications', {
    data: { kind: 'FINANCIAL', targetRevision: rev2.revision, verifier: 'FIN-CONTROLLER', documentRef: 'SYN-MAT-01', period: '2026-11', evidenceRef: 'DEMO-FIN-1' },
  });
  expect(okFinVer.status()).toBe(201);
});

test('unknown evidence prevents approval and keeps the current revision', async ({ request }) => {
  const url = endpoint + '/cases/S000005';
  let current = await (await request.get(url)).json();
  for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR']]) {
    const response = await request.post(url + '/actions', {
      data: { revision: current.revision, action, actor, reason: 'Readiness acceptance test' },
    });
    expect(response.ok()).toBeTruthy();
    current = await response.json();
  }
  expect(current.allowedActions.some(item => item.action === 'APPROVE')).toBe(false);
  const response = await request.post(url + '/actions', {
    data: { revision: current.revision, action: 'APPROVE', actor: 'DECIDER', reason: 'Readiness acceptance test' },
  });
  expect(response.status()).toBe(403);
  expect(await (await request.get(url)).json()).toEqual(current);
});

test('browser hands the same scenario through all four workspaces and reload retains its result', async ({ page }) => {
  await page.goto('/demo/total-system/?scenario=S000013');
  const workspace = role => page.locator('.role-nav [data-role="' + role + '"]');
  const command = action => page.locator('[data-case-action] [data-action="' + action + '"]');
  for (const [role, action] of [
    ['expert', 'REPORT'],
    ['owner', 'SCOPE'],
    ['assessor', 'ASSESS'],
    ['executive', 'APPROVE'],
    ['owner', 'EXECUTE'],
    ['owner', 'OBSERVE'],
    ['expert', 'CLOSE'],
  ]) {
    await workspace(role).click();
    await page.locator('[data-case-action] [name="reason"]').fill('UAT ' + action);
    await command(action).click();
    await expect(command(action)).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator('#screen')).toContainText('S000013');
  await expect(page.locator('#screen')).toContainText('UAT CLOSE');
  await expect(command('REPORT')).toHaveCount(0);
});

test('R10: approved forecast stays immutable after observe, separates primary vs donor risk, and never marks partial/donor-missing verified', async ({ page, request }) => {
  const url = endpoint + '/cases/S000013';
  const before = await (await request.get(url)).json();
  expect(before.approvedSnapshot).toBeNull();
  expect(before.primaryChainRiskStatus).toBe('UNVERIFIED_OPEN');
  expect(before.donorSideEffectRiskStatus).toBe('NO_DONOR_IMPACT');
  expect(before.remainingRiskStatus).toBe('UNVERIFIED_OPEN');

  // Donor-impacted transfer scenario (S000051) keeps donorSideEffectRiskStatus = UNVERIFIED_OPEN
  const transferState = await (await request.get(endpoint + '/cases/S000051')).json();
  expect(transferState.donorSideEffectRiskStatus).toBe('UNVERIFIED_OPEN');
  expect(transferState.remainingRiskStatus).toBe('UNVERIFIED_OPEN');

  // Partially verified scenario (S000014, engineering..acceptance delayed AND collection.observed === null)
  // MUST preserve confirmed delay (LATE_REALIZED_PARTIAL_UNKNOWN) while surfacing unknownNodes=['collection']
  let partial = await (await request.get(endpoint + '/cases/S000014')).json();
  for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR'], ['APPROVE', 'DECIDER'], ['EXECUTE', 'OWNER']]) {
    partial = await (await request.post(endpoint + '/cases/S000014/actions', {
      data: { revision: partial.revision, action, actor, reason: 'Partial ' + action },
    })).json();
  }
  const partialObs = await (await request.post(endpoint + '/cases/S000014/actions', {
    data: { revision: partial.revision, action: 'OBSERVE', actor: 'OWNER', verifier: 'REVIEWER', reason: 'Partial observe' },
  })).json();
  expect(partialObs.primaryChainRiskStatus).toBe('LATE_REALIZED_PARTIAL_UNKNOWN');
  expect(partialObs.remainingRiskStatus).toBe('LATE_REALIZED_PARTIAL_UNKNOWN');
  expect(partialObs.observedDelayConfirmed).toBe(true);
  expect(partialObs.unknownNodes).toEqual(['collection']);

  await page.goto('/demo/total-system/?scenario=S000013');
  const directTable = page.locator('[data-effect-group="direct"] table');
  const donorTable = page.locator('[data-effect-group="donor"] table');
  await expect(directTable).toBeVisible();
  await expect(donorTable).toBeVisible();
  const firstDirectApprovedCell = directTable.locator('tbody tr').first().locator('td').nth(4);
  await expect(firstDirectApprovedCell).toContainText('نامشخص');

  await directTable.locator('tbody tr').first().locator('[data-role="expert"]').click();
  await expect(page.locator('[data-expert-issue]')).toContainText('S000013');
  await page.locator('[data-expert-issue] [data-role="owner"]').first().click();
  await expect(page.locator('[data-owner-commitments]')).toBeVisible();

  let current = before;
  for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR'], ['APPROVE', 'DECIDER']]) {
    const res = await request.post(url + '/actions', { data: { revision: current.revision, action, actor, reason: 'Stage2 ' + action } });
    expect(res.ok()).toBeTruthy();
    current = await res.json();
  }
  expect(current.approvedSnapshot).not.toBeNull();
  expect(current.approvedSnapshot.decisionRevision).toBe(4);
  expect(current.reservations).toEqual([]);
  expect(current.remainingRiskStatus).toBe('UNVERIFIED_OPEN');
  const frozenSnapshot = JSON.stringify(current.approvedSnapshot);

  current = await (await request.post(url + '/actions', { data: { revision: current.revision, action: 'EXECUTE', actor: 'OWNER', reason: 'Stage2 EXECUTE' } })).json();

  // Stale evidenceVersion rejected with 409
  const staleObs = await request.post(url + '/actions', {
    data: { revision: current.revision, action: 'OBSERVE', actor: 'OWNER', verifier: 'REVIEWER', evidenceVersion: 1, reason: 'Stale version' },
  });
  expect(staleObs.status()).toBe(409);
  expect((await staleObs.json()).error).toBe('stale_evidence_version');

  // Self-verification rejected (serverRecorder is OWNER from EXECUTE)
  const selfVerify = await request.post(url + '/actions', {
    data: { revision: current.revision, action: 'OBSERVE', actor: 'OWNER', verifier: 'OWNER', reason: 'Self check must fail' },
  });
  expect(selfVerify.status()).toBe(403);
  expect((await selfVerify.json()).error).toBe('self_verification_forbidden');

  // Workspace observation recording donor side-effect delay + unknown node keeps approvedSnapshot immutable and surfaces donor LATE_REALIZED
  const obsRes = await request.post(url + '/actions', {
    data: {
      revision: current.revision,
      action: 'OBSERVE',
      actor: 'OWNER',
      verifier: 'REVIEWER',
      evidenceVersion: 4,
      evidenceRef: 'DEMO-OBS-013',
      observedOverrides: [
        { node: 'donor_delivery', observed: 40 },
        { node: 'collection', observed: null },
      ],
      reason: 'Independent observation with donor delay and unknown collection',
    },
  });
  expect(obsRes.ok()).toBeTruthy();
  current = await obsRes.json();
  expect(JSON.stringify(current.approvedSnapshot)).toBe(frozenSnapshot);
  expect(current.observations).toHaveLength(1);
  expect(current.observations[0].verifier).toBe('REVIEWER');
  expect(current.observations[0].sourceType).toBe('WORKSPACE_DEMO_OBSERVATION');
  expect(current.observations[0].evidenceRef).toBe('DEMO-OBS-013');
  expect(current.donorSideEffectRiskStatus).toBe('LATE_REALIZED');
  expect(current.primaryChainRiskStatus).toBe('LATE_REALIZED_PARTIAL_UNKNOWN');
  expect(current.remainingRiskStatus).toBe('LATE_REALIZED_PARTIAL_UNKNOWN');
  expect(current.observedDelayConfirmed).toBe(true);
  expect(current.unknownNodes).toEqual(['collection']);
});

test('R9: two distinct sessions sharing one portfolio enforce atomic overlap conflict, adjacency, server-clock expiry release, and independent portfolio isolation', async ({ playwright, baseURL }) => {
  const sessionA = await playwright.request.newContext({ baseURL });
  const sessionB = await playwright.request.newContext({ baseURL });
  const runSuffix = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const sharedPortfolio = 'PF-SHARED-' + runSuffix;
  const altPortfolio = 'PF-ALT-' + runSuffix;

  try {
    const listRes = await sessionA.get(endpoint + '/scenarios?resource=drawing&gate=FEASIBLE&decision=APPROVED&limit=2');
    expect(listRes.ok()).toBeTruthy();
    const { items } = await listRes.json();
    expect(items).toHaveLength(2);
    const [firstId, secondId] = items.map(item => item.id);

    // Bootstrap two DISTINCT workspace cookies (sessionA vs sessionB)
    const bootA = await sessionA.get(endpoint + '/cases/' + firstId);
    const bootB = await sessionB.get(endpoint + '/cases/' + secondId);
    expect(bootA.ok()).toBeTruthy();
    expect(bootB.ok()).toBeTruthy();
    const cookieA = bootA.headers()['set-cookie']?.split(';')[0];
    const cookieB = bootB.headers()['set-cookie']?.split(';')[0];
    expect(cookieA).toBeTruthy();
    expect(cookieB).toBeTruthy();
    expect(cookieA).not.toBe(cookieB);

    // Client-supplied now MUST be rejected on both GET and POST
    const clientNowGet = await sessionA.get(endpoint + '/reservations?now=10&portfolio_id=' + sharedPortfolio);
    expect(clientNowGet.status()).toBe(400);
    expect((await clientNowGet.json()).error).toBe('client_time_forbidden');

    const clientNowPost = await sessionA.post(endpoint + '/cases/' + firstId + '/reservations', {
      data: { portfolio_id: sharedPortfolio, start_min: 600, end_min: 780, expires_at: 1000, now: 0, owner: 'OWNER' },
    });
    expect(clientNowPost.status()).toBe(400);
    expect((await clientNowPost.json()).error).toBe('client_time_forbidden');

    // Unapproved case cannot reserve
    const unapproved = await sessionA.post(endpoint + '/cases/' + firstId + '/reservations', {
      data: { portfolio_id: sharedPortfolio, start_min: 600, end_min: 780, expires_at: 1000, owner: 'OWNER' },
    });
    expect(unapproved.status()).toBe(403);
    expect((await unapproved.json()).error).toBe('approval_required');

    async function approveCase(ctx, id) {
      let current = await (await ctx.get(endpoint + '/cases/' + id)).json();
      for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR'], ['APPROVE', 'DECIDER']]) {
        const res = await ctx.post(endpoint + '/cases/' + id + '/actions', {
          data: { revision: current.revision, action, actor, reason: 'Reserve flow ' + action },
        });
        expect(res.ok()).toBeTruthy();
        current = await res.json();
      }
      expect(current.reservations).toEqual([]);
      return current;
    }

    const firstCase = await approveCase(sessionA, firstId);
    const secondCase = await approveCase(sessionB, secondId);

    // Atomic cross-session concurrency: TWO distinct authorized sessions hitting ONE shared portfolio simultaneously -> strictly [201, 409]
    const [p1, p2] = await Promise.all([
      sessionA.post(endpoint + '/cases/' + firstId + '/reservations', {
        data: { portfolio_id: sharedPortfolio, start_min: 600, end_min: 780, expires_at: 1000, owner: 'OWNER', decision_revision: firstCase.approvedSnapshot.decisionRevision },
      }),
      sessionB.post(endpoint + '/cases/' + secondId + '/reservations', {
        data: { portfolio_id: sharedPortfolio, start_min: 700, end_min: 860, expires_at: 1200, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
      }),
    ]);
    const statuses = [p1.status(), p2.status()].sort();
    expect(statuses).toEqual([201, 409]);

    // Independent portfolio isolation: sessionB reserving overlapping [600, 780) on altPortfolio MUST succeed
    const otherPortfolio = await sessionB.post(endpoint + '/cases/' + secondId + '/reservations', {
      data: { portfolio_id: altPortfolio, start_min: 600, end_min: 780, expires_at: 1000, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
    });
    expect(otherPortfolio.status()).toBe(201);
    expect((await otherPortfolio.json()).portfolioId).toBe(altPortfolio);

    // Adjacent slots across two distinct sessions on sharedPortfolio: [1200, 1380) by sessionA then [1380, 1500) by sessionB both succeed
    const adj1 = await sessionA.post(endpoint + '/cases/' + firstId + '/reservations', {
      data: { portfolio_id: sharedPortfolio, start_min: 1200, end_min: 1380, expires_at: 1250, owner: 'OWNER', decision_revision: firstCase.approvedSnapshot.decisionRevision },
    });
    expect(adj1.status()).toBe(201);
    const adj2 = await sessionB.post(endpoint + '/cases/' + secondId + '/reservations', {
      data: { portfolio_id: sharedPortfolio, start_min: 1380, end_min: 1500, expires_at: 1600, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
    });
    expect(adj2.status()).toBe(201);

    // Server clock advance on sharedPortfolio expires sessionA's [1200, 1380) slot at 1250 and releases it for sessionB
    const adv = await sessionA.post(endpoint + '/clock/advance', {
      data: { portfolio_id: sharedPortfolio, minute: 1250 },
    });
    expect(adv.status()).toBe(200);
    expect((await adv.json()).currentMinute).toBe(1250);

    // Clock cannot rewind (even from sessionB)
    const rewind = await sessionB.post(endpoint + '/clock/advance', {
      data: { portfolio_id: sharedPortfolio, minute: 1200 },
    });
    expect(rewind.status()).toBe(400);
    expect((await rewind.json()).error).toBe('clock_cannot_rewind');

    // Now sessionB can reserve [1250, 1380) on sharedPortfolio because sessionA's slot expired at 1250
    const afterExpiry = await sessionB.post(endpoint + '/cases/' + secondId + '/reservations', {
      data: { portfolio_id: sharedPortfolio, start_min: 1250, end_min: 1380, expires_at: 1600, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
    });
    expect(afterExpiry.status()).toBe(201);
    expect((await afterExpiry.json()).serverNow).toBe(1250);
  } finally {
    await sessionA.dispose();
    await sessionB.dispose();
  }
});

test('R16: outcome-based lessons are retrievable from commitment & issue paths and strictly separated from declined closure notes', async ({ request }) => {
  // Path A: OBSERVED -> CLOSE records OUTCOME_BASED_LESSON
  let observedCase = await (await request.get(endpoint + '/cases/S000013')).json();
  for (const [action, actor, extra] of [
    ['REPORT', 'EXPERT', {}],
    ['SCOPE', 'OWNER', {}],
    ['ASSESS', 'ASSESSOR', {}],
    ['APPROVE', 'DECIDER', {}],
    ['EXECUTE', 'OWNER', {}],
    ['OBSERVE', 'OWNER', { verifier: 'REVIEWER', evidenceRef: 'DEMO-OBS-LES-1' }],
    ['CLOSE', 'EXPERT', { reuseCondition: 'When drawing shortage blocks thermal unit', evidenceRef: 'DEMO-OBS-LES-1' }],
  ]) {
    const res = await request.post(endpoint + '/cases/S000013/actions', {
      data: { revision: observedCase.revision, action, actor, reason: 'Lesson test ' + action, ...extra },
    });
    expect(res.ok()).toBeTruthy();
    observedCase = await res.json();
  }
  expect(observedCase.lessons).toHaveLength(1);
  expect(observedCase.lessons[0]).toMatchObject({
    scenario_id: 'S000013',
    closure_type: 'OUTCOME_BASED_LESSON',
    decision_revision: 4,
    observation_revision: 6,
    evidence_ref: 'DEMO-OBS-LES-1',
    reuse_condition: 'When drawing shortage blocks thermal unit',
  });

  // Retrievable via commitment path AND issue path
  const byCommitment = await (await request.get(endpoint + '/lessons?commitmentId=' + encodeURIComponent('PUB-THERMAL-MGG72-SH2::dispatch'))).json();
  expect(byCommitment.items.some(l => l.scenario_id === 'S000013' && l.closure_type === 'OUTCOME_BASED_LESSON')).toBe(true);
  const byIssue = await (await request.get(endpoint + '/issues/S000013/commitments')).json();
  expect(byIssue.lessons.some(l => l.scenario_id === 'S000013' && l.closure_type === 'OUTCOME_BASED_LESSON')).toBe(true);

  // Path B: DECLINED -> CLOSE records DECLINED_CLOSURE_NOTE (never OUTCOME_BASED_LESSON)
  let declinedCase = await (await request.get(endpoint + '/cases/S000005')).json();
  for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR'], ['DECLINE', 'DECIDER'], ['CLOSE', 'EXPERT']]) {
    const res = await request.post(endpoint + '/cases/S000005/actions', {
      data: { revision: declinedCase.revision, action, actor, reason: 'Declined path ' + action },
    });
    expect(res.ok()).toBeTruthy();
    declinedCase = await res.json();
  }
  expect(declinedCase.lessons).toHaveLength(1);
  expect(declinedCase.lessons[0].closure_type).toBe('DECLINED_CLOSURE_NOTE');
  expect(declinedCase.lessons[0].observation_revision).toBeNull();

  // Attempting to force an OUTCOME_BASED_LESSON on a declined case without observation MUST fail with 409
  const forcedLesson = await request.post(endpoint + '/cases/S000005/lessons', {
    data: { closureType: 'OUTCOME_BASED_LESSON', reuseCondition: 'Invalid', summary: 'Should fail' },
  });
  expect(forcedLesson.status()).toBe(409);
  expect((await forcedLesson.json()).error).toBe('observation_required_for_lesson');
});

test('R11 & R15: live SQLite finance traceability, posting validation, single-count DAG, independent economic outputs, CEO queue vs watchlist, and localStorage hygiene', async ({ page, request }) => {
  // Live SQLite finance trace
  const finRes = await request.get(endpoint + '/finance/trace');
  expect(finRes.ok()).toBeTruthy();
  const fin = await finRes.json();
  expect(fin.sourceMode).toBe('LIVE_SQLITE_BANK_QUERY');
  expect(fin.operationalStatus).toBe('INTERNAL_SOURCE_REQUIRED');
  expect(fin.costControl.kpis).toEqual({ PV: 800, EV: 800, AC: 950, CV: -150, CPI: 0.8421 });
  expect(fin.costControl.acceptedPostings.map(p => p.document)).toEqual(['SYN-MAT-01', 'SYN-LAB-01']);
  expect(fin.costControl.excludedPostings.map(p => p.document)).toEqual(['SYN-SET-01', 'SYN-REV-01']);
  expect(fin.cashDag.nodes['PART-A']).toEqual([2, 7]);
  expect(fin.cashDag.nodes['PART-B']).toEqual([2, 7]);
  expect(fin.cashDag.stages[0].delay_days).toBe(5);
  expect(fin.cashDag.stages[0].timing_cost_m_toman).toBe(246.58);
  expect(fin.economicOutputs.separateOutputsEnforced).toBe(true);
  expect(fin.economicOutputs.combinedTotalForbidden).toBe(true);
  expect(fin.economicOutputs.contractual_exposure.value).toBeNull();

  // Live financial posting verification rejects internal transfer, wrong period, or missing finance confirmation
  const badInternal = await request.post(endpoint + '/finance/verify-posting', {
    data: { document: 'SYN-SET-01', period: '2026-11', confirmedByFinance: true },
  });
  expect(badInternal.status()).toBe(422);
  expect((await badInternal.json()).reasons).toContain('INTERNAL_TRANSFER_EXCLUDED');

  const badPeriod = await request.post(endpoint + '/finance/verify-posting', {
    data: { document: 'SYN-REV-01', period: '2026-12', confirmedByFinance: true },
  });
  expect(badPeriod.status()).toBe(422);
  expect((await badPeriod.json()).reasons).toContain('PERIOD_MISMATCH');

  const unconfirmed = await request.post(endpoint + '/finance/verify-posting', {
    data: { document: 'SYN-MAT-01', period: '2026-11', confirmedByFinance: false },
  });
  expect(unconfirmed.status()).toBe(422);
  expect((await unconfirmed.json()).reasons).toContain('FINANCE_CONFIRMATION_REQUIRED');

  const validPost = await request.post(endpoint + '/finance/verify-posting', {
    data: { document: 'SYN-MAT-01', period: '2026-11', confirmedByFinance: true },
  });
  expect(validPost.status()).toBe(200);
  expect((await validPost.json()).accepted).toBe(true);

  // Live SQLite governance queue separates CEO queue vs high-risk watchlist & shows deputy routing
  const govRes = await request.get(endpoint + '/governance/queue');
  expect(govRes.ok()).toBeTruthy();
  const gov = await govRes.json();
  expect(gov.sourceMode).toBe('LIVE_SQLITE_BANK_QUERY');
  expect(gov.ceoQueue.map(c => c.id)).toEqual(['EXEC-FIN-01']);
  expect(gov.highRiskWatch.map(c => c.id)).toEqual(['EXEC-GOV-02', 'EXEC-GOV-03']);
  expect(gov.deputyRouting.some(r => r.caseId === 'EXEC-GOV-02' && r.routedToActor === 'OPS-DEPUTY')).toBe(true);

  await page.goto('/demo/total-system/?scenario=S000013');
  await page.locator('.role-nav [data-role="executive"]').click();
  await expect(page.locator('[data-live-governance-panel]')).toContainText('OPS-DEPUTY');
  await expect(page.locator('[data-ceo-pathways]')).toContainText('EXEC-FIN-01');
  await expect(page.locator('[data-ceo-pathways]')).toContainText('EXEC-GOV-02');
  await expect(page.locator('[data-ceo-pathways]')).toContainText('ORDER-YDAY-03');
  await expect(page.locator('[data-ceo-pathways]')).toContainText('PROM-A');
  await expect(page.locator('[data-ceo-pathways]')).toContainText('QUALIFIED-LOCAL');

  await page.locator('#sections [data-section="evidence"]').click();
  await expect(page.locator('[data-economic-outputs]')).toContainText('SYN-PAY-01');
  await expect(page.locator('[data-economic-outputs]')).toContainText('۲۴۶٫۵۸');
  await expect(page.locator('[data-cost-traceability]')).toContainText('SYN-WBS-A');
  await page.locator('[data-language="en"]').click();
  await expect(page.locator('[data-economic-outputs]')).toContainText('246.58');
  await page.locator('[data-language="fa"]').click();

  const storedKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(storedKeys.every(key => ['total-demo-language', 'total-demo-theme'].includes(key))).toBe(true);
});

test('R17: live API responses and error statuses strictly conform to DEV/api-contract.json', async ({ request }) => {
  const contract = JSON.parse(readFileSync(new URL('../DEV/api-contract.json', import.meta.url), 'utf8'));
  expect(contract.recorderPolicy).toBe('SERVER_DERIVED_NEVER_TRUST_CLIENT');
  expect(contract.clockPolicy).toBe('SERVER_CONTROLLED_SIMULATION_CLOCK');
  expect(contract.portfolioScope).toBe('SHARED_ACROSS_AUTHORIZED_SESSIONS');

  const routeChecks = [
    ['/summary', endpoint + '/summary'],
    ['/scenarios', endpoint + '/scenarios?limit=1'],
    ['/executive', endpoint + '/executive'],
    ['/finance/trace', endpoint + '/finance/trace'],
    ['/governance/queue', endpoint + '/governance/queue'],
    ['/clock', endpoint + '/clock'],
    ['/reservations', endpoint + '/reservations'],
    ['/lessons', endpoint + '/lessons'],
    ['/cases/:id/links', endpoint + '/cases/S000013/links'],
    ['/commitments/:commitmentId/links', endpoint + '/commitments/' + encodeURIComponent('PUB-THERMAL-MGG72-SH2::dispatch') + '/links?limit=2'],
    ['/issues/:id/commitments', endpoint + '/issues/S000013/commitments'],
  ];

  for (const [contractPath, liveUrl] of routeChecks) {
    const specRoute = contract.routes.find(r => r.method === 'GET' && r.path === contractPath);
    expect(specRoute, 'Route missing in DEV/api-contract.json: ' + contractPath).toBeTruthy();
    const res = await request.get(liveUrl);
    expect(res.status(), 'GET ' + liveUrl + ' failed').toBe(200);
    const body = await res.json();
    for (const field of specRoute.responseFields) {
      expect(Object.hasOwn(body, field), `Missing field ${field} in ${contractPath}`).toBe(true);
    }
  }

  const caseBody = await (await request.get(endpoint + '/cases/S000013')).json();
  for (const field of contract.types.caseState) {
    expect(Object.hasOwn(caseBody, field), `Missing caseState field ${field}`).toBe(true);
  }

  // Validate contract-declared error statuses (400, 403, 404, 409, 422, 503)
  const errorProbes = [
    [400, await request.get(endpoint + '/reservations?now=10')],
    [400, await request.post(endpoint + '/cases/S000013/actions', { data: { revision: 0, action: 'REPORT', actor: 'EXPERT', recorder: 'FORGED', reason: 'Contract 400 probe' } })],
    [403, await request.post(endpoint + '/cases/S000013/actions', { data: { revision: 0, action: 'REPORT', actor: 'DECIDER', reason: 'Contract 403 probe' } })],
    [404, await request.get(endpoint + '/scenarios/S999999')],
    [409, await request.post(endpoint + '/cases/S000013/actions', { data: { revision: 99, action: 'REPORT', actor: 'EXPERT', reason: 'Contract 409 probe' } })],
    [422, await request.post(endpoint + '/finance/verify-posting', { data: { document: 'SYN-SET-01', period: '2026-11', confirmedByFinance: true } })],
    [503, await request.get(endpoint + '/governance/queue?mode=enterprise')],
  ];
  for (const [expectedStatus, res] of errorProbes) {
    expect(res.status()).toBe(expectedStatus);
    const errBody = await res.json();
    expect(contract.errors[String(expectedStatus)]).toContain(errBody.error);
  }
});

test('server starts without DATABASE_URL and persists total-demo case, reservations, and lessons across restart', async () => {
  const { spawn } = await import('node:child_process');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { createServer } = await import('node:net');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), 'pvpt-total-restart-'));
  const dbPath = join(dir, 'workspace.sqlite');
  const listener = createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(err => err ? reject(err) : resolve()));
  const origin = 'http://127.0.0.1:' + port;
  const env = { ...process.env, PORT: String(port), PVPT_DATABASE_PATH: dbPath };
  delete env.DATABASE_URL;

  let child;
  let exit;
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'ignore' });
    exit = new Promise(resolve => child.once('close', resolve));
    await expect.poll(async () => {
      try {
        const res = await fetch(origin + '/api/health');
        return res.status;
      } catch { return 0; }
    }, { timeout: 10000 }).toBe(200);
  }
  async function stop() {
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exit;
    child = undefined;
  }

  try {
    await start();
    const init = await fetch(origin + '/api/total-demo/cases/S000013');
    expect(init.status).toBe(200);
    const cookie = init.headers.get('set-cookie').split(';')[0];
    let current = await init.json();
    for (const [action, actor, extra] of [
      ['REPORT', 'EXPERT', {}],
      ['SCOPE', 'OWNER', {}],
      ['ASSESS', 'ASSESSOR', {}],
      ['APPROVE', 'DECIDER', {}],
      ['EXECUTE', 'OWNER', {}],
      ['OBSERVE', 'OWNER', { verifier: 'REVIEWER', evidenceRef: 'DEMO-RESTART-OBS' }],
      ['CLOSE', 'EXPERT', { reuseCondition: 'Restart durability reuse check' }],
    ]) {
      const post = await fetch(origin + '/api/total-demo/cases/S000013/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ revision: current.revision, action, actor, reason: 'Restart ' + action, ...extra }),
      });
      expect(post.status).toBe(200);
      current = await post.json();
    }
    expect(current.status).toBe('CLOSED');
    expect(current.lessons).toHaveLength(1);

    await stop();
    await start();
    const afterRestart = await fetch(origin + '/api/total-demo/cases/S000013', { headers: { Cookie: cookie } });
    expect(afterRestart.status).toBe(200);
    const restored = await afterRestart.json();
    expect(restored.status).toBe('CLOSED');
    expect(restored.revision).toBe(7);
    expect(restored.lessons).toHaveLength(1);
    expect(restored.lessons[0].reuse_condition).toBe('Restart durability reuse check');
    const restoredLessons = await (await fetch(origin + '/api/total-demo/lessons?scenarioId=S000013', { headers: { Cookie: cookie } })).json();
    expect(restoredLessons.items).toHaveLength(1);
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
