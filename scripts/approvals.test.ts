import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateApprovals, requiredRoles, type LabelEvent, type Roles } from './approvals';

const roles: Roles = {
  po: { users: ['anna-po'], approves: ['specs/**'] },
  qe: { users: ['quinn-qe'], approves: ['tests/**', '.claude/**'] },
  'ai-qe-lead': { users: ['lead'], approves: ['.claude/**'] },
};
const HEAD = '2026-10-10T10:00:00Z';
const labeled = (name: string, login: string, at = '2026-10-10T11:00:00Z'): LabelEvent =>
  ({ event: 'labeled', created_at: at, label: { name }, actor: { login } });
const unlabeled = (name: string, login: string, at: string): LabelEvent =>
  ({ event: 'unlabeled', created_at: at, label: { name }, actor: { login } });

test('required roles come from changed files; unmatched files need nothing', () => {
  assert.deepEqual(requiredRoles(roles, ['specs/PROJ-130-x.md', 'docs/readme.md']), ['po']);
  assert.deepEqual(requiredRoles(roles, ['.claude/skills/a/SKILL.md']), ['qe', 'ai-qe-lead']);
});

test('label added by a listed user passes', () => {
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'], events: [labeled('approved:po', 'anna-po')], headCommittedAt: HEAD });
  assert.equal(r.ok, true);
});

test('missing label fails', () => {
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: [], events: [], headCommittedAt: HEAD });
  assert.equal(r.ok, false);
  assert.equal(r.statuses[0].reason, 'Label approved:po is missing.');
});

test('label added by someone outside the role fails', () => {
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'], events: [labeled('approved:po', 'quinn-qe')], headCommittedAt: HEAD });
  assert.equal(r.ok, false);
  assert.equal(r.statuses[0].reason, 'approved:po was added by quinn-qe, who is not listed for role po.');
});

test('a removed label does not count even though it was once added', () => {
  const events = [labeled('approved:po', 'anna-po'), unlabeled('approved:po', 'anna-po', '2026-10-10T12:00:00Z')];
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: [], events, headCommittedAt: HEAD });
  assert.equal(r.ok, false);
});

test('the latest labeled actor wins', () => {
  const events = [
    labeled('approved:po', 'quinn-qe', '2026-10-10T11:00:00Z'),
    unlabeled('approved:po', 'anna-po', '2026-10-10T11:30:00Z'),
    labeled('approved:po', 'anna-po', '2026-10-10T12:00:00Z'),
  ];
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'], events, headCommittedAt: HEAD });
  assert.equal(r.ok, true);
});

test('a label added before the latest commit is stale', () => {
  const r = evaluateApprovals({
    roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'],
    events: [labeled('approved:po', 'anna-po', '2026-10-10T09:00:00Z')], headCommittedAt: HEAD,
  });
  assert.equal(r.ok, false);
  assert.equal(r.statuses[0].reason, 'approved:po was added before the latest commit. Remove it and add it again after reviewing the new changes.');
});

test('no changed files that need approval passes', () => {
  assert.equal(evaluateApprovals({ roles, changedFiles: ['docs/x.md'], currentLabels: [], events: [], headCommittedAt: HEAD }).ok, true);
});
