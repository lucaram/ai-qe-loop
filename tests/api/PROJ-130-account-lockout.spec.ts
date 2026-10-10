import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, getAccount, login, setAccount, uniqueUsername } from '../support/api';

// Plan: specs/PROJ-130-account-lockout.md (API scenarios 1–12).
const LOCKED = 'Your account is locked. Try again in 15 minutes.';
const WRONG = 'Wrong username or password.';
const FIFTEEN_MINUTES = 15 * 60 * 1000;

test('1. Five wrong passwords lock the account', { tag: ['@PROJ-130', '@AC-1', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, {});

  for (let attempt = 1; attempt <= 4; attempt++) {
    const result = await login(request, user, `Wrong-${attempt}`);
    expect(result.status).toBe(401);
    expect(result.body.message).toBe(WRONG);
    expect(await getAccount(request, user)).toMatchObject({ failedAttempts: attempt, locked: false });
  }

  const before = Date.now();
  const fifth = await login(request, user, 'Wrong-5');
  expect(fifth.status).toBe(423);
  expect(fifth.body.message).toBe(LOCKED);

  const state = await getAccount(request, user);
  expect(state.locked).toBe(true);
  expect(state.lockedUntil).toBeGreaterThanOrEqual(before + FIFTEEN_MINUTES - 5_000);
  expect(state.lockedUntil).toBeLessThanOrEqual(Date.now() + FIFTEEN_MINUTES + 5_000);
});

test('2. Four wrong passwords do not lock the account (boundary)', { tag: ['@PROJ-130', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, {});

  for (let attempt = 1; attempt <= 4; attempt++) {
    const result = await login(request, user, `Wrong-${attempt}`);
    expect(result.status).toBe(401);
    expect(result.body.message).toBe(WRONG);
  }
  expect(await getAccount(request, user)).toMatchObject({ failedAttempts: 4, locked: false });

  const success = await login(request, user, DEFAULT_PASSWORD);
  expect(success.status).toBe(200);
  expect(success.body.token).toBeTruthy();
});

test('3. Correct password while locked is refused', { tag: ['@PROJ-130', '@AC-2', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 5, lockedForMs: 600_000 });

  const result = await login(request, user, DEFAULT_PASSWORD);

  expect(result.status).toBe(423);
  expect(result.body.message).toBe(LOCKED);
  expect(result.body.token).toBeUndefined();
  expect((await getAccount(request, user)).locked).toBe(true);
});

test('4. Correct password with 4 failed attempts succeeds and resets the count', { tag: ['@PROJ-130', '@AC-3', '@BR-002'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 4, lockedForMs: null });

  const result = await login(request, user, DEFAULT_PASSWORD);

  expect(result.status).toBe(200);
  expect(result.body.token).toBeTruthy();
  expect(await getAccount(request, user)).toMatchObject({ failedAttempts: 0, locked: false });
});

test('5. Login allowed once 15 minutes have passed', { tag: ['@PROJ-130', '@AC-4', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 5, lockedForMs: 0 });

  const result = await login(request, user, DEFAULT_PASSWORD);

  expect(result.status).toBe(200);
  expect(result.body.token).toBeTruthy();
  expect(await getAccount(request, user)).toMatchObject({ failedAttempts: 0, locked: false });
});

test('6. 5th wrong password and a wrong password on a locked account both return 423', { tag: ['@PROJ-130', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 4, lockedForMs: null });

  const fifth = await login(request, user, 'Wrong-5');
  expect(fifth.status).toBe(423);
  expect(fifth.body.message).toBe(LOCKED);

  const whileLocked = await login(request, user, 'Wrong-6');
  expect(whileLocked.status).toBe(423);
  expect(whileLocked.body.message).toBe(LOCKED);
});

test('7. Wrong password during a lock changes nothing', { tag: ['@PROJ-130', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 5, lockedForMs: 300_000 });
  const lockEnd = (await getAccount(request, user)).lockedUntil;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await login(request, user, `Wrong-${attempt}`);
    expect(result.status).toBe(423);
    expect(result.body.message).toBe(LOCKED);
  }

  expect(await getAccount(request, user)).toEqual({ failedAttempts: 5, lockedUntil: lockEnd, locked: true });
});

test('8. Failed-attempt count is 0 when the lock ends', { tag: ['@PROJ-130', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 5, lockedForMs: 0 });

  expect(await getAccount(request, user)).toMatchObject({ failedAttempts: 0, locked: false });

  const result = await login(request, user, 'Wrong-1');
  expect(result.status).toBe(401);
  expect(result.body.message).toBe(WRONG);
  expect(await getAccount(request, user)).toMatchObject({ failedAttempts: 1, locked: false });
});

test('9. Unknown username returns 401 and affects no account', { tag: ['@PROJ-130'] }, async ({ request }, testInfo) => {
  const realUser = uniqueUsername(testInfo);
  const ghostUser = `${realUser}-ghost`;
  await setAccount(request, realUser, { failedAttempts: 2 });

  for (let attempt = 1; attempt <= 6; attempt++) {
    const result = await login(request, ghostUser, 'anything');
    expect(result.status).toBe(401);
    expect(result.body.message).toBe(WRONG);
  }

  expect(await getAccount(request, realUser)).toMatchObject({ failedAttempts: 2, locked: false });
  expect((await login(request, realUser, DEFAULT_PASSWORD)).status).toBe(200);
});

test('10. At 14:59 login is still refused', { tag: ['@PROJ-130', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 5, lockedForMs: 1_000 });

  const result = await login(request, user, DEFAULT_PASSWORD);

  expect(result.status).toBe(423);
  expect(result.body.message).toBe(LOCKED);
  expect((await getAccount(request, user)).locked).toBe(true);
});

test('11. At exactly 15:00 login is allowed', { tag: ['@PROJ-130', '@BR-001'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 5, lockedForMs: 0 });

  const result = await login(request, user, DEFAULT_PASSWORD);

  expect(result.status).toBe(200);
  expect(result.body.token).toBeTruthy();
});

test('12. Count is not left over after a successful login', { tag: ['@PROJ-130', '@BR-002'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 4, lockedForMs: null });

  expect((await login(request, user, DEFAULT_PASSWORD)).status).toBe(200);
  expect((await getAccount(request, user)).failedAttempts).toBe(0);

  for (let attempt = 1; attempt <= 4; attempt++) {
    const result = await login(request, user, `Wrong-${attempt}`);
    expect(result.status).toBe(401);
  }
  expect(await getAccount(request, user)).toMatchObject({ failedAttempts: 4, locked: false });

  const fifth = await login(request, user, 'Wrong-5');
  expect(fifth.status).toBe(423);
  expect(fifth.body.message).toBe(LOCKED);
});
