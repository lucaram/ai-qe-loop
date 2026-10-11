---
name: heal-tests
description: Stage 2. Fix Playwright tests broken by app changes using the playwright-test-healer agent, within strict limits (locators, waits, navigation only), and open a PR for QE to approve. Use when the user runs /heal-tests or tests fail after an app change.
---

# Heal tests

1. `git switch main && git pull --ff-only`, then run `npm test`. If everything passes, tell the user and stop.
2. `git switch -c heal/$(date +%F)`
3. Use the `playwright-test-healer` agent on the failing tests, with this brief:
   > Fix only locators, waits on elements or responses, and navigation steps. Do not change any `expect(...)`, expected value or tag, and do not add `skip`, `fixme` or `only` or change `playwright.config.ts`. If a test can only pass by changing one of those, leave it unchanged and report it.
4. Run `npm run assertion-guard -- --base main`.
   - If it reports violations, do not restore the whole file. Undo only the violating lines, keeping the healer's valid locator, wait and navigation fixes (compare with `git diff main -- <file>`), then run the guard again until it passes.
   - Every test whose violating change you undid still fails: treat it as a test the healer could not fix (step 5).
5. For every test the healer could not fix within the limits, including those from step 4, open an issue:
   ```bash
   gh issue create --title "Possible bug or requirement change: <test title>" --body "<failure output, the test's tags, and the plan scenario it implements>"
   ```
6. If any files changed, run `npm run typecheck && npm run lint && npm test`, then:
   ```bash
   git add tests
   git commit -m "Heal tests: <short list>"
   git push -u origin HEAD
   gh pr create --title "Heal tests: <short list>" --body "<body>"
   ```
   Body: what was broken and why (one line per test), links to any issues opened, and `- [ ] approved:qe`.
7. Do not add labels and do not merge.
