import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isMain } from './cli';

export interface Violation { file: string; line: string }

// The healer may fix locators, waits and navigation. It must not touch what a test checks.
const FORBIDDEN = [/expect\(/, /\.(not\.)?to[A-Z]\w*\(/, /\.skip\(/, /\.fixme\(/, /\.only\(/, /\btag\s*:/];
// Config can weaken every test at once (retries, timeouts, testIgnore), so any change counts.
const PROTECTED_FILES = ['playwright.config.ts'];

export function findViolations(diff: string): Violation[] {
  const violations: Violation[] = [];
  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.replace(/^\+\+\+ (b\/)?/, '');
      continue;
    }
    if (line.startsWith('--- ')) continue;
    const changed = line.startsWith('+') || line.startsWith('-');
    if (changed && (PROTECTED_FILES.includes(file) || FORBIDDEN.some((re) => re.test(line)))) {
      violations.push({ file, line });
    }
  }
  return violations;
}

if (isMain(import.meta.url)) {
  const baseIndex = process.argv.indexOf('--base');
  const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'main';
  const diff = execFileSync('git', ['diff', `${base}...HEAD`, '--', 'tests/', ...PROTECTED_FILES], { encoding: 'utf8' });
  const violations = findViolations(diff);

  const report = violations.length
    ? ['## Assertion guard: failed', '', 'Healer PRs may not change assertions, tags or skips:', '',
       ...violations.map((v) => `- \`${v.file}\`: \`${v.line.trim()}\``)].join('\n')
    : '## Assertion guard: passed\n\nNo assertion, tag or skip changes.';
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  process.exit(violations.length ? 1 : 0);
}
