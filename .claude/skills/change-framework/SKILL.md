---
name: change-framework
description: Change the AI QE framework itself (CLAUDE.md, skills, agents, scripts, workflows, roles.json) on a branch and open a PR for the AI QE Lead and QE to approve. Use when the user asks to change how the loop, agents, skills or checks work.
---

# Change the framework

1. `git switch main && git pull --ff-only`
2. `git switch -c framework/<short-topic>`
3. Make the change the user asked for. Keep `CLAUDE.md`, the skills and the scripts consistent with each other: if a convention changes, update every place that states it.
4. Do not edit `.claude/agents/playwright-test-*.md` by hand. To update them, run `npx playwright init-agents --loop=claude` and commit the result as is.
   `init-agents` also rewrites `.mcp.json`: add back `"env": { "PW_PORT": "3100" }` to the `playwright-test` server, so the agents' app does not take port 3000 from `npm test`.
5. Run `npm run typecheck && npm run lint && npm run test:unit && npm test`.
6. Commit, push and open the PR:
   ```bash
   git push -u origin HEAD
   gh pr create --title "Framework: <topic>" --body "<what changed, why, and what it affects>"
   ```
   The `approvals` check lists the roles needed (e.g. `approved:ai-qe-lead`, `approved:qe`); list them in the body as checkboxes.
7. Do not add labels and do not merge.
