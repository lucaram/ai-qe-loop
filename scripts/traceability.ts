import { execFileSync, execSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BUSINESS_RULE_DIR, CONTEXT_DIR, SPECS_DIR, STORY_DIR } from './config';
import { isMain } from './cli';

export interface Story { key: string; acs: string[] }
export interface TestCase { title: string; file: string; tags: string[] }
export interface TraceInput { stories: Story[]; rules: string[]; plans: { key: string; text: string }[]; tests: TestCase[] }
export interface TraceRow { item: string; tests: string[] }
export interface TraceResult { errors: string[]; warnings: string[]; rows: TraceRow[] }

const STORY_TAG = /^@(?!AC-|BR-)[A-Z][A-Z0-9]*-\d+$/;
const AC_TAG = /^@AC-\d+$/;
const BR_TAG = /^@BR-\d+$/;

export function parseStory(text: string): Story {
  const key = /^Key:\s*(\S+)/m.exec(text)?.[1];
  if (!key) throw new Error('Story file has no "Key:" line.');
  return { key, acs: [...text.matchAll(/^(AC-\d+):/gm)].map((m) => m[1]) };
}

export function parseRuleId(text: string): string | null {
  return /^##\s*(BR-\d+):/m.exec(text)?.[1] ?? null;
}

interface ListSuite { specs?: { title: string; file: string; tags?: string[] }[]; suites?: ListSuite[] }

export function collectTests(listJson: unknown): TestCase[] {
  const out: TestCase[] = [];
  const walk = (suite: ListSuite) => {
    for (const spec of suite.specs ?? []) {
      out.push({
        title: spec.title,
        file: spec.file,
        tags: (spec.tags ?? []).map((t) => (t.startsWith('@') ? t : `@${t}`)),
      });
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  walk(listJson as ListSuite);
  return out;
}

export function evaluate({ stories, rules, plans, tests }: TraceInput): TraceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: TraceRow[] = [];
  const storyByKey = new Map(stories.map((s) => [s.key, s]));
  // ACs the approved plan covers. These, not the latest story text, are what tests must cover:
  // a context update must not fail CI before a new plan can be written for it.
  const planAcs = new Map(plans.map((p) => [p.key, [...new Set([...p.text.matchAll(/\[(AC-\d+)\]/g)].map((m) => m[1]))]]));

  // 1. Every tag must point at something that exists.
  for (const t of tests) {
    const storyTags = t.tags.filter((tag) => STORY_TAG.test(tag));
    for (const tag of storyTags) {
      if (!storyByKey.has(tag.slice(1))) errors.push(`Test "${t.title}" has unknown tag ${tag}.`);
    }
    for (const tag of t.tags.filter((x) => BR_TAG.test(x))) {
      if (!rules.includes(tag.slice(1))) errors.push(`Test "${t.title}" has unknown tag ${tag}.`);
    }
    const knownStories = storyTags.map((tag) => storyByKey.get(tag.slice(1))).filter((s): s is Story => !!s);
    for (const tag of t.tags.filter((x) => AC_TAG.test(x))) {
      if (storyTags.length === 0) errors.push(`Test "${t.title}" has tag ${tag} but no story tag.`);
      else if (knownStories.length > 0
        && !knownStories.some((s) => s.acs.includes(tag.slice(1)) || (planAcs.get(s.key) ?? []).includes(tag.slice(1)))) {
        errors.push(`Test "${t.title}" has tag ${tag}, but ${knownStories.map((s) => s.key).join('/')} has no ${tag.slice(1)}.`);
      }
    }
  }

  // 2. Stories with an approved plan: every AC and every referenced BR needs a test.
  const plannedRules = new Set<string>();
  for (const planItem of plans) {
    const story = storyByKey.get(planItem.key);
    if (!story) {
      errors.push(`Plan for ${planItem.key} has no matching story in context.`);
      continue;
    }
    for (const m of planItem.text.matchAll(/\[(BR-\d+)\]/g)) plannedRules.add(m[1]);
    const covered = planAcs.get(story.key) ?? [];
    for (const ac of story.acs.filter((a) => !covered.includes(a))) {
      warnings.push(`${story.key} ${ac} is in the story but not in the approved plan: re-plan needed.`);
    }
    for (const ac of covered.filter((a) => !story.acs.includes(a))) {
      warnings.push(`${story.key} ${ac} is in the approved plan but no longer in the story: re-plan needed.`);
    }
    for (const ac of covered) {
      const covering = tests.filter((t) => t.tags.includes(`@${story.key}`) && t.tags.includes(`@${ac}`));
      rows.push({ item: `${story.key} ${ac}`, tests: covering.map((t) => t.title) });
      if (covering.length === 0) errors.push(`${story.key} ${ac} has no test.`);
    }
  }
  for (const rule of rules) {
    const covering = tests.filter((t) => t.tags.includes(`@${rule}`));
    if (plannedRules.has(rule)) {
      rows.push({ item: rule, tests: covering.map((t) => t.title) });
      if (covering.length === 0) errors.push(`${rule} has no test.`);
    } else {
      warnings.push(`${rule} is not referenced by any approved plan.`);
    }
  }
  return { errors, warnings, rows };
}

export function renderMarkdown({ errors, warnings, rows }: TraceResult): string {
  const lines = ['## Traceability matrix', '', '| Item | Tests |', '|---|---|'];
  for (const row of rows) lines.push(`| ${row.item} | ${row.tests.length ? row.tests.join('<br>') : '**none**'} |`);
  if (errors.length) lines.push('', '### Errors', ...errors.map((e) => `- ${e}`));
  if (warnings.length) lines.push('', '### Warnings', ...warnings.map((w) => `- ${w}`));
  return lines.join('\n') + '\n';
}

function readDir(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).map((f) => readFileSync(path.join(dir, f), 'utf8')) : [];
}

if (isMain(import.meta.url)) {
  const baseIndex = process.argv.indexOf('--base');
  const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'HEAD';

  const stories = readDir(path.join(CONTEXT_DIR, STORY_DIR)).map(parseStory);
  const rules = readDir(path.join(CONTEXT_DIR, BUSINESS_RULE_DIR)).map(parseRuleId).filter((r): r is string => !!r);

  // A plan counts as approved once it is on the base branch (merged after PO approval).
  const approvedPlanFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', base, `${SPECS_DIR}/`], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /^specs\/[A-Z][A-Z0-9]*-\d+-.+\.md$/.test(f));
  const plans = approvedPlanFiles
    .filter((f) => existsSync(f))
    .map((f) => ({ key: /^specs\/([A-Z][A-Z0-9]*-\d+)-/.exec(f)![1], text: readFileSync(f, 'utf8') }));

  const listJson = JSON.parse(execSync('npx playwright test --list --reporter=json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const result = evaluate({ stories, rules, plans, tests: collectTests(listJson) });

  const markdown = renderMarkdown(result);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  process.exit(result.errors.length ? 1 : 0);
}
