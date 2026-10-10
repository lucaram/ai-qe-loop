import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedPaths, evaluateApprovals, pushedAt, requiredRoles, type LabelEvent, type Roles } from './approvals';

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
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'], events: [labeled('approved:po', 'anna-po')], headPushedAt: HEAD });
  assert.equal(r.ok, true);
});

test('missing label fails', () => {
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: [], events: [], headPushedAt: HEAD });
  assert.equal(r.ok, false);
  assert.equal(r.statuses[0].reason, 'Label approved:po is missing.');
});

test('label added by someone outside the role fails', () => {
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'], events: [labeled('approved:po', 'quinn-qe')], headPushedAt: HEAD });
  assert.equal(r.ok, false);
  assert.equal(r.statuses[0].reason, 'approved:po was added by quinn-qe, who is not listed for role po.');
});

test('a removed label does not count even though it was once added', () => {
  const events = [labeled('approved:po', 'anna-po'), unlabeled('approved:po', 'anna-po', '2026-10-10T12:00:00Z')];
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: [], events, headPushedAt: HEAD });
  assert.equal(r.ok, false);
});

test('the latest labeled actor wins', () => {
  const events = [
    labeled('approved:po', 'quinn-qe', '2026-10-10T11:00:00Z'),
    unlabeled('approved:po', 'anna-po', '2026-10-10T11:30:00Z'),
    labeled('approved:po', 'anna-po', '2026-10-10T12:00:00Z'),
  ];
  const r = evaluateApprovals({ roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'], events, headPushedAt: HEAD });
  assert.equal(r.ok, true);
});

test('a label added before the latest commit is stale', () => {
  const r = evaluateApprovals({
    roles, changedFiles: ['specs/a.md'], currentLabels: ['approved:po'],
    events: [labeled('approved:po', 'anna-po', '2026-10-10T09:00:00Z')], headPushedAt: HEAD,
  });
  assert.equal(r.ok, false);
  assert.equal(r.statuses[0].reason, 'approved:po was added before the latest commit. Remove it and add it again after reviewing the new changes.');
});

test('no changed files that need approval passes', () => {
  assert.equal(evaluateApprovals({ roles, changedFiles: ['docs/x.md'], currentLabels: [], events: [], headPushedAt: HEAD }).ok, true);
});

test('a renamed file counts under both its old and new path', () => {
  assert.deepEqual(
    changedPaths([{ filename: 'docs/old-plan.md', previous_filename: 'specs/PROJ-130-x.md' }, { filename: 'tests/a.spec.ts' }]),
    ['docs/old-plan.md', 'specs/PROJ-130-x.md', 'tests/a.spec.ts'],
  );
  assert.deepEqual(requiredRoles(roles, changedPaths([{ filename: 'docs/x.md', previous_filename: 'specs/a.md' }])), ['po']);
});

test('push time is the earliest check suite for the head commit, not the commit date', () => {
  assert.equal(
    pushedAt([{ created_at: '2026-10-10T10:45:05Z' }, { created_at: '2026-10-10T10:45:01Z' }]),
    '2026-10-10T10:45:01Z',
  );
  assert.throws(() => pushedAt([]), /No check suite/);
});
