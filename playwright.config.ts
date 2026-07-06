import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

export const E2E_PORT = 3199
// localhost, not 127.0.0.1: the production server sets Secure session
// cookies, and Chromium's trustworthy-origin exemption for Secure cookies
// over plain HTTP applies dependably to localhost only.
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
export const E2E_TEST_DATA_DIR = path.join(
  import.meta.dirname,
  'e2e',
  '.test-data'
)

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : [['list']],
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  // The production server, not `pnpm dev`: Next allows only one dev server
  // per project directory, so E2E must not collide with a developer's own
  // dev session — and testing the built app is more faithful anyway.
  // Run `pnpm build` before `pnpm test:e2e`. The start script also wipes
  // the isolated test database before the server boots.
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: `${E2E_BASE_URL}/api/health`,
    // Never reuse: global setup wipes the test database, so pairing it with
    // an already-running server leaves that server reading a deleted file.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(E2E_PORT),
      TOOL_DATABASE_PATH: path.join(E2E_TEST_DATA_DIR, 'tool.sqlite'),
      TOOL_MCP_ENABLED: 'true',
      TOOL_PAGE_SESSION_SECRET: 'e2e-only-session-secret-not-for-production',
      // The production default (240 msgs/min) disconnects clients during
      // ordinary editing: measured ~3 websocket messages per keystroke and
      // ~4 per drag pointermove (see ideas.md, collaboration message
      // coalescing). Raised here so golden paths test sync correctness;
      // rate-limit behavior itself is covered by unit tests.
      TOOL_COLLABORATION_MESSAGE_RATE_LIMIT_MAX: '100000',
    },
  },
})
