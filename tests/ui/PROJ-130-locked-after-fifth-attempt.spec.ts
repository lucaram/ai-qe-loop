// spec: specs/PROJ-130-account-lockout.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { setAccount, uniqueUsername } from '../support/api';

test.describe('PROJ-130 account lockout UI', () => {
  test(
    '13. Locked message shown on the login page after the 5th wrong password',
    { tag: ['@PROJ-130', '@AC-1', '@BR-001'] },
    async ({ page, request }, testInfo) => {
      // Setup: an account with 4 failed attempts, created through the API test hook
      const user = uniqueUsername(testInfo);
      await setAccount(request, user, { failedAttempts: 4 });

      // 1. Open the login page.
      await page.goto('/');

      // 2. Enter the account's username and a wrong password, then click "Sign in".
      await page.getByLabel('Username').fill(user);
      await page.getByLabel('Password').fill('wrong-password');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Expected: the alert shows the locked message
      await expect(page.getByRole('alert')).toHaveText('Your account is locked. Try again in 15 minutes.');
    },
  );
});
