# AI quality loop with human gates

This is the framework this repo implements. AI and automation do the work at each of the six stages. People approve anything that defines what "correct" means or can't easily be undone.

This file is the source of truth for the framework. The HTML page and the claude.ai artifact are views of it for people; if they disagree, this file wins. Changing it needs `approved:ai-qe-lead`.

Each stage lists **What** happens, **How** it is done, its **Human gate** (who approves what), and its **Status** in this repo. "Not built" means the gate is part of the target framework but nothing enforces it here yet.

Gate types:
- **Always:** every item needs approval.
- **On exception:** only items the stage flags need a person.

Role names map to `roles.json` as: Product Owner = `po`, Solution Architect = `architect`, Software Engineer = `engineer`, Developer = `developer`, QE Engineer = `qe`, AI QE Lead = `ai-qe-lead`. Tech Lead is not in `roles.json` yet; no built gate needs it.

The loop: 1 → 2 → 3 → 4 → 5 → 6 → back to 1.

---

## Stage 1: Versioned context

**Status: Partly built.**
- Built: `/pull-context` snapshots `external/` into `context/`, pinned by `context/manifest.json` (sha256 per file). Instructions, agents and skills live in the repo. Approvals are enforced through `roles.json` and the `approvals` check.
- Not built: real MCP connectors to Jira, Confluence, etc. (`external/` simulates them); agent evals; a defect and incident history source; code-generation instructions (no coding agent yet); using PR diffs to scope impact.

**What:** user stories and tasks, business rules, architecture (DSL, ADRs), API contracts, defect and incident history, plus the AI's own instructions, agents and skills. Feature-branch PR diffs are used only to scope impact, never to define expected behaviour.

**How:** pulled from each source of truth via MCP connectors or APIs, and pinned to a version for every run. Instructions, agents and skills live in the repo.

**Human gate (Always):** human approval of context changes before use.

| Item | Approver |
|---|---|
| Requirements and business rules | Product Owner |
| Architecture (DSL, ADRs) | Solution Architect |
| API contracts | Software Engineer |
| Test agents, skills and instructions | AI QE Lead + 1 QE Engineer, agent evals must pass |
| Code-generation instructions | Tech Lead |
| History (curated defect and incident logs) | AI QE Lead |
| Feature-branch PR diffs (impact only) | Already approved in code review |

---

## Stage 2: AI generates

**Status: Partly built.**
- Built: Playwright planner, generator and healer agents (`/plan-story`, `/generate-tests`, `/heal-tests`), with the approvals below enforced by labels.
- Not built: coding agents for application code (the mock app in `app/` was written by hand).

**What:** application code, test plans, automated tests and fixes for broken tests, built from the versioned context.

**How:** coding agents write application code. The Playwright planner writes the test plans; the generator turns approved plans into test code; the healer fixes tests broken by app changes.

**Human gate (Always):** human approval of generated output before merge.

| Item | Approver |
|---|---|
| Application code | Developer (normal PR review) |
| Planner test plans | Product Owner |
| Generator test code | QE Engineer |
| Healer fixes | QE Engineer |

---

## Stage 3: Evaluate in CI

**Status: Partly built.**
- Built: deterministic checks (Playwright UI and API tests, API contract validation), traceability matrix, mutation score (Stryker), plus `flaky` (new tests repeated 5 times) and `assertion-guard` (healer PRs) in `.github/workflows/ci.yml`. All are required checks on `main`.
- Not applicable yet: probabilistic checks. The mock app has no AI features for DeepEval to judge.

**What:**
- **Deterministic checks:** UI and API tests pass.
- **Traceability matrix:** every requirement links through to its tests and results.
- **Mutation score:** do the tests catch injected bugs?
- **Probabilistic checks:** LLM-as-a-judge for the product's AI features: RAG faithfulness, agent tool use, chatbot answers.

**How:**
- **Deterministic checks:** Playwright Test (UI and API).
- **Traceability matrix:** Story (AC + BR) → Test plan → Automated tests → Pull request → CI results → Bug. After a bug, fix the AC/BR or app code, then add a new tagged test. A CI script checks test tags against the approved plan and the BR list, and fails on untested or unknown items.
- **Mutation score:** Stryker.
- **Probabilistic checks:** DeepEval.

**Human gate (On exception):** checks pass or fail automatically. Each check has an owner who sets its thresholds and acts when it fails or is flagged.

| Item | Owner |
|---|---|
| Deterministic checks: failures and test quarantine | AI QE Lead |
| Traceability matrix: coverage gaps | Product Owner |
| Mutation score: thresholds and drops | AI QE Lead |
| Probabilistic checks: thresholds and borderline scores | Tech Lead |

---

## Stage 4: Release gate

**Status: Not built.**

**What:** promote, hold or send to human review, based on Stage 3 results.

**How:** CI/CD deployment approvals.
- **Hold:** failed test, untested BR, low mutation score.
- **Review:** residual risk (including borderline failures) or critical change.
- **Promote:** everything else, after a human go.

**Human gate (Always):**

| Item | Approver |
|---|---|
| Go or no-go on every release | Tech Lead (+ Product Owner if critical) |
| Override a hold | Product Owner + Tech Lead |

---

## Stage 5: Observe in production

**Status: Not built.** There is no production environment, and no AI features to monitor.

**What:** errors and incidents, user-reported defects, and AI-feature quality: drift, cost, latency.

**How:**
- Observability (e.g. Dynatrace) and alerting (e.g. Grafana).
- AI drift and cost: Langfuse traces every LLM call.
- Incidents and defects logged in Jira.

**Human gate (On exception):**

| Item | Approver |
|---|---|
| Triage incidents: escaped defect or noise | Tech Lead + AI QE Lead |
| AI drift or cost alerts | Tech Lead |

---

## Stage 6: Feed back

**Status: Not built.**

**What:** confirmed escaped defects and incidents turned into clarified AC/BR, new regression tests, new AI eval cases, and better agent instructions. All of it flows back into Stage 1.

**How:**
- Jira bug linked to its story and BR.
- Planner and generator add a regression test tagged with the bug ID.
- Bad AI outputs from Langfuse added to the DeepEval datasets.
- Recurring gaps fixed in agent instructions or skills, via PR.

**Human gate (Always):**

| Item | Approver |
|---|---|
| Clarified AC/BR | Product Owner |
| Regression tests | QE Engineer |
| AI eval cases | Tech Lead |
| Agent instruction and skill changes | AI QE Lead + 1 QE Engineer |
| History: what gets added to context | AI QE Lead |

---

## Tuning rule

Track how often humans change what each gate approves, and move each gate one step at a time:

1. **Full review:** a person approves every item. Every gate starts here.
2. **Sampling:** a person reviews a random share (e.g. 1 in 10). Move here after a few months of "approved unchanged".
3. **Automatic approval:** only after the samples also stay clean for a long time, and only where a missed mistake is cheap to fix.

If changes become frequent at any step, move the gate back one step.
