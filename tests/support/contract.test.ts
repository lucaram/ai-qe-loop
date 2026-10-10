import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertMatchesContract } from './contract';

test('a documented status with a matching body passes', () => {
  assert.doesNotThrow(() => assertMatchesContract('POST', '/auth/login', 423, { message: 'locked' }));
  assert.doesNotThrow(() => assertMatchesContract('POST', '/auth/login', 200, { token: 'abc' }));
});

test('a body missing a required field fails', () => {
  assert.throws(() => assertMatchesContract('POST', '/auth/login', 200, {}), /does not match the API contract/);
});

test('an undocumented status fails', () => {
  assert.throws(() => assertMatchesContract('POST', '/auth/login', 400, { message: 'x' }), /does not document/);
});

test('an unknown path fails', () => {
  assert.throws(() => assertMatchesContract('GET', '/nope', 200, {}), /not in the API contract/);
});
