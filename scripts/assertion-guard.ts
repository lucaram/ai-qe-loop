import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isMain } from './cli';

export interface Violation { file: string; line: string }

// The healer may fix locators, waits and navigation. It must not touch what a test checks.
const FORBIDDEN = [/expect\(/, /\.skip\(/, /\.fixme\(/, /\.only\(/, /\btag\s*:/];

export function findViolations(diff: string): Violation[] {
  const violations: Violation[] = [];
  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.replace(/^\+\+\+ (b\/)?/, '');
      continue;
    }
    if (line.startsWith('--- ')) continue;
    if ((line.startsWith('+') || line.startsWith('-')) && FORBIDDEN.some((re) => re.test(line))) {
      violations.push({ file, line });
    }
  }
  return violations;
}

if (isMain(import.meta.url)) {
  const baseIndex = process.argv.indexOf('--base');
  const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'main';
  const diff = execFileSync('git', ['diff', `${base}...HEAD`, '--', 'tests/'], { encoding: 'utf8' });
  const violations = findViolations(diff);

  const report = violations.length
    ? ['## Assertion guard: failed', '', 'Healer PRs may not change assertions, tags or skips:', '',
       ...violations.map((v) => `- \`${v.file}\`: \`${v.line.trim()}\``)].join('\n')
    : '## Assertion guard: passed\n\nNo assertion, tag or skip changes.';
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  process.exit(violations.length ? 1 : 0);
}
