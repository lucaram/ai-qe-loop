---
name: plan-story
description: Stage 2. Write a Playwright test plan for one Jira story from the pinned context, using the playwright-test-planner agent, and open a PR for the Product Owner to approve. Use when the user runs /plan-story <KEY>.
---

# Plan a story

Input: a story key, e.g. `PROJ-130` (from the arguments: $ARGUMENTS).

## 1. Prepare

1. `git switch main && git pull --ff-only`
2. Stop if `context/jira-requirement/<KEY>.txt` does not exist: tell the user to run `/pull-context`.
3. Stop if `specs/<KEY>-*.md` already exists on `main`: the plan is already approved. Changing it needs a new plan PR the user asks for explicitly.
4. `git switch -c <KEY>-plan`

## 2. Gather the context

Read:
- the story: `context/jira-requirement/<KEY>.txt` (acceptance criteria **and** PO clarifications)
- every business rule in `context/budiness-rule/`; decide which ones this story covers and why
- `context/architecture/adr.txt` and `context/architecture/dsl.txt` (note components tagged `risk:high`)
- `context/api/openapi.json`

## 3. Brief the planner

Use the `playwright-test-planner` agent with `tests/seed.spec.ts` as the seed. Give it this brief, filled in:

> Plan tests for <KEY>: <summary>. Save the plan as `specs/<KEY>-<slug>.md`.
> Sources (the only source of truth): <paste the story, the linked BRs, the relevant ADR decisions, the API responses>.
> Rules:
> - One scenario per acceptance criterion, one per PO clarification, and one per entry in each linked BR's `ways_to_break`.
> - Every scenario heading ends with its IDs: `[<KEY>]`, `[AC-n]` if it comes from an AC, and `[BR-nnn]` for each rule it checks.
> - Cover boundaries explicitly (e.g. 4 vs 5 failed attempts; lock end one moment before vs exactly at 15 minutes).
> - Lock logic goes in an "API scenarios" section: they call `POST /auth/login` and set up state with the test hooks (`PUT /test/accounts/:username` with `failedAttempts`, `lockedForMs`). UI scenarios only check that the API's message is shown on the login page (ADR-0002).
> - Each scenario has: Setup, Steps, Expected result (exact status codes and message text from the sources).
> - Do not describe how the app is implemented; describe what the sources require.

## 4. Check the plan before opening the PR

Open the saved plan and confirm, fixing it yourself if needed:
- the file starts with `# <KEY>: <summary>`, then `Sources: context/manifest.json pulled_at <value>` and `Business rules: <IDs>`
- every AC has a scenario; every PO clarification has a scenario; every `ways_to_break` has a scenario
- every scenario heading has its IDs in brackets
- expected messages are copied exactly from the sources

## 5. Open the PR

```bash
git add specs
git commit -m "<KEY>: test plan"
git push -u origin HEAD
gh pr create --title "<KEY>: test plan" --body "<body>"
```
Body:
- **Story:** <KEY> — <summary>
- **Business rules:** <IDs and one line each on why they apply>
- **Coverage:** a table of AC / clarification / ways_to_break → scenario number
- **Approvals needed:** `- [ ] approved:po`

Do not add labels and do not merge. Tell the user: the Product Owner reviews the plan and adds `approved:po`; after merge, run `/generate-tests <KEY>`.
