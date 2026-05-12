import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 *
 * 测试目录：e2e/
 * - 避开 src/（vitest 单元测试）与 tests/（历史目录）
 *
 * 运行方式：
 *   npm run test:e2e            # 无头模式运行所有 E2E
 *   npm run test:e2e:headed     # 有头模式（可见浏览器）
 *   npm run test:e2e:ui         # Playwright UI 模式（交互式调试）
 *
 * webServer 自动启动 Vite dev server（端口 3000），测试结束后关闭。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000/ai-tower-defender/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/ai-tower-defender/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
