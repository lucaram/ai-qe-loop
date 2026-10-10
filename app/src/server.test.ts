import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './server';
import type { AccountStore } from './auth';

async function start(testHooks: boolean, now = () => 1_000_000) {
  const store: AccountStore = new Map();
  const server = createApp(store, { testHooks, now }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { store, base, close: () => new Promise((r) => server.close(r)) };
}

const json = (method: string, body?: unknown) => ({
  method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

test('login through HTTP follows the lockout rules', async () => {
  const app = await start(true);
  try {
    await fetch(`${app.base}/test/accounts/anna`, json('PUT', { failedAttempts: 4 }));
    const res = await fetch(`${app.base}/auth/login`, json('POST', { username: 'anna', password: 'wrong' }));
    assert.equal(res.status, 423);
    assert.deepEqual(await res.json(), { message: 'Your account is locked. Try again in 15 minutes.' });
  } finally { await app.close(); }
});

test('missing fields return 400', async () => {
  const app = await start(false);
  try {
    const res = await fetch(`${app.base}/auth/login`, json('POST', { username: 'anna' }));
    assert.equal(res.status, 400);
  } finally { await app.close(); }
});

test('test hooks set and read lock state relative to server time', async () => {
  const app = await start(true);
  try {
    const put = await fetch(`${app.base}/test/accounts/bob`, json('PUT', { failedAttempts: 5, lockedForMs: 60_000 }));
    assert.deepEqual(await put.json(), { failedAttempts: 5, lockedUntil: 1_060_000, locked: true });
    const get = await fetch(`${app.base}/test/accounts/bob`);
    assert.deepEqual(await get.json(), { failedAttempts: 5, lockedUntil: 1_060_000, locked: true });
    assert.equal(app.store.get('bob')!.password, 'Correct-Pass-1');
  } finally { await app.close(); }
});

test('test hooks do not exist unless enabled', async () => {
  const app = await start(false);
  try {
    const res = await fetch(`${app.base}/test/accounts/bob`, json('PUT', {}));
    assert.equal(res.status, 404);
  } finally { await app.close(); }
});

test('login page is served', async () => {
  const app = await start(false);
  try {
    const res = await fetch(`${app.base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<h1>Sign in<\/h1>/);
  } finally { await app.close(); }
});
