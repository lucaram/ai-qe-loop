import { defineConfig, devices } from '@playwright/test';

// The Playwright MCP server (agents) sets PW_PORT=3100 in .mcp.json, so its app never
// blocks `npm test` or Stryker, which use the default 3000.
const port = Number(process.env.PW_PORT ?? 3000);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx app/src/main.ts',
    url: `http://localhost:${port}/health`,
    // Never reuse: Stryker must start a fresh server per mutant.
    reuseExistingServer: false,
    env: { TEST_HOOKS: '1', PORT: String(port) },
  },
});
