import { DebugPanel, type DebugAction } from './DebugPanel.js';
import { BehaviorTreeWindow } from './BehaviorTreeWindow.js';
import type { BehaviorTreeDebugState, BTNodeDebugInfo } from './types.js';
import type { TowerWorld } from '../core/World.js';
import type { EntityId } from '../types/index.js';
import { CType } from '../types/index.js';
import type { AI } from '../components/AI.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { Unit } from '../components/Unit.js';
import type { Tower } from '../components/Tower.js';
import type { Enemy } from '../components/Enemy.js';
import type { BehaviorTreeConfig, BTNodeConfig } from '../types/index.js';
import type { EconomySystem } from '../systems/EconomySystem.js';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';

export interface DebugManagerHooks {
  getEconomy?: () => EconomySystem | null;
  onLevelProgressChanged?: () => void;
  onOpenLevelEditor?: () => void;
}

const GOLD_BONUS = 99999;
const FULL_STARS = 3;

export class DebugManager {
  private world: TowerWorld;
  private debugPanel: DebugPanel;
  private behaviorTreeWindow: BehaviorTreeWindow;

  private selectedEntityId: EntityId | null = null;
  private aiConfigs: Map<string, BehaviorTreeConfig> = new Map();

  private getEconomyFn: (() => EconomySystem | null) | null = null;
  private onLevelProgressChangedFn: (() => void) | null = null;
  private onOpenLevelEditorFn: (() => void) | null = null;

  constructor(world: TowerWorld, hooks: DebugManagerHooks = {}) {
    this.world = world;
    this.getEconomyFn = hooks.getEconomy ?? null;
    this.onLevelProgressChangedFn = hooks.onLevelProgressChanged ?? null;
    this.onOpenLevelEditorFn = hooks.onOpenLevelEditor ?? null;

    this.behaviorTreeWindow = new BehaviorTreeWindow();
    this.debugPanel = new DebugPanel(this.buildActions());
    this.setupKeyboardShortcuts();
  }

  getActions(): DebugAction[] {
    return this.buildActions();
  }

  setEconomyProvider(provider: () => EconomySystem | null): void {
    this.getEconomyFn = provider;
    this.debugPanel.refresh();
  }

  setOnLevelProgressChanged(cb: () => void): void {
    this.onLevelProgressChangedFn = cb;
  }

  registerAIConfigs(configs: BehaviorTreeConfig[]): void {
    for (const config of configs) {
      this.aiConfigs.set(config.id, config);
    }
  }

  private buildActions(): DebugAction[] {
    const actions: DebugAction[] = [
      {
        id: 'complete_all_levels',
        label: '一键通关（全部 3 星）',
        icon: '🏆',
        isEnabled: () => true,
        onClick: () => this.completeAllLevels(),
      },
      {
        id: 'add_gold',
        label: `金币 +${GOLD_BONUS}`,
        icon: '💰',
        isEnabled: () => this.getEconomy() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.addDebugGold(),
      },
      {
        id: 'view_behavior_tree',
        label: '查看行为树',
        icon: '🌳',
        isEnabled: () => true,
        onClick: () => this.openBehaviorTreeWindow(),
      },
    ];
    if (this.onOpenLevelEditorFn) {
      const openEditor = this.onOpenLevelEditorFn;
      actions.push({
        id: 'open_level_editor',
        label: '关卡编辑器 (F2)',
        icon: '🛠️',
        isEnabled: () => true,
        onClick: () => openEditor(),
      });
    }
    return actions;
  }

  private getEconomy(): EconomySystem | null {
    return this.getEconomyFn ? this.getEconomyFn() : null;
  }

  completeAllLevels(): { stars: number; unlocked: number } {
    for (let i = 1; i <= LEVELS.length; i++) {
      SaveManager.setStars(i, FULL_STARS);
    }
    SaveManager.unlockLevel(LEVELS.length);
    this.onLevelProgressChangedFn?.();
    this.debugPanel.flashButton('complete_all_levels', `✅ 已通关 ${LEVELS.length} 关 · 全部 3 星`);
    return { stars: FULL_STARS, unlocked: LEVELS.length };
  }

  addDebugGold(): boolean {
    const economy = this.getEconomy();
    if (!economy) return false;
    economy.addGold(GOLD_BONUS);
    this.debugPanel.flashButton('add_gold', `✅ 金币 +${GOLD_BONUS} 已发放`);
    return true;
  }

  private openBehaviorTreeWindow(): void {
    const state = this.buildCurrentBehaviorTreeState();
    this.behaviorTreeWindow.show(state);
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        e.preventDefault();
        this.debugPanel.toggle();
      } else if (e.key === 'Escape') {
        if (this.behaviorTreeWindow.getIsOpen()) {
          this.behaviorTreeWindow.hide();
        } else if (this.debugPanel.getIsExpanded()) {
          this.debugPanel.collapse();
        }
      }
    });
  }

  selectEntity(entityId: EntityId | null): void {
    this.selectedEntityId = entityId;
    if (this.behaviorTreeWindow.getIsOpen()) {
      this.behaviorTreeWindow.updateState(this.buildCurrentBehaviorTreeState());
    }
  }

  update(): void {
    this.debugPanel.refresh();
    if (this.selectedEntityId !== null && this.behaviorTreeWindow.getIsOpen()) {
      this.behaviorTreeWindow.updateState(this.buildCurrentBehaviorTreeState());
    }
  }

  private buildCurrentBehaviorTreeState(): BehaviorTreeDebugState | null {
    if (this.selectedEntityId === null) return null;
    const ai = this.world.getComponent<AI>(this.selectedEntityId, CType.AI);
    if (!ai) return null;

    const unitName = this.getEntityDisplayName(this.selectedEntityId);
    const aiConfig = this.aiConfigs.get(ai.configId) ?? null;

    return {
      entityId: this.selectedEntityId,
      unitName,
      aiConfigId: ai.configId,
      root: aiConfig ? this.buildBehaviorTreeDebugInfo(aiConfig.root, ai) : null,
      blackboard: Object.fromEntries(ai.blackboard),
      currentState: ai.state,
      targetId: ai.targetId,
      lastUpdateTime: ai.lastUpdateTime,
    };
  }

  private getEntityDisplayName(entityId: EntityId): string {
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    if (unitTag) return unitTag.unitConfigId;
    const tower = this.world.getComponent<Tower>(entityId, CType.Tower);
    if (tower) return `Tower_${tower.towerType}`;
    const enemy = this.world.getComponent<Enemy>(entityId, CType.Enemy);
    if (enemy) return `Enemy_${enemy.enemyType}`;
    const unit = this.world.getComponent<Unit>(entityId, CType.Unit);
    if (unit) return `Unit_${unit.unitType}`;
    return '未知单位';
  }

  private buildBehaviorTreeDebugInfo(nodeConfig: BTNodeConfig, ai: AI): BTNodeDebugInfo {
    const nodeId = `node_${Math.random().toString(36).substr(2, 9)}`;
    const status: BTNodeDebugInfo['status'] = ai.state === nodeConfig.type ? 'running' : 'idle';

    const result: BTNodeDebugInfo = {
      id: nodeId,
      name: nodeConfig.name || this.getNodeDisplayName(nodeConfig.type),
      type: nodeConfig.type,
      status,
      params: nodeConfig.params,
    };

    if (nodeConfig.children) {
      result.children = nodeConfig.children.map((child) =>
        this.buildBehaviorTreeDebugInfo(child, ai),
      );
    }
    return result;
  }

  private getNodeDisplayName(type: string): string {
    const displayNames: Record<string, string> = {
      sequence: '顺序节点',
      selector: '选择节点',
      parallel: '并行节点',
      inverter: '反转节点',
      repeater: '重复节点',
      until_fail: '直到失败',
      always_succeed: '总是成功',
      cooldown: '冷却节点',
      check_hp: '检查血量',
      check_enemy_in_range: '检查范围内敌人',
      check_ally_in_range: '检查范围内友军',
      check_buff: '检查Buff',
      check_cooldown: '检查冷却',
      check_phase: '检查阶段',
      check_target_alive: '检查目标存活',
      check_distance_to_target: '检查与目标距离',
      check_moving: '检查移动中',
      check_stunned: '检查眩晕',
      check_player_control: '检查玩家控制',
      attack: '攻击',
      move_to: '移动到',
      move_towards: '向目标移动',
      flee: '逃跑',
      use_skill: '使用技能',
      wait: '等待',
      spawn: '生成单位',
      patrol: '巡逻',
      set_target: '设置目标',
      clear_target: '清除目标',
      play_animation: '播放动画',
    };
    return displayNames[type] || type;
  }

  destroy(): void {
    this.debugPanel.destroy();
    this.behaviorTreeWindow.destroy();
  }
}
