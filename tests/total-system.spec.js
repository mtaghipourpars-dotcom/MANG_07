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
