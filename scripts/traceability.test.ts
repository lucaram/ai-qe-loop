import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectTests, evaluate, parseRuleId, parseStory, type TraceInput } from './traceability';

const story = parseStory('Key:        PROJ-130\nAC-1: Given...\nAC-2: Given...\n');
const plan = { key: 'PROJ-130', text: '### 1. Lock [PROJ-130][AC-1][BR-001]\n### 2. Locked [PROJ-130][AC-2][BR-001]\n' };

function input(tests: TraceInput['tests'], plans = [plan]): TraceInput {
  return { stories: [story], rules: ['BR-001', 'BR-002'], plans, tests };
}

test('parses stories and rules', () => {
  assert.deepEqual(story, { key: 'PROJ-130', acs: ['AC-1', 'AC-2'] });
  assert.equal(parseRuleId('## BR-002: Successful login resets the counter'), 'BR-002');
});

test('collects tests and tags from nested Playwright list JSON', () => {
  const json = { suites: [{ specs: [], suites: [{ specs: [{ title: 't1', file: 'a.spec.ts', tags: ['@PROJ-130', 'AC-1'] }] }] }] };
  assert.deepEqual(collectTests(json), [{ title: 't1', file: 'a.spec.ts', tags: ['@PROJ-130', '@AC-1'] }]);
});

test('full coverage has no errors, unplanned BR is a warning', () => {
  const result = evaluate(input([
    { title: 'a', file: 'f', tags: ['@PROJ-130', '@AC-1', '@BR-001'] },
    { title: 'b', file: 'f', tags: ['@PROJ-130', '@AC-2', '@BR-001'] },
  ]));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['BR-002 is not referenced by any approved plan.']);
});

test('an AC of a planned story without a test is an error', () => {
  const result = evaluate(input([{ title: 'a', file: 'f', tags: ['@PROJ-130', '@AC-1', '@BR-001'] }]));
  assert.deepEqual(result.errors, ['PROJ-130 AC-2 has no test.']);
});

test('a story without an approved plan is not required yet', () => {
  assert.deepEqual(evaluate(input([], [])).errors, []);
});

test('typo tags are errors', () => {
  const result = evaluate(input([
    { title: 'a', file: 'f', tags: ['@PROJ-130', '@AC-1', '@AC-2', '@BR-001', '@BR-01'] },
    { title: 'b', file: 'f', tags: ['@PROJ-130', '@AC-9'] },
    { title: 'c', file: 'f', tags: ['@PROJ-999'] },
    { title: 'd', file: 'f', tags: ['@AC-1'] },
  ]));
  assert.deepEqual(result.errors, [
    'Test "a" has unknown tag @BR-01.',
    'Test "b" has tag @AC-9, but PROJ-130 has no AC-9.',
    'Test "c" has unknown tag @PROJ-999.',
    'Test "d" has tag @AC-1 but no story tag.',
  ]);
});

test('a context update that adds an AC asks for a re-plan instead of failing', () => {
  const grown = parseStory('Key: PROJ-130\nAC-1: a\nAC-2: b\nAC-3: c\n');
  const result = evaluate({ stories: [grown], rules: ['BR-001'], plans: [plan], tests: [
    { title: 'a', file: 'f', tags: ['@PROJ-130', '@AC-1', '@BR-001'] },
    { title: 'b', file: 'f', tags: ['@PROJ-130', '@AC-2', '@BR-001'] },
  ] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['PROJ-130 AC-3 is in the story but not in the approved plan: re-plan needed.']);
});

test('a context update that removes an AC keeps its tests valid and asks for a re-plan', () => {
  const shrunk = parseStory('Key: PROJ-130\nAC-1: a\n');
  const result = evaluate({ stories: [shrunk], rules: ['BR-001'], plans: [plan], tests: [
    { title: 'a', file: 'f', tags: ['@PROJ-130', '@AC-1', '@BR-001'] },
    { title: 'b', file: 'f', tags: ['@PROJ-130', '@AC-2', '@BR-001'] },
  ] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['PROJ-130 AC-2 is in the approved plan but no longer in the story: re-plan needed.']);
});
