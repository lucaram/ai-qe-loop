---
name: generate-tests
description: Stage 2. Turn an approved test plan into tagged Playwright API and UI tests, using the playwright-test-generator agent for UI scenarios, and open a PR for QE to approve. Use when the user runs /generate-tests <KEY>.
---

# Generate tests

Input: a story key, e.g. `PROJ-130` ($ARGUMENTS).

## 1. Prepare

1. `git switch main && git pull --ff-only`
2. Stop unless `git ls-tree --name-only main specs/` lists `specs/<KEY>-*.md`. A plan counts as approved only once it is merged. Tell the user to run `/plan-story <KEY>` and get `approved:po` first.
3. `git switch -c <KEY>-tests`
4. Read the plan and `CLAUDE.md` (conventions and tags).

## 2. API scenarios: write them directly

For each scenario in "API scenarios", write a test in `tests/api/<KEY>-<slug>.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { DEFAULT_PASSWORD, getAccount, login, setAccount, uniqueUsername } from '../support/api';

test('<scenario title>', { tag: ['@<KEY>', '@AC-n', '@BR-nnn'] }, async ({ request }, testInfo) => {
  const user = uniqueUsername(testInfo);
  await setAccount(request, user, { failedAttempts: 4 });

  const result = await login(request, user, 'wrong-password');

  expect(result.status).toBe(423);
  expect(result.body.message).toBe('Your account is locked. Try again in 15 minutes.');
});
```

Rules:
- Tags exactly as the scenario heading's IDs.
- Expected values come from the plan (which came from the context), never from what the app returns.
- Use `lockedForMs` for time: e.g. `lockedForMs: 60_000` for "one minute left", `lockedForMs: 0` for "lock ends now".
- Check state changes with `getAccount()` when the plan says a count or lock must (or must not) change.

## 3. UI scenarios: use the generator

For each scenario in "UI scenarios", use the `playwright-test-generator` agent with `tests/seed.spec.ts` as the seed, one scenario at a time. Brief it with the scenario text plus:
> Save to `tests/ui/<KEY>-<slug>.spec.ts`. Add `{ tag: [...] }` with the scenario's IDs. Set up the account through the API first with `setAccount()` from `tests/support/api.ts` and `uniqueUsername(testInfo)`. Use role- or label-based locators. Assert the exact message text from the scenario.

## 4. Verify

Run, and fix the **test code** until they pass:
```bash
npm run typecheck && npm run lint && npm test && npm run traceability
```
(`npm run traceability` uses `HEAD` as base here, so the plan is in scope.)

If a test fails because the app does not do what the plan says, do **not** change the expected value. Leave the test failing, and list it in the PR body under "Possible bugs" with the failure output.

## 5. Open the PR

```bash
git add tests
git commit -m "<KEY>: automated tests"
git push -u origin HEAD
gh pr create --title "<KEY>: automated tests" --body "<body>"
```
Body:
- **Plan:** `specs/<KEY>-<slug>.md`
- **Tests:** a table of scenario → test file and title → tags
- **Possible bugs:** failing tests where the app disagrees with the plan, or "None"
- **Approvals needed:** `- [ ] approved:qe`

Do not add labels and do not merge.
