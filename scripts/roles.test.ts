import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requiredRoles, type Roles } from './approvals';

const roles = JSON.parse(readFileSync('roles.json', 'utf8')) as Roles;

test('framework config files need the AI QE Lead', () => {
  for (const file of ['package.json', 'package-lock.json', 'playwright.config.ts', 'stryker.config.json',
    'tsconfig.json', 'eslint.config.mjs', '.gitattributes', '.mcp.json']) {
    assert.ok(requiredRoles(roles, [file]).includes('ai-qe-lead'), `${file} must need ai-qe-lead`);
  }
});

test('the framework description and decisions log need the AI QE Lead', () => {
  for (const file of ['docs/framework.md', 'docs/decisions.md']) {
    assert.ok(requiredRoles(roles, [file]).includes('ai-qe-lead'), `${file} must need ai-qe-lead`);
  }
});
