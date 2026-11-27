import { test, expect } from '@playwright/test';

test('lesson preserves the observed version and rejects unsupported recorder claims', async ({ request }) => {
  const url = '/api/total-demo/cases/S000013';
  let current = await (await request.get(url)).json();
  const apply = (action, actor, extra = {}) => request.post(url + '/actions', {
    data: { action, actor, revision: current.revision, reason: 'Lesson acceptance test', ...extra },
  });
  const mismatch = await apply('REPORT', 'EXPERT', { recorder: 'DECIDER' });
  expect(mismatch.status()).toBe(403);
  for (const [action, role] of [['REPORT','EXPERT'],['SCOPE','OWNER'],['ASSESS','ASSESSOR'],
    ['APPROVE','DECIDER'],['EXECUTE','OWNER'],['OBSERVE','OWNER']]) {
    const result = await apply(action, role);
    expect(result.ok()).toBeTruthy();
    current = await result.json();
  }
  expect(current.observations[0].verificationStatus).toBe('INTERNAL_SOURCE_REQUIRED');
  const invalid = await apply('CLOSE','EXPERT',{ lesson: { text: 'Recorded', applicability: '' } });
  expect(invalid.status()).toBe(400);
  const lesson = { text: 'Compare the approved training forecast with the recorded observation.',
    applicability: 'When the same evidence-backed observation becomes available.' };
  const closed = await apply('CLOSE','EXPERT',{ lesson });
  expect(closed.ok()).toBeTruthy();
  const saved = await (await request.get(url)).json();
  expect(saved.lessons).toEqual([{ ...lesson, scenarioId: current.scenarioId,
    closeRevision: saved.revision, observationRevision: current.observations[0].revision,
    decisionRevision: current.approvedSnapshot.decisionRevision }]);
});

test('browser restores the structured lesson from the same case after reload', async ({ page }) => {
  await page.goto('/demo/total-system/?scenario=S000013');
  const action = name => page.locator('[data-case-action] [data-action="' + name + '"]');
  for (const [role, name] of [
    ['expert', 'REPORT'], ['owner', 'SCOPE'], ['assessor', 'ASSESS'],
    ['executive', 'APPROVE'], ['owner', 'EXECUTE'], ['owner', 'OBSERVE'], ['expert', 'CLOSE'],
  ]) {
    await page.locator('.role-nav [data-role="' + role + '"]').click();
    await page.locator('[data-case-action] [name="reason"]').fill('UI acceptance ' + name);
    if (name === 'CLOSE') {
      await page.locator('[name="lesson_text"]').fill('Compare the original approved version.');
      await page.locator('[name="lesson_applicability"]').fill('When reviewing the same observation.');
    }
    await action(name).click();
    await expect(action(name)).toHaveCount(0);
  }
  await page.reload();
  const lesson = page.locator('[data-case-lessons]');
  await expect(lesson).toContainText('Compare the original approved version.');
  await expect(lesson).toContainText('When reviewing the same observation.');
});
