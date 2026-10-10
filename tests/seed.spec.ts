import { test, expect } from '@playwright/test';

// Seed for the Playwright planner and generator: the app's starting screen.
test('seed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
