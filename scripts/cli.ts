import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isMain(importMetaUrl: string): boolean {
  return !!process.argv[1] && path.resolve(fileURLToPath(importMetaUrl)) === path.resolve(process.argv[1]);
}
