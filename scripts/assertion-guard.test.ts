import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations } from './assertion-guard';

const diff = [
  'diff --git a/tests/ui/login.spec.ts b/tests/ui/login.spec.ts',
  '--- a/tests/ui/login.spec.ts',
  '+++ b/tests/ui/login.spec.ts',
  '@@ -1,4 +1,4 @@',
  "-  await page.getByLabel('User').fill(u);",
  "+  await page.getByLabel('Username').fill(u);",
  "-  await expect(alert).toHaveText('Your account is locked. Try again in 15 minutes.');",
  "+  await expect(alert).toHaveText('Locked');",
  "+test.skip('flaky', async () => {});",
  "+test('x', { tag: ['@PROJ-130'] }, async () => {});",
].join('\n');

test('locator changes are allowed; assertion, skip and tag changes are not', () => {
  assert.deepEqual(findViolations(diff).map((v) => v.line), [
    "-  await expect(alert).toHaveText('Your account is locked. Try again in 15 minutes.');",
    "+  await expect(alert).toHaveText('Locked');",
    "+test.skip('flaky', async () => {});",
    "+test('x', { tag: ['@PROJ-130'] }, async () => {});",
  ]);
  assert.equal(findViolations(diff)[0].file, 'tests/ui/login.spec.ts');
});

test('an empty diff has no violations', () => {
  assert.deepEqual(findViolations(''), []);
});

test('a matcher on its own line is an assertion change', () => {
  const multiline = [
    '+++ b/tests/ui/login.spec.ts',
    "-    .toHaveText('Your account is locked. Try again in 15 minutes.');",
    "+    .toHaveText('Locked');",
    '-    .not.toBeVisible();',
  ].join('\n');
  assert.equal(findViolations(multiline).length, 3);
});

test('any change to playwright.config.ts is a violation', () => {
  const config = ['+++ b/playwright.config.ts', '-  retries: 0,', '+  retries: 3,'].join('\n');
  assert.deepEqual(findViolations(config).map((v) => v.line), ['-  retries: 0,', '+  retries: 3,']);
});
