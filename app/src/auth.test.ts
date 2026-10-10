import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptLogin, effectiveState, LOCK_DURATION_MS, LOCKED_MESSAGE, WRONG_CREDENTIALS_MESSAGE,
  type AccountStore,
} from './auth';

const T0 = 1_000_000;

function storeWith(failedAttempts = 0, lockedUntil: number | null = null): AccountStore {
  return new Map([['anna', { password: 'right', failedAttempts, lockedUntil }]]);
}

test('correct password logs in and resets the count (BR-002)', () => {
  const store = storeWith(4);
  const result = attemptLogin(store, 'anna', 'right', T0);
  assert.equal(result.status, 200);
  assert.equal(store.get('anna')!.failedAttempts, 0);
});

test('wrong password returns 401 and adds 1', () => {
  const store = storeWith(0);
  const result = attemptLogin(store, 'anna', 'wrong', T0);
  assert.deepEqual(result, { status: 401, body: { message: WRONG_CREDENTIALS_MESSAGE } });
  assert.equal(store.get('anna')!.failedAttempts, 1);
});

test('5th wrong password locks for 15 minutes and returns 423 (BR-001)', () => {
  const store = storeWith(4);
  const result = attemptLogin(store, 'anna', 'wrong', T0);
  assert.deepEqual(result, { status: 423, body: { message: LOCKED_MESSAGE } });
  assert.equal(store.get('anna')!.lockedUntil, T0 + LOCK_DURATION_MS);
});

test('correct password while locked is refused with 423', () => {
  const store = storeWith(5, T0 + 60_000);
  assert.equal(attemptLogin(store, 'anna', 'right', T0).status, 423);
});

test('wrong password while locked changes nothing', () => {
  const store = storeWith(5, T0 + 60_000);
  const result = attemptLogin(store, 'anna', 'wrong', T0);
  assert.equal(result.status, 423);
  assert.deepEqual(store.get('anna'), { password: 'right', failedAttempts: 5, lockedUntil: T0 + 60_000 });
});

test('one millisecond before the lock ends, login is still refused', () => {
  const store = storeWith(5, T0);
  assert.equal(attemptLogin(store, 'anna', 'right', T0 - 1).status, 423);
});

test('exactly when the lock ends, login is allowed and the count is 0', () => {
  const store = storeWith(5, T0);
  assert.equal(attemptLogin(store, 'anna', 'right', T0).status, 200);
  assert.deepEqual(store.get('anna'), { password: 'right', failedAttempts: 0, lockedUntil: null });
});

test('after the lock ends, a wrong password counts from 0 again', () => {
  const store = storeWith(5, T0);
  assert.equal(attemptLogin(store, 'anna', 'wrong', T0).status, 401);
  assert.equal(store.get('anna')!.failedAttempts, 1);
});

test('unknown username returns 401 and changes no account', () => {
  const store = storeWith(0);
  const result = attemptLogin(store, 'nobody', 'x', T0);
  assert.deepEqual(result, { status: 401, body: { message: WRONG_CREDENTIALS_MESSAGE } });
  assert.equal(store.size, 1);
  assert.equal(store.get('anna')!.failedAttempts, 0);
});

test('effectiveState reports an expired lock as unlocked with count 0', () => {
  assert.deepEqual(
    effectiveState({ password: 'right', failedAttempts: 5, lockedUntil: T0 }, T0),
    { failedAttempts: 0, lockedUntil: null, locked: false },
  );
  assert.deepEqual(
    effectiveState({ password: 'right', failedAttempts: 5, lockedUntil: T0 }, T0 - 1),
    { failedAttempts: 5, lockedUntil: T0, locked: true },
  );
});
