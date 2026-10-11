import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashContent, listFiles, pullContext } from './context-pull';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ctx-'));
  const source = path.join(root, 'external');
  mkdirSync(path.join(source, 'budiness-rule'), { recursive: true });
  writeFileSync(path.join(source, 'budiness-rule', 'BR-001.txt'), '## BR-001: Rule\r\nline two\r\n');
  return { source, context: path.join(root, 'context') };
}

test('CRLF and LF content hash the same', () => {
  assert.equal(hashContent('a\r\nb\r\n'), hashContent('a\nb\n'));
});

test('listFiles returns sorted posix paths', () => {
  const { source } = fixture();
  writeFileSync(path.join(source, 'a.txt'), 'x');
  assert.deepEqual(listFiles(source), ['a.txt', 'budiness-rule/BR-001.txt']);
});

test('first pull copies files with LF endings and writes a manifest', () => {
  const { source, context } = fixture();
  const result = pullContext(source, context, new Date('2026-10-10T10:00:00Z'));
  assert.equal(result.changed, true);
  assert.equal(readFileSync(path.join(context, 'budiness-rule', 'BR-001.txt'), 'utf8'), '## BR-001: Rule\nline two\n');
  const manifest = JSON.parse(readFileSync(path.join(context, 'manifest.json'), 'utf8'));
  assert.equal(manifest.pulled_at, '2026-10-10T10:00:00.000Z');
  assert.deepEqual(manifest.files.map((f: { path: string }) => f.path), ['budiness-rule/BR-001.txt']);
});

test('pulling unchanged sources keeps the old manifest and pulled_at', () => {
  const { source, context } = fixture();
  pullContext(source, context, new Date('2026-10-10T10:00:00Z'));
  const second = pullContext(source, context, new Date('2026-10-11T10:00:00Z'));
  assert.equal(second.changed, false);
  assert.equal(second.manifest.pulled_at, '2026-10-10T10:00:00.000Z');
});

test('a changed source is detected and removed files disappear from context', () => {
  const { source, context } = fixture();
  writeFileSync(path.join(source, 'old.txt'), 'old');
  pullContext(source, context, new Date('2026-10-10T10:00:00Z'));
  writeFileSync(path.join(source, 'budiness-rule', 'BR-001.txt'), '## BR-001: Changed\n');
  rmSync(path.join(source, 'old.txt'));
  const result = pullContext(source, context, new Date('2026-10-11T10:00:00Z'));
  assert.equal(result.changed, true);
  assert.equal(existsSync(path.join(context, 'old.txt')), false);
});

test('a hand edit to context/ is detected and overwritten from the source', () => {
  const { source, context } = fixture();
  pullContext(source, context, new Date('2026-10-10T10:00:00Z'));
  writeFileSync(path.join(context, 'budiness-rule', 'BR-001.txt'), 'edited by hand\n');
  const result = pullContext(source, context, new Date('2026-10-11T10:00:00Z'));
  assert.equal(result.changed, true);
  assert.equal(readFileSync(path.join(context, 'budiness-rule', 'BR-001.txt'), 'utf8'), '## BR-001: Rule\nline two\n');
});
