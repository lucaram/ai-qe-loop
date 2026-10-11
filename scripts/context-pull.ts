import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONTEXT_DIR, SOURCE_DIR } from './config';
import { isMain } from './cli';

export interface ManifestEntry { path: string; sha256: string }
export interface Manifest { pulled_at: string; files: ManifestEntry[] }

const MANIFEST = 'manifest.json';
const toLf = (text: string) => text.replace(/\r\n/g, '\n');

export function hashContent(text: string): string {
  return createHash('sha256').update(toLf(text)).digest('hex');
}

export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

function sameFiles(a: ManifestEntry[], b: ManifestEntry[]): boolean {
  return a.length === b.length && a.every((entry, i) => entry.path === b[i].path && entry.sha256 === b[i].sha256);
}

// True when context/ holds exactly the manifest's files with the manifest's hashes (catches hand edits).
function contextMatches(contextDir: string, entries: ManifestEntry[]): boolean {
  const present = listFiles(contextDir).filter((f) => f !== MANIFEST);
  return present.length === entries.length && entries.every((e) =>
    existsSync(path.join(contextDir, e.path)) && hashContent(readFileSync(path.join(contextDir, e.path), 'utf8')) === e.sha256);
}

export function pullContext(sourceDir: string, contextDir: string, now: Date): { changed: boolean; manifest: Manifest } {
  const files = listFiles(sourceDir).map((rel) => ({
    rel,
    text: readFileSync(path.join(sourceDir, rel), 'utf8'),
  }));
  const entries: ManifestEntry[] = files.map(({ rel, text }) => ({ path: rel, sha256: hashContent(text) }));

  const manifestPath = path.join(contextDir, MANIFEST);
  if (existsSync(manifestPath)) {
    const previous = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
    if (sameFiles(previous.files, entries) && contextMatches(contextDir, entries)) return { changed: false, manifest: previous };
  }

  rmSync(contextDir, { recursive: true, force: true });
  for (const { rel, text } of files) {
    const target = path.join(contextDir, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, toLf(text));
  }
  const manifest: Manifest = { pulled_at: now.toISOString(), files: entries };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { changed: true, manifest };
}

if (isMain(import.meta.url)) {
  const { changed, manifest } = pullContext(SOURCE_DIR, CONTEXT_DIR, new Date());
  console.log(changed
    ? `Context updated: ${manifest.files.length} files pinned at ${manifest.pulled_at}.`
    : `Context unchanged since ${manifest.pulled_at}.`);
}
