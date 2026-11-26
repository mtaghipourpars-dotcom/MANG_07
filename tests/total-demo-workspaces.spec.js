import { expect, test } from '@playwright/test';

test('four demo workspaces share one case and preserve the approved forecast after observation', async ({ page }) => {
  await page.goto('/demo/sap-commitments/index.html');
  const action = name => page.locator(`[data-action="${name}"]`);
  await action('openIssue').click();
  await action('showCommitment').click();
  await action('openIssue').click();
  await action('recordIssue').click();
  await action('review').click();
  await expect(action('approve')).toBeDisabled();
  await page.locator('[data-role="assessor"]').click();
  await page.locator('[data-evidence="external"]').check();
  await action('review').click();
  await action('approve').click();
  await expect(action('observe')).toBeDisabled();
  await action('start').click();
  await action('observe').click();
  await action('lesson').click();
  await page.locator('[data-role="owner"]').click();
  await expect(page.locator('#screen')).toContainText('L-01');
  await expect(page.getByRole('columnheader', { name: 'پیش‌بینی مصوب' })).toBeVisible();
});
