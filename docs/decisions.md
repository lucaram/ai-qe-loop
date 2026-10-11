# Decisions

Why this repo is built the way it is. Read this before rebuilding or changing the framework (`docs/framework.md`). Newest decisions supersede older documents: where `docs/specs/2026-10-10-ai-qe-loop-design.md` or the implementation plan disagree with this file or the code, this file and the code win.

Each decision: what was decided, and why. Add new decisions at the end of their section, with the PR number.

## Scope and setup

1. **Build Stages 1–3 first.** Stages 4–6 come later. Stage 5 (observability) and DeepEval need a production environment and AI features, which the mock app does not have.
2. **A mock Auth Service is the system under test** (`app/`, Express + TypeScript). There was no real app to test; a small app built from the story, ADRs and API contract gives the tests and Stryker real code.
3. **`external/` simulates the source systems** (Jira, business rules, architecture, API contract). Real MCP connectors come later; the snapshot and pinning logic stays the same.
4. **Public GitHub repo with GitHub Actions.** Branch protection, which makes the checks required, is free on public repos; on private repos it needs a paid plan.
5. **Playwright's planner, generator and healer agents are used unchanged** (`npx playwright init-agents --loop=claude`). Project rules live in `CLAUDE.md` and the skills, so a Playwright upgrade can regenerate the agents without losing anything.
6. **The Playwright MCP server's app runs on port 3100** (`PW_PORT` in `.mcp.json`), so it never blocks `npm test`, Stryker or CI on port 3000. Re-add the setting after re-running `init-agents`. (PR #6)
7. **Only the `playwright-test` MCP server is approved for this project**, not "all future servers". Any server added to `.mcp.json` later must be approved again.

## Context (Stage 1)

8. **Context is a pinned snapshot.** `/pull-context` copies `external/` into `context/` and records a sha256 per file in `context/manifest.json`. Every run uses a known version, and a change shows up as a reviewable PR.
9. **Line endings are normalised to LF** before hashing and in git (`.gitattributes`). Otherwise the manifest would change on every Windows checkout.
10. **Hand edits to `context/` are overwritten.** `/pull-context` checks the files against their hashes, not only the manifest. (PR #7)
11. **Expected behaviour comes only from `context/`**, never from app code or PR diffs. PR diffs may only scope impact. If the app and the context disagree, it is reported as a possible bug.

## Approvals

12. **Role approvals are labels (`approved:<role>`)** checked by CI against `roles.json`. Labels were chosen over comment commands (`/approve po`) because they are easier to use; both prove identity the same way, through GitHub's record of who acted.
13. **`roles.json` is the single source of who approves which paths.** For a real team, generate `CODEOWNERS` from it and switch to required PR reviews; the rules stay the same.
14. **CI verifies who added each label.** The latest `labeled` event's actor must be listed for the role. Anyone can add a label; only the right person's counts.
15. **An approval only counts if it was added after the latest push.** Push time comes from GitHub (the head commit's earliest check suite), not the commit date, which the committer's clock sets and can be faked. (review fix)
16. **The approvals check runs from the base branch** (`pull_request_target`, base checkout), so a PR cannot weaken its own approval rules. Config files (`package.json`, `playwright.config.ts`, `stryker.config.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitattributes`, `.gitignore`, `.mcp.json`) need `approved:ai-qe-lead`. (review fix)
17. **A renamed file counts under both its old and new path**, so moving a file out of a role's folder still needs that role. (review fix)
18. **Approvals run in their own workflow** (`approvals.yml`), separate from `ci.yml`. Label events re-run only approvals; if they re-ran `ci.yml` with the other jobs skipped, a skipped result could hide an earlier failure.
19. **Agents never add `approved:*` labels and never merge.** Today this is only an instruction, because agents use the owner's GitHub login. Planned fix: a GitHub App identity for agents (`ai-qe-bot`); see "Planned" below.

## Plans and tests (Stage 2)

20. **A plan counts as approved once it is merged to `main`.** `/generate-tests` refuses to run on an unmerged plan.
21. **Scenario headings carry their IDs** (`[KEY][AC-n][BR-nnn]`). PO clarifications are named in the title text, not as IDs.
22. **Tests are tagged `@<KEY>`, `@AC-<n>`, `@BR-<nnn>`.** Any other tag fails traceability (PR #7); adding a new tag type (e.g. `@critical` for the release gate) means extending `scripts/traceability.ts` and `CLAUDE.md`.
23. **API tests are written directly from the plan; UI tests are recorded by the generator agent** against the live page.
24. **Lock rules are tested at API level; UI tests only check the message is shown** (ADR-0002).
25. **Tests set up state through test hooks** (`PUT/GET /test/accounts/:username`, only when `TEST_HOOKS=1`), as ADR-0001 allows. `lockedForMs` is relative to server time, so tests never wait for real time and never depend on the test machine's clock.
26. **Every test uses its own account** (`uniqueUsername(testInfo)`), so parallel and repeated runs never share state.
27. **Tests only assert text that appears in `context/`.** Text the app shows without a source (e.g. "Signed in.") is reported as a requirement gap, not asserted. (PR #7)
28. **The healer may only change locators, waits and navigation.** It may not change assertions (including matchers on their own line), expected values or tags, add skips, or change `playwright.config.ts`. When a violation is found, only the violating lines are undone, and an issue is opened for each test that still fails. (review fix, PR #7)

## Checks (Stage 3)

29. **Traceability requires the ACs in the approved plan**, read from the base branch. A story whose ACs changed after planning produces a "re-plan needed" warning, so a context update cannot deadlock CI. BRs referenced by no approved plan are warnings. (review fix, PR #7)
30. **Every API response is validated against the pinned OpenAPI contract** (ajv) inside the tests.
31. **`retries: 0`.** Flaky tests must surface, not be retried into green. The `flaky` job runs new or changed test files 5 times (`--repeat-each=5`).
32. **Mutation testing uses Stryker's command runner with the Playwright API tests**, on `app/src/auth.ts`, `break: 60`, concurrency 1 (each mutant starts the app on port 3000). The first run on PROJ-130 scored 96.08%; the 2 survivors are the exact-millisecond lock boundary, which only unit tests can reach.
33. **PR CI runs cancel when a newer push supersedes them; runs on `main` never cancel each other.** (PR #7)

## Failure modes pinned by tests

These were picked deliberately during planning because no ordinary test would catch them:

- A CRLF source file must hash the same as its LF version.
- A removed approval label must not count, even though it was once added.
- If a label is added by the wrong person and later re-added by the right one, the latest actor wins.
- When the lock ends exactly now, login is allowed and the count is 0; one millisecond before, it is refused.
- A typo in a tag (`@BR-01`, `@AC-9` for a story without AC-9, `@AC9`) fails traceability.

## Planned

- **Stage 4 release gate.** Every release needs a human go (Tech Lead, plus PO if critical). Holds: failed test, untested BR, low mutation score. Overriding a hold needs PO + Tech Lead.
- **Agent identity: a GitHub App (`ai-qe-bot`), owned by the repo owner, with contents and pull-requests write only.** The bot is not in `roles.json`, so its labels never count; that check is the real control, because GitHub permissions cannot block label adds, and restricting who can merge is org-only. A script mints its 1-hour token from the app's private key, which is never committed. On a laptop this gives attribution only, because the owner's own login is still present; real enforcement needs the agents to run in CI, a container or a separate OS user.
- **Agent evals** for changes to skills and instructions (Stage 1 gate: "agent evals must pass").
- **Stage 6 feedback skill:** bug → clarified AC/BR → regression test tagged with the bug ID.
