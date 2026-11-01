import { test, expect } from '@playwright/test';

test('reports the sender', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_IS_CLOUD === 'true', 'Only applies outside the cloud build');
  await page.goto('/report');
  await expect(page.getByText('Reported')).toBeVisible();
});
