# AI QE Loop

This repo runs an AI quality loop: AI does the work, people approve anything that defines what "correct" means.

| Stage | Status | Where |
|---|---|---|
| 1. Versioned context | Built | `/pull-context`, `context/` |
| 2. AI generates | Built | `/plan-story`, `/generate-tests`, `/heal-tests` |
| 3. Evaluate in CI | Built | `.github/workflows/` |
| 4. Release gate | Not built yet | — |
| 5. Observe in production | Not built yet (no production; no AI features for DeepEval/Langfuse) | — |
| 6. Feed back | Not built yet | — |

## Source of truth

- Expected behaviour comes **only** from `context/`: stories (`context/jira-requirement/`), business rules (`context/budiness-rule/`), architecture (`context/architecture/`), API contract (`context/api/openapi.json`).
- Never derive expected behaviour from `app/` code or from PR diffs. If the app and the context disagree, that is a possible bug: report it, do not change the test to match the app.
- `external/` simulates Jira, Confluence, etc. Never edit it as part of a task; it changes only when the user simulates a change in a source system.
- Never edit `context/` by hand. Only `/pull-context` writes it.

## Conventions

- Test plans: `specs/<KEY>-<slug>.md`. Every scenario heading ends with its IDs, e.g. `### 3. Correct password while locked [PROJ-130][AC-2][BR-001]`.
- Tests: API tests in `tests/api/`, UI tests in `tests/ui/`, file name `<KEY>-<slug>.spec.ts`.
- Tags on every test: `@<KEY>`, `@AC-<n>` when the scenario has one, `@BR-<nnn>`. Example: `test('...', { tag: ['@PROJ-130', '@AC-2', '@BR-001'] }, async (...) => {})`.
- API tests use `tests/support/api.ts`: `login()` checks every response against the API contract; `setAccount()` / `getAccount()` set up and read state through the test hooks (ADR-0001). Never wait for real time to pass.
- Every test uses its own account: `uniqueUsername(testInfo)`.
- Lock rules are tested at API level. UI tests only check that the message from the API is shown (ADR-0002).
- Branches: `context/<yyyy-mm-dd>`, `<KEY>-plan`, `<KEY>-tests`, `heal/<yyyy-mm-dd>`, `framework/<topic>`.
- PR titles start with the story key when there is one: `PROJ-130: test plan`.

## Approvals

- `roles.json` maps each role to GitHub users and the paths it approves. The `approvals` check works out which roles a PR needs from its changed files.
- A role approves by adding the label `approved:<role>`. CI checks who added it and that it was added after the latest push. The check runs from the base branch, so a PR cannot change its own approval rules.
- **Never add `approved:*` labels. Never merge PRs.** A person does both.
- In this repo all roles map to one user; that is a simulation of a real team (see README).

## Healer limits

The healer may change locators, waits on elements or responses, and navigation steps. It must not change any `expect(...)`, expected values or tags, and must not add `skip`, `fixme` or `only` or change `playwright.config.ts`. If a test can only pass by changing any of those, stop and open an issue `Possible bug or requirement change: <test name>` with the failure output. The `assertion-guard` check enforces this on `heal/*` branches.

## Commands

- `npm run app` — start the app on http://localhost:3000 (`TEST_HOOKS=1` enables test hooks)
- `npm test` — Playwright tests (starts the app itself on port 3000; the Playwright MCP server used by the agents runs its own app on 3100, set by `PW_PORT` in `.mcp.json`)
- `npm run test:unit` — unit tests for app logic and scripts
- `npm run typecheck`, `npm run lint`
- `npm run context:pull` — Stage 1 snapshot
- `npm run traceability -- --base main` — matrix and gaps
- `npm run mutation` — Stryker
