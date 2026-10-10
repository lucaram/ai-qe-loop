# AI QE Loop

A working example of an AI quality loop with human gates (Stages 1–3), on a mock login service.

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

Labels plus `roles.json` simulate role approvals for a one-person repo. CI verifies who added each label and that it came after the latest commit. In a real team, generate `CODEOWNERS` from `roles.json` and switch to required PR reviews; the role-to-path rules stay the same.
