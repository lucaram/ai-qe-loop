# AI QE Loop

A working example of an AI quality loop with human gates (Stages 1–3), on a mock login service.

- The framework: [docs/framework.md](docs/framework.md)
- Why it is built this way: [docs/decisions.md](docs/decisions.md)

## Run it

```bash
npm ci
npx playwright install chromium
npm test
```

## The loop for one story

1. `/pull-context`: snapshot `external/` into `context/` → PR → owning roles add their `approved:*` labels → merge
2. `/plan-story PROJ-130` → plan PR → Product Owner adds `approved:po` → merge
3. `/generate-tests PROJ-130` → tests PR → CI green + QE adds `approved:qe` → merge
4. When an app change breaks tests: `/heal-tests` → PR → `approved:qe` → merge

## Checks on every PR

`typecheck-lint`, `tests` (incl. API contract), `traceability`, `flaky`, `assertion-guard` (heal branches), `mutation`, `approvals`.

## About the approval labels

Labels plus `roles.json` simulate role approvals for a one-person repo. CI verifies who added each label and that it came after the latest push. In a real team, generate `CODEOWNERS` from `roles.json` and switch to required PR reviews; the role-to-path rules stay the same.

## Set up a new repo from this one

Run once, as the repo owner, after the first push to `main` (replace `OWNER/REPO`). Wait for the first `ci` run on `main` to go green before step 3, so the check names exist.

1. Create the repo and push:
   ```bash
   gh repo create OWNER/REPO --public --source . --remote origin --push
   ```
   Branch protection is free on public repos; a private repo needs a paid GitHub plan.
2. Create one approval label per role in `roles.json`:
   ```bash
   for role in po architect engineer developer qe ai-qe-lead; do
     gh label create "approved:$role" --repo OWNER/REPO --color 0E8A16 --description "Approval by role $role (see roles.json)"
   done
   ```
3. Protect `main` (all checks required, no direct pushes, admins included):
   ```bash
   gh api -X PUT repos/OWNER/REPO/branches/main/protection --input - <<'JSON'
   {
     "required_status_checks": {
       "strict": true,
       "contexts": ["typecheck-lint", "tests", "traceability", "flaky", "assertion-guard", "mutation", "approvals"]
     },
     "enforce_admins": true,
     "required_pull_request_reviews": null,
     "restrictions": null,
     "required_linear_history": true,
     "allow_force_pushes": false,
     "allow_deletions": false
   }
   JSON
   ```
4. Put the real GitHub usernames for each role in `roles.json` (via a PR).
5. Check it works: open a PR that only edits `README.md` (all checks should pass), then add a change to `roles.json` (`approvals` should fail with `Label approved:ai-qe-lead is missing.`). Close the PR without merging.
6. In Claude Code, approve the `playwright-test` MCP server when asked ("Use this MCP server"), then start a new session.
