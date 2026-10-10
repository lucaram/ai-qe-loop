---
name: pull-context
description: Stage 1. Pull the external sources (stories, business rules, architecture, API contract) into the pinned context/ snapshot and open a PR for the owning roles to approve. Use when the user runs /pull-context or says the requirements or contracts changed.
---

# Pull context

1. `git switch main && git pull --ff-only`
2. Run `npm run context:pull`.
   - If it prints `Context unchanged`, tell the user and stop.
3. `git switch -c context/$(date +%F)`
4. List the changed files with `git status --porcelain context/`.
5. Work out the approvals needed: read `roles.json` and match each changed file against each role's `approves` globs. `context/manifest.json` needs none.
6. Commit: `git add context && git commit -m "Pull context: <short list of what changed>"`
7. Push and open the PR:
   ```bash
   git push -u origin HEAD
   gh pr create --title "Context update: <short list>" --body "<body>"
   ```
   The body has three parts:
   - **What changed:** one line per changed source file, with its old and new sha256 prefix from `context/manifest.json` (old values from `git show main:context/manifest.json`).
   - **Approvals needed:** one line per role, e.g. `- [ ] approved:po (business rules)`.
   - **Impact:** the plans in `specs/` and tests in `tests/` that mention the changed story keys or BR IDs (`git grep -l "<ID>" specs tests`).
8. Do not add labels and do not merge. Give the user the PR link and the labels that are needed.
