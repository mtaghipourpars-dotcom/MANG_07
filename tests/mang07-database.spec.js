import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));

async function freePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

const test = base.extend({
  dbServer: async ({}, use, testInfo) => {
    const directory = await mkdtemp(join(tmpdir(), 'pvpt-sqlite-test-'));
    const database = join(directory, 'workspace.sqlite');
    const port = await freePort();
    const origin = 'http://127.0.0.1:' + port;
    let child;
    let exit;
    let log = '';

    async function start() {
      child = spawn(process.execPath, ['server.js'], {
        cwd: root,
        env: { ...process.env, PORT: String(port), PVPT_DATABASE_PATH: database },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      exit = new Promise(resolve => {
        child.once('error', error => {
          log += error.message;
          resolve();
        });
        child.once('close', resolve);
      });
      child.stdout.on('data', chunk => { log += chunk; });
      child.stderr.on('data', chunk => { log += chunk; });
      await expect.poll(async () => {
        try {
          const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) });
          const health = await response.json();
          return [response.status, health.status, health.storage];
        } catch {
          return null;
        }
      }, { timeout: 10000, message: 'Express and SQLite are ready' }).toEqual([200, 'ok', 'sqlite']);
    }

    async function stop() {
      if (!child) return;
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await exit;
      child = undefined;
    }

    try {
      await start();
      await use({ origin, database, restart: async () => { await stop(); await start(); } });
    } finally {
      await stop();
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('Express test log', { body: log, contentType: 'text/plain' });
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
});

async function getWorkspace(origin, cookie) {
  const response = await fetch(origin + '/api/workspace', {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  expect(response.status).toBe(200);
  return {
    snapshot: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie,
    cookieHeader: response.headers.get('set-cookie'),
  };
}

async function saveSection(origin, cookie, section, revision, value) {
  const response = await fetch(origin + '/api/workspace/' + section, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ revision, value }),
  });
  return { status: response.status, body: await response.json() };
}

test('SQLite survives Express restart and rejects stale concurrent writes without mixing workspaces', async ({ dbServer }) => {
  test.setTimeout(30000);
  const { origin, database, restart } = dbServer;
  const first = await getWorkspace(origin);
  const second = await getWorkspace(origin);
  expect(first.cookie).not.toBe(second.cookie);
  expect(first.cookieHeader).toMatch(/HttpOnly/i);
  expect(first.snapshot).toMatchObject({ cases: [], revisions: { cases: 0, legacy: 0, preferences: 0 } });

  const caseId = randomUUID();
  const marker = { id: caseId, title: 'QA synthetic restart record', orders: [], effects: [], options: [], decision: null, outcomes: [], lessons: [], dataClass: 'DEMO_SYNTHETIC' };
  const rival = { ...marker, title: 'QA competing write' };
  const parallel = await Promise.all([
    saveSection(origin, first.cookie, 'cases', first.snapshot.revisions.cases, [marker]),
    saveSection(origin, first.cookie, 'cases', first.snapshot.revisions.cases, [rival]),
  ]);
  expect(parallel.map(result => result.status).sort()).toEqual([200, 409]);
  const successful = parallel.find(result => result.status === 200).body;
  expect(successful).toMatchObject({ revision: 1 });
  expect(parallel.find(result => result.status === 409).body).toMatchObject(successful);
  expect((await getWorkspace(origin, second.cookie)).snapshot.cases).toEqual([]);
  const invalid = { ...marker, options: [{ id: randomUUID(), effects: { [randomUUID()]: 23 } }] };
  expect(await saveSection(origin, first.cookie, 'cases', successful.revision, [invalid]))
    .toMatchObject({ status: 400, body: { error: 'invalid_option_effect_links' } });
  expect((await getWorkspace(origin, first.cookie)).snapshot.cases).toEqual(successful.value);

  const preferences = { theme: 'dark', language: 'en' };
  expect(await saveSection(origin, first.cookie, 'preferences', 0, preferences))
    .toMatchObject({ status: 200, body: { value: preferences, revision: 1 } });
  const legacy = { projects: [{ project_id: 'QA-SYNTHETIC', project_name: 'QA synthetic project' }] };
  expect(await saveSection(origin, first.cookie, 'legacy', 0, legacy))
    .toMatchObject({ status: 200, body: { value: legacy, revision: 1 } });

  const fixture = await (await fetch(origin + '/data/product-project-fixture.json')).json();
  const catalogue = await (await fetch(origin + '/api/catalog')).json();
  expect(catalogue.fixture).toEqual(fixture);
  expect(fixture.product_families).toHaveLength(6);
  await restart();
  const persisted = await getWorkspace(origin, first.cookie);
  expect(persisted.snapshot).toMatchObject({
    cases: successful.value,
    preferences,
    legacy,
    revisions: { cases: 1, legacy: 1, preferences: 1 },
  });
  expect((await getWorkspace(origin, second.cookie)).snapshot.cases).toEqual([]);
  expect(await (await fetch(origin + '/api/catalog')).json()).toEqual(catalogue);
  expect((await readFile(database)).subarray(0, 16).toString('ascii')).toBe('SQLite format 3\0');
});

async function openView(page, section, view) {
  await page.locator('.nav[data-page="' + section + '"]').click();
  await page.locator('#entityContent [data-view="' + view + '"]').click();
}

function caseForm(page) {
  return page.locator('#entityContent form[data-form="mang07-case"]');
}

async function completeCaseForm(page, title) {
  const form = caseForm(page);
  await form.locator('[name="title"]').fill(title);
  await form.locator('[name="resource"]').selectOption('MACH-TEST-01');
  await form.locator('[name="orders"]').selectOption(['PO-P1405-01', 'PO-P1398-02']);
  await form.locator('[name="description"]').fill('دامنهٔ مصنوعی آزمون بانک اطلاعاتی');
  return form;
}

async function browserSnapshot(page, origin) {
  const response = await page.request.get(origin + '/api/workspace');
  expect(response.status()).toBe(200);
  return response.json();
}

test('database-backed case survives clearing browser storage and restarting server', async ({ browser, page, dbServer }) => {
  test.setTimeout(30000);
  const { origin, restart } = dbServer;
  const title = 'آزمون ماندگاری پرونده در پایگاه داده';
  await page.clock.setFixedTime(new Date('2026-11-22T12:30:00Z'));
  await page.goto(origin);
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  const before = await page.locator('#homePage').evaluate(element => element.outerHTML);
  await openView(page, 'risk', 'issues');
  const form = await completeCaseForm(page, title);
  const saved = page.waitForResponse(response => response.url() === origin + '/api/workspace/cases' && response.request().method() === 'PUT');
  await form.locator('[type="submit"]').click();
  expect((await saved).status()).toBe(200);
  await expect(page.locator('#entityContent')).toContainText(title);
  expect((await browserSnapshot(page, origin)).cases[0]).toMatchObject({ title, resource: 'MACH-TEST-01' });

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await restart();
  await page.reload();
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  expect(await page.locator('#homePage').evaluate(element => element.outerHTML)).toBe(before);
  await openView(page, 'risk', 'issues');
  await expect(page.locator('#entityContent')).toContainText(title);
  expect((await browserSnapshot(page, origin)).revisions.cases).toBe(1);

  const secondBrowser = await browser.newContext();
  try {
    await secondBrowser.addCookies(await page.context().cookies(origin));
    const restored = await secondBrowser.newPage();
    await restored.goto(origin);
    await restored.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
    await openView(restored, 'risk', 'issues');
    await expect(restored.locator('#entityContent')).toContainText(title);
  } finally {
    await secondBrowser.close();
  }
});

test('a rejected write leaves the database unchanged and the case is not confirmed', async ({ page, dbServer }) => {
  test.setTimeout(30000);
  const { origin } = dbServer;
  const title = 'چالش آزمایشی با خطای ذخیره‌سازی';
  await page.goto(origin);
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await openView(page, 'risk', 'issues');
  const form = await completeCaseForm(page, title);
  await page.route(origin + '/api/workspace/cases', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'QA storage failure' }),
  }));
  const rejected = page.waitForResponse(response => response.url() === origin + '/api/workspace/cases' && response.request().method() === 'PUT');
  await form.locator('[type="submit"]').click();
  expect((await rejected).status()).toBe(503);
  await expect(page.locator('.app-toast strong')).toContainText(/خطا|ناموفق|ثبت نشد/);
  expect((await browserSnapshot(page, origin)).cases).toEqual([]);
  await expect(page.locator('#entityContent')).not.toContainText(title);
});

test('linked operation demand recalculates the shortage and saves a separate simulation on request', async ({ page, dbServer }) => {
  test.setTimeout(30000);
  const { origin } = dbServer;
  await page.goto(origin);
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await openView(page, 'risk', 'impact');
  const panel = page.locator('[data-pvpt-relations]');
  await expect(panel).toBeVisible();
  const before = await browserSnapshot(page, origin);
  await panel.locator('[data-relation-project]').selectOption('P-1405');
  await panel.locator('[data-relation-order]').selectOption('PO-P1405-01');
  await panel.locator('[data-relation-resource]').selectOption('MACH-TEST-01');
  await panel.locator('[data-relation-operation]').selectOption('OP-P1405-40');
  const availability = panel.locator('[data-relation-available]');
  const demand = panel.locator('[data-relation-demand]');
  const gap = panel.locator('[data-relation-gap]');
  const delta = panel.locator('[data-relation-gap-change]');
  await expect(gap).toHaveAttribute('data-value', '');

  await availability.fill('16');
  await expect(gap).toHaveAttribute('data-value', '18');
  await demand.fill('14');
  await expect(gap).toHaveAttribute('data-value', '20');
  await expect(delta).toHaveAttribute('data-value', '2');
  await availability.fill('24');
  await expect(gap).toHaveAttribute('data-value', '12');
  await demand.fill('0');
  await expect(gap).toHaveAttribute('data-value', '0');
  await expect(delta).toHaveAttribute('data-value', '-10');
  await expect(panel).toContainText('PO-P1398-02');
  expect(await browserSnapshot(page, origin)).toEqual(before);

  const save = panel.locator('[data-relation-save]');
  await expect(save).toBeVisible();
  await save.click();
  await expect(panel.locator('[data-relation-save-status]')).toContainText('نسخهٔ آزمایشی ذخیره شد');
  const stored = await browserSnapshot(page, origin);
  expect(stored.cases).toEqual(before.cases);
  expect(stored.revisions.legacy).toBe(before.revisions.legacy + 1);
  expect(stored.legacy.events[0]).toMatchObject({
    type: 'relationship-simulation', data_class: 'DEMO_SYNTHETIC',
    snapshot: {
      schemaVersion: 1, classification: 'DEMO_SYNTHETIC',
      links: { projectId: 'P-1405', orderId: 'PO-P1405-01', resourceId: 'MACH-TEST-01' },
      capacity: { baselineDemand: 34, forecastDemand: 22, baselineGap: 10, forecastGap: 0, change: -10 },
    },
  });
  await page.reload();
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await openView(page, 'risk', 'evidence');
  const history = page.locator('#entityContent .app-card').filter({ hasText: 'سناریوهای آزمایشی ثبت‌شده' });
  await expect(history).toContainText('MACH-TEST-01');
  await history.locator('summary').click();
  await expect(history.locator('pre')).toContainText('"forecastGap": 0');
});

test('a linked option forecast and deadline react live while the signed value map stays fixed', async ({ page, dbServer }) => {
  test.setTimeout(30000);
  const { origin } = dbServer;
  const caseId = randomUUID();
  const optionId = randomUUID();
  const deliveryId = randomUUID();
  const collectionId = randomUUID();
  const costId = randomUUID();
  const at = '2026-11-22T12:30:00Z';
  const order = 'PO-P1405-01';
  const common = {
    order, project: 'P-1405', origin: 'فرض صریح آموزشی قرارداد', reviewer: 'بازبین آزمون', at,
    version: 1, versions: [], timeOrigin: 'روز نسبی سناریوی آموزشی',
  };
  const delivery = { ...common, id: deliveryId, type: 'delivery', unit: 'day', reference: 'COM-P1405-DEL', baseline: 13, noAction: 16, deadline: 13 };
  const collection = { ...common, id: collectionId, type: 'collection', unit: 'day', reference: 'CASH-P1405-M4', baseline: 43, noAction: 46, amount: 60000, rate: 30 };
  const cost = { ...common, id: costId, type: 'cost', unit: 'million-toman', reference: order, baseline: 10000, noAction: 10800 };
  const effects = [delivery, collection, cost];
  const gates = Object.fromEntries(['capacity','quality','budget','deadline','crossOrder'].map(key => [
    key, { status: 'verified', reference: 'فرض صریح آموزشی قرارداد', reviewer: 'بازبین آزمون' },
  ]));
  const signed = {
    id: caseId, title: 'آزمون قرارداد پیش‌بینی تعهد', resource: 'MACH-TEST-01',
    orders: [order], dataClass: 'DEMO_SYNTHETIC', effects, outcomes: [], lessons: [], at,
    options: [{
      id: optionId, title: 'آزمون بیرونی', description: 'فرض آموزشی قرارداد', owner: 'مدیر آزمون',
      start: 1, duration: 2, resource: 'SUP-DEMO-02', quantity: '۱ نوبت', reservation: 'فرض آزمون',
      cost: 650, budget: 700, effects: { [deliveryId]: 13, [collectionId]: 43, [costId]: 10200 },
      effectVersions: Object.fromEntries(effects.map(effect => [effect.id, 1])), gates,
    }],
    decision: {
      id: randomUUID(), optionId, optionTitle: 'آزمون بیرونی', status: 'approved', at,
      rows: [
        { row: delivery, withOption: 13 },
        { row: collection, withOption: 43 },
        { row: cost, withOption: 10200 },
      ],
    },
  };

  await page.goto(origin);
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  const initial = await browserSnapshot(page, origin);
  const inserted = await page.request.put(origin + '/api/workspace/cases', {
    data: { revision: initial.revisions.cases, value: [signed] },
  });
  expect(inserted.status(), await inserted.text()).toBe(200);
  await page.reload();
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await openView(page, 'risk', 'impact');
  const panel = page.locator('[data-pvpt-relations]');
  await panel.locator('[data-relation-case]').selectOption(caseId);
  await panel.locator('[data-relation-effect]').selectOption(collectionId);
  await panel.locator('[data-relation-option]').selectOption(optionId);
  const value = async key => (await panel.locator('[data-relation-' + key + ']').getAttribute('data-value'));
  expect(Number(await value('net-before'))).toBeCloseTo(97.945, 2);
  expect(await value('official')).toBe('43');

  await panel.locator('[data-relation-no-action]').fill('47');
  expect(await value('challenge-impact')).toBe('4');
  expect(Number(await value('net-after'))).toBeCloseTo(147.260, 2);
  expect(await value('official')).toBe('43');
  await panel.locator('[data-relation-with-option]').fill('48');
  expect(Number(await value('net-after'))).toBeCloseTo(-99.315, 2);

  await panel.locator('[data-relation-effect]').selectOption(deliveryId);
  await panel.locator('[data-relation-with-option]').fill('17');
  await expect(panel.locator('[data-relation-gate="deadline"]')).toHaveAttribute('data-status','rejected');
  expect(await value('official')).toBe('13');
  const after = await browserSnapshot(page, origin);
  expect(after.cases).toEqual([signed]);
  expect(after.revisions.cases).toBe(initial.revisions.cases + 1);

  const mutated = structuredClone(signed);
  mutated.options[0].cost = 1;
  const invalid = await page.request.put(origin + '/api/workspace/cases', {
    data: { revision: after.revisions.cases, value: [mutated] },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: 'approved_case_immutable' });
  expect(await browserSnapshot(page, origin)).toEqual(after);
});

test('existing browser data imports once and cannot overwrite a database record', async ({ page, dbServer }) => {
  test.setTimeout(30000);
  const { origin } = dbServer;
  const oldCase = {
    id: randomUUID(), title: 'پروندهٔ پیش از انتقال به بانک اطلاعاتی',
    resource: 'MACH-TEST-01', orders: ['PO-P1405-01'], effects: [], options: [],
    decision: null, outcomes: [], lessons: [], dataClass: 'DEMO_SYNTHETIC',
  };
  const legacy = { projects: [{ project_id: 'QA-IMPORTED', project_name: 'دادهٔ آموزشی پیشین' }] };
  await page.addInitScript(({ origin, oldCase, legacy }) => {
    if (location.origin !== origin || sessionStorage.getItem('qa-seeded')) return;
    sessionStorage.setItem('qa-seeded', '1');
    localStorage.setItem('mang07-case-v1', JSON.stringify([oldCase]));
    localStorage.setItem('pvpt-interactive-workspace-v1', JSON.stringify(legacy));
    localStorage.setItem('pvpt_theme', 'dark');
    localStorage.setItem('pvpt_lang', 'en');
  }, { origin, oldCase, legacy });
  await page.goto(origin);
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  const imported = await browserSnapshot(page, origin);
  expect(imported).toMatchObject({
    legacy, cases: [oldCase], preferences: { theme: 'dark', lang: 'en' },
    revisions: { legacy: 1, cases: 1, preferences: 1 },
  });
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.evaluate(previous => localStorage.setItem('mang07-case-v1', JSON.stringify([previous])), {
    ...oldCase, title: 'رونوشت منسوخ آزمون',
  });
  await page.reload();
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  expect(await browserSnapshot(page, origin)).toEqual(imported);
});
