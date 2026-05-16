import type { Game } from './Game.js';
import type { LevelState } from './LevelState.js';
import type { WaveSystem } from '../systems/WaveSystem.js';
import type { RunManager } from '../unit-system/RunManager.js';
import { RunPhase } from '../unit-system/RunManager.js';

export interface RunSceneContainers {
  readonly mainMenu: { visible: boolean };
  readonly battle: { visible: boolean };
  readonly interLevel: { visible: boolean };
  readonly runResult: { visible: boolean };
}

export interface RunControllerConfig {
  readonly game: Game;
  readonly runManager: RunManager;
  readonly scenes: RunSceneContainers;
  readonly waveSystem?: WaveSystem;
  readonly levelState?: LevelState;
}

/**
 * RunController — Wave 6 协调器。
 *
 * 职责（独占）：
 *   1. 按 RunManager.phase 切换 4 个 UI 容器的 visible
 *   2. 仅在 Battle 相位调 game.tick(dt)（其他相位 game 暂停）
 *   3. 暴露高层动作 startRun / completeCurrentLevel / pickInterLevel /
 *      failCurrentRun / returnToMainMenu，调用方（UI 按钮 / 系统）只调这些
 *
 * 不做：
 *   - 不持 ECS 逻辑（归 Game.pipeline）
 *   - 不持状态机转移规则（归 RunManager）
 *   - 不直接绘 UI（HUD/HandPanel 归 UISystem，按钮归各 Panel 纯函数）
 *
 * 与 main.ts 的边界：main.ts 实例化 Renderer + Game + RunManager +
 * RunController + 4 个 PIXI.Container；ticker 改驱 runController.tick(dt)。
 */
export class RunController {
  private readonly game: Game;
  private readonly runManager: RunManager;
  private readonly scenes: RunSceneContainers;
  private readonly waveSystem: WaveSystem | undefined;
  private readonly levelState: LevelState | undefined;

  constructor(config: RunControllerConfig) {
    this.game = config.game;
    this.runManager = config.runManager;
    this.scenes = config.scenes;
    this.waveSystem = config.waveSystem;
    this.levelState = config.levelState;
    this.syncSceneVisibility();
  }

  get phase(): RunPhase {
    return this.runManager.phase;
  }

  tick(dt: number): void {
    if (this.runManager.phase === RunPhase.Battle) {
      this.game.tick(dt);
      this.syncLevelStateFromWaveSystem();
    }
  }

  startRun(): void {
    this.runManager.startRun();
    this.syncSceneVisibility();
  }

  completeCurrentLevel(): void {
    this.runManager.completeLevel();
    if (this.levelState) {
      this.levelState.phase = 'victory';
    }
    this.syncSceneVisibility();
  }

  pickInterLevel(choice: 'shop' | 'mystic' | 'skip'): void {
    this.runManager.pickInterLevelChoice(choice);
    this.syncSceneVisibility();
  }

  failCurrentRun(): void {
    this.runManager.failRun();
    if (this.levelState) {
      this.levelState.phase = 'defeat';
    }
    this.syncSceneVisibility();
  }

  returnToMainMenu(): void {
    this.runManager.resetToIdle();
    this.syncSceneVisibility();
  }

  private syncLevelStateFromWaveSystem(): void {
    if (!this.waveSystem || !this.levelState) return;
    this.levelState.waveIndex = this.waveSystem.currentWaveIndex;
    const wp = this.waveSystem.currentPhase;
    this.levelState.phase = wp === 'completed' ? 'victory' : wp;
  }

  private syncSceneVisibility(): void {
    const p = this.runManager.phase;
    this.scenes.mainMenu.visible = p === RunPhase.Idle;
    this.scenes.battle.visible = p === RunPhase.Battle;
    this.scenes.interLevel.visible = p === RunPhase.InterLevel;
    this.scenes.runResult.visible = p === RunPhase.Result;
  }
}
