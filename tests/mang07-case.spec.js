import { test, expect } from '@playwright/test';

const CASE_TITLE = 'آزمون آموزشی: توقف ایستگاه آزمون مشترک';
const A = 'PO-P1405-01';
const B = 'PO-P1398-02';
const STATION = 'MACH-TEST-01';
const EFFECTS = [
  { order: A, type: 'completion', baseline: '11', noAction: '15', external: '12', swap: '11' },
  { order: A, type: 'delivery', baseline: '13', noAction: '16', deadline: '13', external: '13', swap: '13' },
  { order: A, type: 'collection', baseline: '43', noAction: '46', amount: '60000', rate: '30', external: '43', swap: '43' },
  { order: A, type: 'cost', baseline: '10000', noAction: '10800', external: '10200', swap: '10100' },
  { order: B, type: 'completion', baseline: '13', noAction: '13', external: '13', swap: '17' },
  { order: B, type: 'delivery', baseline: '14', noAction: '14', deadline: '14', external: '14', swap: '18' },
  { order: B, type: 'collection' },
  { order: B, type: 'cost', baseline: '8000', noAction: '8000', external: '8000', swap: '8250' },
];
const GATES = ['capacity', 'quality', 'budget', 'deadline', 'crossOrder'];
const MODEL = 'mang07-case-v1';
const LEGACY = 'pvpt-interactive-workspace-v1';

async function go(page, key, view) {
  await page.locator(`.nav[data-page="${key}"]`).click();
  if (view) {
    await page.locator(`#entityContent [data-view="${view}"]`).click();
    await expect(page.locator('#entityContent')).toHaveAttribute('data-app-view', view);
  }
}

function caseForm(page, key) {
  return page.locator(`#entityContent form[data-form="${key}"]`);
}

async function field(form, name, value) {
  const control = form.locator(`[name="${name}"]`);
  if (await control.evaluate(el => el.tagName === 'SELECT')) {
    await control.selectOption(value);
  } else {
    await control.fill(value);
  }
}

async function fill(form, data) {
  for (const [name, value] of Object.entries(data)) {
    if (value !== undefined) await field(form, name, value);
  }
}

async function submit(form) {
  await form.locator('button[type="submit"]').click();
}

async function readStore(page, key = MODEL) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}

async function testHome(page) {
  return page.locator('#homePage').evaluate(node => {
    const copy = node.cloneNode(true);
    for (const transient of copy.querySelectorAll('.app-toast, time')) transient.remove();
    return copy.outerHTML;
  });
}

function englishDigits(value) {
  return value.replace(/[۰-۹٠-٩]/g, digit =>
    String(digit.charCodeAt(0) % 16)).replace(/٫/g, '.').replace(/٬/g, ',');
}

test('a two-order test-station interruption reaches an auditable value forecast, decision, and lesson', async ({ page }) => {
  test.setTimeout(90000);
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('/demo/index.html');
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const initialHome = await testHome(page);
  const initialLegacy = await readStore(page, LEGACY);

  await test.step('capture the same case from the risk view, with both orders and no required money input', async () => {
    await go(page, 'issues', 'register');
    const official = caseForm(page, 'mang07-case');
    await expect(official).toBeVisible();
    await go(page, 'risk', 'issues');
    const form = caseForm(page, 'mang07-case');
    await expect(form).toBeVisible();
    await fill(form, {
      title: CASE_TITLE,
      resource: STATION,
      description: 'نمونه مصوب برای آزمون قرارداد، تنها در نشست مرورگر',
      downtime: '4',
      evidence: 'سناریوی آموزشی قرارداد پیاده‌سازی',
      registrant: 'کارشناس آزمون دمو',
      orders: [A, B],
    });
    await submit(form);
    await expect.poll(async () => (await readStore(page))?.length).toBe(1);
    await expect(page.locator('#entityContent')).toContainText(CASE_TITLE);
    await expect(caseForm(page, 'mang07-effect')).toBeVisible();
    const [record] = await readStore(page);
    expect(record).toMatchObject({ orders: [A, B], resource: STATION, effects: [], dataClass: 'DEMO_SYNTHETIC' });
    expect(record.interventionDay ?? null).toBeNull();
  });

  const effectIds = new Map();
  await test.step('record and recalculate dated effects, retaining unknown collection and the previous forecast', async () => {
    const form = caseForm(page, 'mang07-effect');
    for (const item of EFFECTS) {
      await field(form, 'order', item.order);
      await field(form, 'type', item.type);
      const reference = form.locator('[name=reference]');
      if (!await reference.inputValue()) {
        const first = await reference.locator('option:not([value=""])').first().getAttribute('value');
        await reference.selectOption(first);
      }
      await fill(form, {
        baseline: item.baseline,
        noAction: item.type === 'completion' && item.order === A ? '16' : item.noAction,
        deadline: item.deadline,
        amount: item.amount,
        rate: item.rate,
        timeOrigin: item.type !== 'cost' ? 'روز نسبی از مبدأ آزمون مشترک' : undefined,
        origin: 'فرض صریح آموزشی قرارداد',
        reviewer: 'مسئول برنامه‌ریزی آزمایشی',
      });
      await submit(form);
      const rows = page.locator('.pvpt-case-effects tr[data-effect-id]');
      await expect(rows).toHaveCount(effectIds.size + 1);
      const ids = await rows.evaluateAll(nodes => nodes.map(node => node.dataset.effectId));
      const added = ids.find(id => !Array.from(effectIds.values()).includes(id));
      expect(added).toBeTruthy();
      effectIds.set(item.order + item.type, added);
    }
    const completion = page.locator(`tr[data-effect-id="${effectIds.get(A + 'completion')}"]`);
    await completion.locator('[data-action="mang07-edit-effect"]').click();
    await fill(form, {
      baseline: '11', noAction: '15',
      timeOrigin: 'روز نسبی از مبدأ آزمون مشترک', origin: 'بازبینی فرض آموزشی', reviewer: 'مسئول برنامه‌ریزی آزمایشی',
    });
    await submit(form);
    await expect(page.locator('.pvpt-case-effects tr[data-effect-id]')).toHaveCount(8);
    const history = (await readStore(page))[0].effects.find(row => row.id === effectIds.get(A + 'completion'));
    expect(history.noAction).toBe(15);
    expect(history.versions).toHaveLength(1);
    expect(history.versions[0].noAction).toBe(16);
    expect(englishDigits(await completion.locator('td').nth(4).innerText())).toBe('4');
    await expect(page.locator(`tr[data-effect-id="${effectIds.get(B + 'collection')}"]`).locator('td').nth(4)).toContainText('نامشخص');
  });

  let chosen;
  let blocked;
  await test.step('compare the two options, reject the profitable deadline breach and approve external testing', async () => {
    await page.locator('#entityContent [data-action="mang07-options"]').click();
    const form = caseForm(page, 'mang07-option');
    await expect(form).toBeVisible();
    for (const option of [
      { key: 'external', title: 'آزمون بیرونی', cost: '650', expected: '97.95' },
      { key: 'swap', title: 'جابه‌جایی نوبت', cost: '100', expected: '497.95' },
    ]) {
      await fill(form, {
        title: option.title, description: 'سناریوی آموزشی تأییدشده',
        owner: 'مسئول اجرای دمو', proposer: 'کارشناس ارزیابی دمو',
        start: '1', duration: '2', resource: option.key === 'external' ? 'SUP-DEMO-02' : STATION, quantity: '۱ نوبت آزمون',
        reservation: 'فرض رزرو نسخه آزمون', cost: option.cost, budget: '700',
      });
      for (const gate of GATES) {
        await fill(form, {
          [`gate-${gate}`]: 'verified',
          [`ref-${gate}`]: 'فرض صریح در قرارداد آزمایشی',
          [`reviewer-${gate}`]: 'بازبین قیود آزمایشی',
        });
      }
      for (const item of EFFECTS) {
        if (item[option.key] === undefined) continue;
        const id = effectIds.get(item.order + item.type);
        await field(form, `effect-${id}`, item[option.key]);
      }
      await submit(form);
      const card = page.locator('[data-option-id]').filter({ hasText: option.title });
      await expect(card).toHaveCount(1);
      await expect.poll(async () => englishDigits(await card.locator('[data-option-net]').innerText())).toBe(option.expected);
      if (option.key === 'external') {
        await expect(card).toHaveAttribute('data-feasible', 'true');
        chosen = card;
      } else {
        await expect(card).toHaveAttribute('data-feasible', 'false');
        blocked = card;
      }
    }
    const blockedForm = blocked.locator('form[data-form="mang07-decision"]');
    const blockedSubmit = blockedForm.locator('button[type="submit"]');
    if (await blockedSubmit.count()) await expect(blockedSubmit).toBeDisabled();
    else await expect(blockedForm).toHaveCount(0);

    const decision = chosen.locator('form[data-form="mang07-decision"]');
    await fill(decision, {
      approver: 'مدیر ارشد دمو', reason: 'موعد سخت هر دو سفارش رعایت شده است',
      owner: 'مسئول اجرای دمو', due: '13',
    });
    await submit(decision);
    await expect(chosen).toContainText(/مصوب|تصویب/);
    const decisionState = (await readStore(page))[0].decision;
    expect(decisionState.status).toBe('approved');
    expect(decisionState.net).toBeCloseTo(97.94520548);
    expect(decisionState.rows).toHaveLength(8);
    expect(decisionState.partial).toBe(true);
    const start = page.locator('#entityContent [data-action="mang07-start"]');
    await expect(start).toBeVisible();
    await expect(chosen).not.toContainText('در حال اجرا');
  });

  await test.step('update only the educational forecast, record observed result, and link a lesson', async () => {
    await go(page, 'risk', 'map');
    const projection = page.locator('[data-mang07-risk]');
    await expect(projection).toContainText(CASE_TITLE);
    const delivery = projection.locator(`[data-mang07-forecast="${effectIds.get(A + 'delivery')}"]`);
    await expect(delivery).toBeVisible();
    const forecastText = englishDigits(await delivery.innerText());
    expect(forecastText).toMatch(/\b13\b/);

    await go(page, 'solutions', 'register');
    await page.locator('#entityContent [data-action="mang07-start"]').click();
    await go(page, 'memory', 'outcomes');
    const result = caseForm(page, 'mang07-outcome').filter({ has: page.locator('[name="effect"]') });
    await fill(result, {
      effect: effectIds.get(A + 'delivery'), observed: '14',
      evidence: 'گزارش شبیه‌سازی ثبت تحویل', classification: 'simulation', note: 'انحراف یک‌روزه در آزمون',
    });
    await submit(result);
    await expect.poll(async () => (await readStore(page))?.[0]?.outcomes?.length).toBe(1);
    const [outcome] = (await readStore(page))[0].outcomes;
    expect(outcome).toMatchObject({
      effectId: effectIds.get(A + 'delivery'), classification: 'simulation',
    });
    expect(outcome.decisionId).toBe((await readStore(page))[0].decision.id);
    expect(outcome.approved).toBe(13);
    expect(outcome.observed).toBe(14);
    const variance = page.locator(`[data-mang07-observed-variance="${effectIds.get(A + 'delivery')}"]`);
    expect(englishDigits(await variance.innerText())).toBe('1');
    const complete = caseForm(page, 'mang07-outcome').and(page.locator('[data-mode="complete"]'));
    await field(complete, 'note', 'پایان اجرای آزمایشی؛ وصول ب نامشخص است.');
    await submit(complete);
    expect((await readStore(page))[0].decision.status).toBe('completed');
    await go(page, 'memory', 'lessons');
    const lesson = caseForm(page, 'mang07-lesson');
    const observedOption = await lesson.locator('[name="outcome"] option:not([value=""])').first().getAttribute('value');
    await fill(lesson, {
      outcome: observedOption, text: 'رزرو ایستگاه جایگزین قبل از پنجره آزمون بررسی شود',
      scope: 'منابع کلیدی مشترک',
    });
    await submit(lesson);
    await expect(page.locator('#entityContent')).toContainText('رزرو ایستگاه جایگزین قبل از پنجره آزمون بررسی شود');
    expect((await readStore(page))[0].lessons[0].outcomeId).toBe(observedOption);
  });

  await test.step('verify local persistence and prevent contamination of the existing dashboard', async () => {
    const beforeReload = await readStore(page);
    await page.reload();
    await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
    await expect(page.locator('.nav[data-page="home"]')).toHaveClass(/active/);
    expect(await readStore(page)).toEqual(beforeReload);
    expect(await readStore(page, LEGACY)).toEqual(initialLegacy);
    expect(await testHome(page)).toBe(initialHome);
    expect(runtimeErrors).toEqual([]);
  });
});

test('changing a stop assumption invalidates the forecast without destroying the previous estimate', async ({ page }) => {
  test.setTimeout(35000);
  await page.goto('/demo/index.html');
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await go(page, 'issues', 'register');
  const issue = caseForm(page, 'mang07-case');
  await fill(issue, { title: 'آزمون بازبینی توقف', resource: STATION, description: 'ورودی آزمون محلی', orders: [A], downtime: '4' });
  await submit(issue);

  const impact = caseForm(page, 'mang07-effect');
  await fill(impact, {
    order: A, type: 'completion', baseline: '11', noAction: '15',
    timeOrigin: 'روز نسبی از مبدأ آزمون', origin: 'فرض آموزشی', reviewer: 'بازبین آزمون',
  });
  await submit(impact);
  const rows = page.locator('.pvpt-case-effects tr[data-effect-id]');
  await expect(rows).toHaveCount(1);
  const id = await rows.first().getAttribute('data-effect-id');
  await go(page, 'risk', 'map');
  const forecast = page.locator(`[data-mang07-forecast="${id}"]`);
  expect(englishDigits(await forecast.innerText())).toBe('15');

  await go(page, 'issues', 'register');
  await page.getByText('فرض توقف، شواهد و تاریخچه', { exact: true }).click();
  const assumption = caseForm(page, 'mang07-condition');
  await fill(assumption, { downtime: '7', evidence: 'تغییر مستند آموزشی توقف' });
  await submit(assumption);
  await expect(rows.first().locator('td').nth(4)).toContainText('نیازمند بازبینی');
  const [record] = await readStore(page);
  expect(record.downtime).toBe(7);
  expect(record.conditionHistory[0]).toMatchObject({ downtime: 4 });
  expect(record.effects[0]).toMatchObject({ noAction: 15, needsReview: true });

  await go(page, 'risk', 'map');
  await expect(forecast).toHaveText('نامشخص');
  await expect(forecast.locator('..')).toBeVisible();
  await expect(forecast.locator('xpath=ancestor::tr')).toContainText('نیازمند بازبینی برآورد');
});

test('missing or inconsistent impact input never updates the saved record', async ({ page }) => {
  test.setTimeout(35000);
  await page.goto('/demo/index.html');
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await go(page, 'issues', 'register');
  const issue = caseForm(page, 'mang07-case');
  await fill(issue, { title: 'آزمون جلوگیری از داده ناسازگار', resource: STATION, description: 'ورودی آزمون محلی', orders: [A] });
  await submit(issue);

  const impact = caseForm(page, 'mang07-effect');
  await fill(impact, {
    order: A, type: 'completion', baseline: '11', noAction: '15',
    timeOrigin: 'روز نسبی از مبدأ آزمون', origin: 'فرض آموزشی', reviewer: 'بازبین آزمون',
  });
  await submit(impact);
  const [initial] = await readStore(page);
  expect(initial.effects).toHaveLength(1);

  const reference = impact.locator('[name=reference]');
  await fill(impact, {
    order: A, type: 'delivery', baseline: '13', noAction: '16', deadline: '13',
    timeOrigin: 'مبدأ متفاوت و نامعتبر', origin: 'فرض آموزشی', reviewer: 'بازبین آزمون',
  });
  if (!await reference.inputValue()) {
    const first = await reference.locator('option:not([value=""])').first().getAttribute('value');
    await reference.selectOption(first);
  }
  await submit(impact);
  await expect(page.locator('.app-toast').last()).toContainText('مبدأ روز نسبی');
  expect(await readStore(page)).toEqual([initial]);

  await fill(impact, { timeOrigin: 'روز نسبی از مبدأ آزمون', noAction: '-1' });
  await submit(impact);
  await expect(page.locator('.app-toast').last()).toContainText('نامنفی');
  expect(await readStore(page)).toEqual([initial]);
});

test('existing demo entry forms persist and display their results', async ({ page }) => {
  await page.goto('/demo/index.html');
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);

  await go(page, 'portfolio', 'assignments');
  const rows = page.locator('#entityContent tbody tr');
  const before = await rows.count();
  await page.locator('#entityContent [name=assignmentFamily]').selectOption('BUSDuct');
  await expect.poll(() => rows.count()).toBeLessThan(before);

  await go(page, 'projects');
  const project = caseForm(page, 'project');
  await fill(project, { id: 'QA-DEMO-PRJ', name: 'پروژه تمرینی آزمون فرم' });
  await submit(project);
  await expect(page.locator('#entityContent')).toContainText('پروژه تمرینی آزمون فرم');

  await go(page, 'projects', 'commitments');
  const commitment = caseForm(page, 'commitment');
  await fill(commitment, { id: 'QA-DEMO-COM', project: 'QA-DEMO-PRJ', name: 'تعهد آزمون فرم', due: '0' });
  await submit(commitment);
  const row = page.locator('#entityContent tbody tr').filter({ hasText: 'QA-DEMO-COM' });
  await expect(row).toContainText('تعهد آزمون فرم');
  expect(englishDigits(await row.locator('td').nth(3).innerText())).toBe('0');

  await go(page, 'projects', 'orders');
  const execution = caseForm(page, 'execution');
  await fill(execution, { order: A, status: 'PCNF', note: 'یادداشت اجرای آزمون' });
  await submit(execution);
  await expect(page.locator('#entityContent')).toContainText('یادداشت اجرای آزمون');

  await go(page, 'resources', 'materials');
  const material = caseForm(page, 'resource');
  await fill(material, { name: 'قطعهٔ تمرینی آزمون موجودی', type: 'MATERIAL', capacity: '42', unit: 'عدد' });
  await submit(material);
  const stock = page.locator('#entityContent tbody tr').filter({ hasText: 'قطعهٔ تمرینی آزمون موجودی' }).locator('td').nth(1);
  await expect(stock).toHaveText('۴۲ عدد');
  await page.reload();
  await page.waitForFunction(() => window.PVPT?.getCatalog().orders.length > 0);
  await go(page, 'resources', 'materials');
  await expect(stock).toHaveText('۴۲ عدد');
  await go(page, 'projects', 'orders');
  await expect(page.locator('#entityContent')).toContainText('یادداشت اجرای آزمون');
});
