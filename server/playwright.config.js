import {
  defineConfig,
  devices,
} from '@playwright/test'
import { fileURLToPath } from 'node:url'

const baseURL =
  'http://127.0.0.1:4173'
const projectRoot = fileURLToPath(
  new URL('..', import.meta.url),
)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list']],
  outputDir:
    '../test-results/playwright',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    channel:
      process.env.PLAYWRIGHT_BROWSER_CHANNEL ??
      'chrome',
    headless:
      process.env.PLAYWRIGHT_HEADED !== '1',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    cwd: projectRoot,
    command:
      'npm run dev --workspace client -- --host 127.0.0.1 --port 4173',
    url: baseURL,
    reuseExistingServer:
      process.env.CI !== 'true',
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
