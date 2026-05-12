import { test, expect } from '@playwright/test';

/**
 * 回归保护 E2E：三个验收 bug
 *
 * Bug #1: 塔安放后不攻击（aiConfigs 缺 set_target: true）
 * Bug #2: 基地受击导致所有塔掉血（baseQuery 过宽）
 * Bug #3: 选中塔 tips 没有升级按钮
 *
 * 验证手段：
 * - 通过 window.game 暴露的运行时对象直接探测 ECS 状态与 UI 按钮
 * - 通过 LevelSelectUI 点击进入战斗（设计坐标 1920×1080，与 client 1:1）
 */

const LEVEL_1_DESIGN_CENTER = { x: 500, y: 300 };

async function enterBattle(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { game?: { currentScreen?: string } }).game?.currentScreen === 'level_select', { timeout: 10_000 });
  await page.evaluate(({ x, y }) => {
    const g = (window as unknown as { game: { levelSelectUI: { handleClick: (x: number, y: number) => boolean } } }).game;
    g.levelSelectUI.handleClick(x, y);
  }, LEVEL_1_DESIGN_CENTER);
  await page.waitForFunction(() => (window as unknown as { game?: { currentScreen?: string } }).game?.currentScreen === 'battle', { timeout: 10_000 });
}

async function placeAnyTower(page: import('@playwright/test').Page): Promise<number> {
  return await page.evaluate(async () => {
    const RS = await import('/ai-tower-defender/src/systems/RenderSystem.ts');
    const g = (window as unknown as {
      game: {
        buildSystem: {
          map: { rows: number; cols: number; tileSize: number; tiles: string[][] };
          startDrag: (et: 'tower', opts: { towerType: string }) => void;
          tryDrop: (px: number, py: number) => number | false;
        };
        economy: { gold: number };
      };
    }).game;
    const bs = g.buildSystem;
    const m = bs.map;
    const ts = m.tileSize;

    (g.economy as { gold: number }).gold = 9999;

    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (m.tiles[r]![c] !== 'empty') continue;
        let adjacentPath = false;
        for (let dr = -1; dr <= 1 && !adjacentPath; dr++) {
          for (let dc = -1; dc <= 1 && !adjacentPath; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= m.rows || nc < 0 || nc >= m.cols) continue;
            if (m.tiles[nr]![nc] === 'path') adjacentPath = true;
          }
        }
        if (!adjacentPath) continue;
        const px = c * ts + ts / 2 + (RS as { RenderSystem: { sceneOffsetX: number } }).RenderSystem.sceneOffsetX;
        const py = r * ts + ts / 2 + (RS as { RenderSystem: { sceneOffsetY: number } }).RenderSystem.sceneOffsetY;
        bs.startDrag('tower', { towerType: 'arrow' });
        const eid = bs.tryDrop(px, py);
        if (eid !== false) return eid as number;
      }
    }
    return -1;
  });
}

test.describe('验收 bug 回归保护', () => {
  test('Bug #2: 基地受击不会拖动所有塔的 HP（baseQuery 过宽防御）', async ({ page }) => {
    await enterBattle(page);
    await page.waitForTimeout(300);
    await placeAnyTower(page);
    await page.evaluate(() => {
      const g = (window as unknown as { game: { waveSystem: { startWave: () => void } } }).game;
      g.waveSystem.startWave();
    });

    const baselineSnapshot = await page.evaluate(async () => {
      const comp = await import('/ai-tower-defender/src/core/components.ts');
      const W = await import('/ai-tower-defender/src/core/World.ts');
      const g = (window as unknown as { game: { world: { world: unknown }; baseEntityId: number } }).game;
      const w = g.world.world;

      const baseQ = W.defineQuery([comp.Health, comp.Category]);
      const objectives = baseQ(w).filter((e: number) => comp.Category.value[e] === comp.CategoryVal.Objective);
      const baseId = objectives[0]!;
      const baseHp0 = comp.Health.current[baseId];

      const towerQ = W.defineQuery([comp.Tower, comp.Health]);
      const towers = towerQ(w);
      const towerHpBefore: Record<number, number> = {};
      for (const t of towers) towerHpBefore[t] = comp.Health.current[t]!;

      return { baseId, baseHp0, towerCount: towers.length, towerHpBefore };
    });

    await page.waitForFunction(async (prev) => {
      const comp = await import('/ai-tower-defender/src/core/components.ts');
      return (comp.Health.current[prev.baseId] ?? prev.baseHp0) < prev.baseHp0;
    }, baselineSnapshot, { timeout: 90_000 });

    const synchronizedDamage = await page.evaluate(async (prev: { baseId: number; baseHp0: number; towerHpBefore: Record<number, number> }) => {
      const comp = await import('/ai-tower-defender/src/core/components.ts');
      const W = await import('/ai-tower-defender/src/core/World.ts');
      const g = (window as unknown as { game: { world: { world: unknown } } }).game;
      const w = g.world.world;

      const baseHpAfter = comp.Health.current[prev.baseId];
      const towerQ = W.defineQuery([comp.Tower, comp.Health]);
      const towers = towerQ(w);
      const baseDelta = prev.baseHp0 - baseHpAfter!;
      const allTowersFollowBase = towers.every((t: number) => {
        const before = prev.towerHpBefore[t];
        const after = comp.Health.current[t];
        if (before === undefined || after === undefined) return false;
        return Math.abs((before - after) - baseDelta) < 0.01 && baseDelta > 0;
      });

      return { baseDelta, allTowersFollowBase };
    }, baselineSnapshot);

    expect(synchronizedDamage.allTowersFollowBase && synchronizedDamage.baseDelta > 0, 'Bug #2 回归：所有塔与基地同步扣血').toBe(false);
  });

  test('Bug #3: 选中塔后 UI buttons 包含升级按钮（除满级）', async ({ page }) => {
    await enterBattle(page);
    await page.waitForTimeout(300);
    const towerId = await placeAnyTower(page);
    expect(towerId, '应能成功放置一座塔').toBeGreaterThan(0);

    const selection = await page.evaluate(async (placedId: number) => {
      const comp = await import('/ai-tower-defender/src/core/components.ts');
      const g = (window as unknown as { game: { uiSystem: { selectedEntityId: number | null; selectedEntityType: string | null; enemyEntityId: number | null } } }).game;
      g.uiSystem.selectedEntityId = placedId;
      g.uiSystem.selectedEntityType = 'tower';
      g.uiSystem.enemyEntityId = null;
      return { towerId: placedId, level: comp.Tower.level[placedId] };
    }, towerId);

    await page.waitForTimeout(150);

    const buttonsInfo = await page.evaluate(() => {
      const ui = (window as unknown as { game: { uiSystem: { buttons: Array<{ label?: string; x: number; y: number; w: number; h: number; enabled: boolean }> } } }).game.uiSystem;
      const UPGRADE_LABEL_PATTERN = /^\d+G$/;
      const RECYCLE_LABEL_PATTERN = /^(回收\d+G|建造中|受击中|战斗中|不可回收)$/;
      const upgradeBtns = (ui.buttons || []).filter(b => b.label && UPGRADE_LABEL_PATTERN.test(b.label));
      const recycleBtns = (ui.buttons || []).filter(b => b.label && RECYCLE_LABEL_PATTERN.test(b.label));
      return { upgradeBtnCount: upgradeBtns.length, recycleBtnCount: recycleBtns.length };
    });

    if ((selection.level ?? 1) < 5) {
      expect(buttonsInfo.upgradeBtnCount, '非满级塔应至少有 1 个升级按钮').toBeGreaterThanOrEqual(1);
    }
    expect(buttonsInfo.recycleBtnCount, '选中塔应至少有 1 个回收按钮（含 "建造中"/"受击中"/"战斗中"/"不可回收" 占位）').toBeGreaterThanOrEqual(1);
  });

  test('Bug #1: 范围内有敌人时塔的 Attack.targetId 会被 BT 写入（set_target 生效）', async ({ page }) => {
    await enterBattle(page);
    await page.waitForTimeout(300);
    const towerId = await placeAnyTower(page);
    expect(towerId, '应能成功放置一座塔').toBeGreaterThan(0);

    await page.evaluate(() => {
      const g = (window as unknown as { game: { waveSystem: { startWave: () => void } } }).game;
      g.waveSystem.startWave();
    });

    await page.waitForFunction(async () => {
      const W = await import('/ai-tower-defender/src/core/World.ts');
      const comp = await import('/ai-tower-defender/src/core/components.ts');
      const g = (window as unknown as { game: { world: { world: unknown } } }).game;
      const w = g.world.world;
      const enemies = W.defineQuery([comp.UnitTag, comp.Health])(w).filter((e: number) => comp.UnitTag.isEnemy[e] === 1);
      return enemies.length > 0;
    }, undefined, { timeout: 90_000 });

    await page.waitForTimeout(3000);

    const targetingState = await page.evaluate(async () => {
      const comp = await import('/ai-tower-defender/src/core/components.ts');
      const W = await import('/ai-tower-defender/src/core/World.ts');
      const g = (window as unknown as { game: { world: { world: unknown } } }).game;
      const w = g.world.world;

      const towers = W.defineQuery([comp.Tower, comp.Attack])(w);
      const targetingTowers = towers.filter((t: number) => {
        const tid = comp.Attack.targetId[t];
        return tid !== undefined && tid !== 0;
      });

      return { towerCount: towers.length, targetingCount: targetingTowers.length };
    });

    expect(targetingState.towerCount, '应有至少 1 座塔').toBeGreaterThan(0);
    expect(targetingState.targetingCount, '至少 1 座塔应锁定敌人（Attack.targetId !== 0）— set_target: true 已生效').toBeGreaterThan(0);
  });
});
