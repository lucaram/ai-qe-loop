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
