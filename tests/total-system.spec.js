import { expect, test } from '@playwright/test';

const endpoint = '/api/total-demo';

test('scenario bank filters, paginates, and preserves unknown observations', async ({ request }) => {
  const summaryResponse = await request.get(endpoint + '/summary');
  expect(summaryResponse.ok()).toBeTruthy();
  const summary = await summaryResponse.json();
  expect(summary.data_class).toBe('DEMO_SYNTHETIC');
  expect(summary.operationalStatus).toBe('INTERNAL_SOURCE_REQUIRED');
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
  const { data_class, executive } = await response.json();
  expect(data_class).toBe('DEMO_SYNTHETIC');
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

test('approved forecast never falls back to proposed, stays immutable after observe, and separates direct vs donor effects', async ({ page, request }) => {
  const url = endpoint + '/cases/S000013';
  const before = await (await request.get(url)).json();
  expect(before.approvedSnapshot).toBeNull();
  expect(before.remainingRiskStatus).toBe('UNVERIFIED_OPEN');

  await page.goto('/demo/total-system/?scenario=S000013');
  const directTable = page.locator('[data-effect-group="direct"] table');
  const donorTable = page.locator('[data-effect-group="donor"] table');
  await expect(directTable).toBeVisible();
  await expect(donorTable).toBeVisible();
  // Before explicit approval, the Approved forecast column (5th cell) must be Unknown, NOT proposed!
  const firstDirectApprovedCell = directTable.locator('tbody tr').first().locator('td').nth(4);
  await expect(firstDirectApprovedCell).toContainText('نامشخص');

  // Verify two-way path: Commitment (owner) -> Issue (expert) -> Commitment (owner) with same case ID
  await directTable.locator('tbody tr').first().locator('[data-role="expert"]').click();
  await expect(page.locator('[data-expert-issue]')).toContainText('S000013');
  await page.locator('[data-expert-issue] [data-role="owner"]').first().click();
  await expect(page.locator('[data-owner-commitments]')).toBeVisible();
  await expect(page.locator('#screen')).toContainText('S000013');

  // Progress through APPROVE -> EXECUTE -> OBSERVE via API on an isolated context and confirm immutability + self-verification block
  let current = before;
  for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR'], ['APPROVE', 'DECIDER']]) {
    const res = await request.post(url + '/actions', { data: { revision: current.revision, action, actor, reason: 'Stage2 ' + action } });
    expect(res.ok()).toBeTruthy();
    current = await res.json();
  }
  expect(current.approvedSnapshot).not.toBeNull();
  expect(current.approvedSnapshot.decisionRevision).toBe(4);
  expect(current.reservations).toEqual([]); // Approval alone does NOT reserve capacity
  expect(current.remainingRiskStatus).toBe('UNVERIFIED_OPEN');
  const frozenSnapshot = JSON.stringify(current.approvedSnapshot);

  const execRes = await request.post(url + '/actions', { data: { revision: current.revision, action: 'EXECUTE', actor: 'OWNER', reason: 'Stage2 EXECUTE' } });
  expect(execRes.ok()).toBeTruthy();
  current = await execRes.json();

  // Self-verification must be rejected
  const selfVerify = await request.post(url + '/actions', {
    data: { revision: current.revision, action: 'OBSERVE', actor: 'OWNER', verifier: 'OWNER', reason: 'Self check must fail' },
  });
  expect(selfVerify.status()).toBe(403);
  expect((await selfVerify.json()).error).toBe('self_verification_forbidden');

  // Independent verifier succeeds without overwriting approvedSnapshot
  const obsRes = await request.post(url + '/actions', {
    data: { revision: current.revision, action: 'OBSERVE', actor: 'OWNER', verifier: 'REVIEWER', reason: 'Independent observation' },
  });
  expect(obsRes.ok()).toBeTruthy();
  current = await obsRes.json();
  expect(JSON.stringify(current.approvedSnapshot)).toBe(frozenSnapshot);
  expect(current.observations).toHaveLength(1);
  expect(current.observations[0].verifier).toBe('REVIEWER');
  expect(current.remainingRiskStatus).not.toBe('UNVERIFIED_OPEN');
});

test('live transactional reservation enforces approval gate, portfolio overlap conflict, adjacency, and expiry release', async ({ request }) => {
  const listRes = await request.get(endpoint + '/scenarios?resource=drawing&gate=FEASIBLE&decision=APPROVED&limit=2');
  expect(listRes.ok()).toBeTruthy();
  const { items } = await listRes.json();
  expect(items).toHaveLength(2);
  const [firstId, secondId] = items.map(item => item.id);

  // Initialize workspace cookie and verify reservation without approval is rejected
  await request.get(endpoint + '/cases/' + firstId);
  const unapproved = await request.post(endpoint + '/cases/' + firstId + '/reservations', {
    data: { start_min: 600, end_min: 780, expires_at: 1000, now: 0, owner: 'OWNER' },
  });
  expect(unapproved.status()).toBe(403);
  expect((await unapproved.json()).error).toBe('approval_required');

  async function approveCase(id) {
    let current = await (await request.get(endpoint + '/cases/' + id)).json();
    for (const [action, actor] of [['REPORT', 'EXPERT'], ['SCOPE', 'OWNER'], ['ASSESS', 'ASSESSOR'], ['APPROVE', 'DECIDER']]) {
      const res = await request.post(endpoint + '/cases/' + id + '/actions', {
        data: { revision: current.revision, action, actor, reason: 'Reserve flow ' + action },
      });
      expect(res.ok()).toBeTruthy();
      current = await res.json();
    }
    expect(current.reservations).toEqual([]);
    return current;
  }

  const firstCase = await approveCase(firstId);
  const secondCase = await approveCase(secondId);

  // Reserve [600, 780) on first case
  const r1 = await request.post(endpoint + '/cases/' + firstId + '/reservations', {
    data: { start_min: 600, end_min: 780, expires_at: 1000, now: 0, owner: 'OWNER', decision_revision: firstCase.approvedSnapshot.decisionRevision },
  });
  expect(r1.status()).toBe(201);
  expect((await r1.json()).status).toBe('RESERVED');

  // Overlapping [700, 860) on second case across the portfolio must be rejected
  const clash = await request.post(endpoint + '/cases/' + secondId + '/reservations', {
    data: { start_min: 700, end_min: 860, expires_at: 1200, now: 0, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
  });
  expect(clash.status()).toBe(409);
  const clashBody = await clash.json();
  expect(clashBody.error).toBe('reservation_conflict');
  expect(clashBody.conflictingOrders.some(order => order.startsWith(firstId + ':'))).toBe(true);

  // Adjacent [780, 960) on second case must succeed
  const adjacent = await request.post(endpoint + '/cases/' + secondId + '/reservations', {
    data: { start_min: 780, end_min: 960, expires_at: 1200, now: 0, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
  });
  expect(adjacent.status()).toBe(201);
  expect((await adjacent.json()).status).toBe('RESERVED');

  // After expiry (now = 1000), original slot [600, 780) cannot start before now, so test [1000, 1180) vs expired [600, 780)
  // First reserve [1000, 1180) expiring at 1050, then at now=1050 reserve [1050, 1180) — overlaps [1000, 1180) only if not expired!
  const shortRes = await request.post(endpoint + '/cases/' + firstId + '/reservations', {
    data: { start_min: 1000, end_min: 1180, expires_at: 1050, now: 0, owner: 'OWNER', decision_revision: firstCase.approvedSnapshot.decisionRevision },
  });
  expect(shortRes.status()).toBe(201);
  const afterExpiry = await request.post(endpoint + '/cases/' + secondId + '/reservations', {
    data: { start_min: 1050, end_min: 1180, expires_at: 1300, now: 1050, owner: 'OWNER', decision_revision: secondCase.approvedSnapshot.decisionRevision },
  });
  expect(afterExpiry.status()).toBe(201);
  expect((await afterExpiry.json()).status).toBe('RESERVED');
});

test('executive pathways, anti-double-counting DAG, independent economic outputs, and localStorage hygiene', async ({ page, request }) => {
  const execRes = await request.get(endpoint + '/executive');
  expect(execRes.ok()).toBeTruthy();
  const execPayload = await execRes.json();
  expect(execPayload.sourceMode).toBe('READ_ONLY_PRECOMPUTED_SCENARIO_BANK');
  expect(execPayload.operationalStatus).toBe('INTERNAL_SOURCE_REQUIRED');
  const { finance, governance } = execPayload.executive;
  // Parallel 5-day causes (PART-A, PART-B) produce single 5-day delay on SYN-PAY-01
  expect(finance.cash.nodes['PART-A']).toEqual([2, 7]);
  expect(finance.cash.nodes['PART-B']).toEqual([2, 7]);
  expect(finance.cash.stages).toHaveLength(1);
  expect(finance.cash.stages[0].delay_days).toBe(5);
  expect(finance.cash.stages[0].timing_cost_m_toman).toBe(246.58);
  expect(governance.ceo_queue.map(row => row.id)).toEqual(['EXEC-FIN-01']);
  expect(governance.high_risk_watch).toEqual(['EXEC-GOV-02', 'EXEC-GOV-03']);

  await page.goto('/demo/total-system/?scenario=S000013');
  await page.locator('.role-nav [data-role="executive"]').click();
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

test('server starts without DATABASE_URL and persists total-demo case across restart', async () => {
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
    const initial = await init.json();
    const post = await fetch(origin + '/api/total-demo/cases/S000013/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ revision: initial.revision, action: 'REPORT', actor: 'EXPERT', reason: 'Restart persistence check' }),
    });
    expect(post.status).toBe(200);
    const saved = await post.json();
    expect(saved.status).toBe('REPORTED');

    await stop();
    await start();
    const afterRestart = await fetch(origin + '/api/total-demo/cases/S000013', { headers: { Cookie: cookie } });
    expect(afterRestart.status).toBe(200);
    const restored = await afterRestart.json();
    expect(restored.status).toBe('REPORTED');
    expect(restored.revision).toBe(1);
    expect(restored.history[0].reason).toBe('Restart persistence check');
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
