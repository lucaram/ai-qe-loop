import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { minimatch } from 'minimatch';
import { isMain } from './cli';

export interface RoleConfig { users: string[]; approves: string[] }
export type Roles = Record<string, RoleConfig>;
export interface LabelEvent { event: string; created_at: string; label?: { name: string }; actor?: { login: string } | null }
export interface ApprovalStatus { role: string; label: string; present: boolean; addedBy: string | null; reason: string | null }

export function requiredRoles(roles: Roles, changedFiles: string[]): string[] {
  return Object.entries(roles)
    .filter(([, config]) => changedFiles.some((file) => config.approves.some((glob) => minimatch(file, glob, { dot: true }))))
    .map(([role]) => role);
}

export function evaluateApprovals(input: {
  roles: Roles; changedFiles: string[]; currentLabels: string[]; events: LabelEvent[]; headCommittedAt: string;
}): { ok: boolean; statuses: ApprovalStatus[] } {
  const statuses = requiredRoles(input.roles, input.changedFiles).map((role): ApprovalStatus => {
    const label = `approved:${role}`;
    const present = input.currentLabels.includes(label);
    const lastAdd = input.events.filter((e) => e.event === 'labeled' && e.label?.name === label).at(-1);
    const addedBy = lastAdd?.actor?.login ?? null;

    let reason: string | null = null;
    if (!present) reason = `Label ${label} is missing.`;
    else if (!addedBy || !input.roles[role].users.includes(addedBy)) {
      reason = `${label} was added by ${addedBy ?? 'unknown'}, who is not listed for role ${role}.`;
    } else if (new Date(lastAdd!.created_at) < new Date(input.headCommittedAt)) {
      reason = `${label} was added before the latest commit. Remove it and add it again after reviewing the new changes.`;
    }
    return { role, label, present, addedBy, reason };
  });
  return { ok: statuses.every((s) => s.reason === null), statuses };
}

export function renderSummary(statuses: ApprovalStatus[]): string {
  if (statuses.length === 0) return '## Approvals\n\nNo changed file needs a role approval.\n';
  const lines = ['## Approvals', '', '| Role | Label | Added by | Result |', '|---|---|---|---|'];
  for (const s of statuses) lines.push(`| ${s.role} | \`${s.label}\` | ${s.addedBy ?? '–'} | ${s.reason ?? 'Verified'} |`);
  return lines.join('\n') + '\n';
}

const gh = (...args: string[]) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

if (isMain(import.meta.url)) {
  const repo = process.env.GITHUB_REPOSITORY!;
  const pr = process.env.PR_NUMBER!;
  const roles = JSON.parse(readFileSync('roles.json', 'utf8')) as Roles;

  const changedFiles = gh('pr', 'diff', pr, '--repo', repo, '--name-only').split('\n').filter(Boolean);
  const currentLabels = gh('pr', 'view', pr, '--repo', repo, '--json', 'labels', '--jq', '.labels[].name').split('\n').filter(Boolean);
  const headCommittedAt = gh('pr', 'view', pr, '--repo', repo, '--json', 'commits', '--jq', '.commits[-1].committedDate').trim();
  const events = gh('api', `repos/${repo}/issues/${pr}/events`, '--paginate', '--jq', '.[]')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line) as LabelEvent);

  const result = evaluateApprovals({ roles, changedFiles, currentLabels, events, headCommittedAt });
  const summary = renderSummary(result.statuses);
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  process.exit(result.ok ? 0 : 1);
}
