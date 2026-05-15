import { Container } from 'pixi.js';

import { Game } from './core/Game.js';
import { Renderer } from './render/Renderer.js';
import { RunController } from './core/RunController.js';
import { RunManager, RunPhase } from './unit-system/RunManager.js';
import { UIPresenter } from './ui/UIPresenter.js';
import { createAttackSystem } from './systems/AttackSystem.js';
import { createCrystalSystem } from './systems/CrystalSystem.js';
import { createHealthSystem } from './systems/HealthSystem.js';
import { createLifecycleSystem } from './systems/LifecycleSystem.js';
import { createMovementSystem, type PathPoint } from './systems/MovementSystem.js';
import type { RunState } from './ui/HUD.js';
import type { HandState } from './ui/HandPanel.js';

const GRID_COLS = 21;
const GRID_ROWS = 9;
const CELL_SIZE = 64;
const VIEWPORT_WIDTH = GRID_COLS * CELL_SIZE;
const VIEWPORT_HEIGHT = GRID_ROWS * CELL_SIZE;

const DEFAULT_PATH: readonly PathPoint[] = [
  { x: 0, y: VIEWPORT_HEIGHT / 2 },
  { x: VIEWPORT_WIDTH, y: VIEWPORT_HEIGHT / 2 },
];

/**
 * W6.4 wire — 把 Wave 6 三件套（RunManager + RunController + UIPresenter）
 * 连同 MVP 6-system Pipeline 装入应用入口。
 *
 * 取舍（W6.7 收尾记入 §0 追溯表）：
 *   - S20：main.ts 不接 HandSystem/DeckSystem/EnergySystem、不连 UI 点击，
 *          推迟到 Wave 7+（演示路径 + 输入连线）
 *   - S21：HUD.phase 字段 MVP 写死 'battle'（RunManager.phase 是 Run-level
 *          四相位，HUD.phase 是单关 deployment/battle/...，语义不同）
 *   - S22：HandState 投空集合，HandPanel 渲染 0 个槽不影响视觉
 *   - S23：drop_gold ruleHandler 未注册（main.ts 暂不连 EconomySystem），
 *          MVP 战场死敌不掉金；单测里的 economy 整合保留，前端展示推迟
 */
async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found in index.html');
  }

  const renderer = new Renderer({
    canvas,
    worldWidth: VIEWPORT_WIDTH,
    worldHeight: VIEWPORT_HEIGHT,
    cellSize: CELL_SIZE,
  });
  await renderer.init();

  const mainMenuContainer = new Container();
  const battleContainer = new Container();
  const interLevelContainer = new Container();
  const runResultContainer = new Container();
  renderer.uiLayer.addChild(
    mainMenuContainer,
    battleContainer,
    interLevelContainer,
    runResultContainer,
  );

  const game = new Game();
  game.pipeline.register(createMovementSystem({ path: DEFAULT_PATH }));
  game.pipeline.register(createAttackSystem());
  game.pipeline.register(createCrystalSystem());
  game.pipeline.register(createHealthSystem());
  game.pipeline.register(createLifecycleSystem());

  const runManager = new RunManager({ totalLevels: 1 });

  const runController = new RunController({
    game,
    runManager,
    scenes: {
      mainMenu: mainMenuContainer,
      battle: battleContainer,
      interLevel: interLevelContainer,
      runResult: runResultContainer,
    },
  });

  const presenter = new UIPresenter({
    battleContainer,
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
  });

  let lastTime = performance.now();
  renderer.app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt <= 0) return;

    runController.tick(dt);

    if (runManager.phase === RunPhase.Battle) {
      presenter.present(projectUIFrame(runManager));
    }
  });
}

/**
 * 把 RunManager 的 Run-level 状态投影成 HUD/HandPanel 需要的视图模型。
 * MVP 阶段：HUD.phase 写死 'battle'，wave 信息写死 1/1，hand 给空集合。
 */
function projectUIFrame(run: RunManager): { run: RunState; hand: HandState } {
  return {
    run: {
      gold: run.gold,
      crystalHp: run.crystalHp,
      crystalHpMax: run.crystalHpMax,
      waveIndex: 1,
      waveTotal: 1,
      phase: 'battle',
    },
    hand: {
      cards: [],
      energy: 0,
    },
  };
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
});
