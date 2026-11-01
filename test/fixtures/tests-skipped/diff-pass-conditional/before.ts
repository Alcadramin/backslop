import { test, expect } from '@playwright/test';

test('reports the sender', async ({ page }) => {
  await page.goto('/report');
  await expect(page.getByText('Reported')).toBeVisible();
});
