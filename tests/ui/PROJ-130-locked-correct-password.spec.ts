// spec: specs/PROJ-130-account-lockout.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, setAccount, uniqueUsername } from '../support/api';

test.describe('PROJ-130 account lockout UI', () => {
  test(
    '14. Locked message shown when a locked account signs in with the correct password',
    { tag: ['@PROJ-130', '@AC-2', '@BR-001'] },
    async ({ page, request }, testInfo) => {
      // Setup: a locked account (5 failed attempts, lock ending in 10 minutes)
      const user = uniqueUsername(testInfo);
      await setAccount(request, user, { failedAttempts: 5, lockedForMs: 600_000 });

      // 1. Open the login page.
      await page.goto('/');

      // 2. Enter the account's username and the correct password, then click "Sign in".
      await page.getByLabel('Username').fill(user);
      await page.getByLabel('Password').fill(DEFAULT_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Expected: the alert shows the lock message.
      await expect(page.getByRole('alert')).toHaveText('Your account is locked. Try again in 15 minutes.');
    },
  );
});
