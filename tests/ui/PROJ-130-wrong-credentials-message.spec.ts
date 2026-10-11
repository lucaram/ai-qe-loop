// spec: specs/PROJ-130-account-lockout.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { setAccount, uniqueUsername } from '../support/api';

test.describe('PROJ-130 account lockout UI', () => {
  test('15. Wrong-credentials message shown for a wrong password', { tag: ['@PROJ-130'] }, async ({ page, request }, testInfo) => {
    const user = uniqueUsername(testInfo);
    await setAccount(request, user, {});

    // 1. Open the login page.
    await page.goto('/');

    // 2. Enter the account's username and a wrong password, then click "Sign in".
    await page.getByLabel('Username').fill(user);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Expected: the alert shows exactly "Wrong username or password.".
    await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');
  });
});
