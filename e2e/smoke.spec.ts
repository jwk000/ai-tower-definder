import { test, expect } from '@playwright/test';

/**
 * 冒烟测试：验证游戏能正常加载
 *
 * 用途：
 * - 确认 Playwright 安装正常
 * - 作为后续 E2E 测试的最小模板
 */
test('游戏页面可正常加载', async ({ page }) => {
  await page.goto('/');

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
});
