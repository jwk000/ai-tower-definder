import { CType, UnitLayer, type UnitCategory } from '../types/index.js';

/**
 * UnitTag - 统一单位标记组件
 * 
 * 所有游戏实体（塔、敌人、士兵、建筑、陷阱等）都使用此组件
 * 作为统一的单位标识和分类。
 */
export class UnitTag {
  readonly type = CType.UnitTag;
  
  /** 单位配置ID */
  unitConfigId: string;
  
  /** 单位分类 */
  category: UnitCategory;
  
  /** 单位层级（垂直位置） */
  layer: UnitLayer;
  
  /** 当前等级 */
  level: number;
  
  /** 最大等级 */
  maxLevel: number;
  
  /** 是否存活（区别于销毁） */
  alive: boolean;
  
  /** 创建时间戳 */
  createdAt: number;

  constructor(
    unitConfigId: string,
    category: UnitCategory,
    level: number = 1,
    maxLevel: number = 5,
    layer: UnitLayer = UnitLayer.Ground
  ) {
    this.unitConfigId = unitConfigId;
    this.category = category;
    this.layer = layer;
    this.level = level;
    this.maxLevel = maxLevel;
    this.alive = true;
    this.createdAt = Date.now();
  }

  /** 升级 */
  upgrade(): boolean {
    if (this.level < this.maxLevel) {
      this.level++;
      return true;
    }
    return false;
  }

  /** 降级 */
  downgrade(): boolean {
    if (this.level > 1) {
      this.level--;
      return true;
    }
    return false;
  }

  /** 标记为死亡 */
  markDead(): void {
    this.alive = false;
  }

  /** 标记为销毁（不触发死亡效果） */
  markDestroyed(): void {
    this.alive = false;
  }

  /** 切换层级 */
  changeLayer(newLayer: UnitLayer): void {
    this.layer = newLayer;
  }

  /** 检查是否可以攻击目标层级 */
  canAttackLayer(targetLayer: UnitLayer): boolean {
    const rules = LAYER_INTERACTION_RULES[this.layer];
    if (!rules) return false;
    return rules.canAttack.includes(targetLayer);
  }

  /** 检查是否可以被目标层级攻击 */
  canBeAttackedByLayer(attackerLayer: UnitLayer): boolean {
    const rules = LAYER_INTERACTION_RULES[this.layer];
    if (!rules) return false;
    return rules.canBeAttackedBy.includes(attackerLayer);
  }

  /** 检查是否与目标层级有碰撞 */
  collidesWithLayer(targetLayer: UnitLayer): boolean {
    const rules = LAYER_INTERACTION_RULES[this.layer];
    if (!rules) return false;
    return rules.collidesWith.includes(targetLayer);
  }
}

/** 默认层级交互规则 */
export const LAYER_INTERACTION_RULES: Record<UnitLayer, {
  canBeAttackedBy: UnitLayer[];
  canAttack: UnitLayer[];
  collidesWith: UnitLayer[];
}> = {
  [UnitLayer.Abyss]: {
    canBeAttackedBy: [],  // 深渊层不可被攻击
    canAttack: [],        // 深渊层不能攻击
    collidesWith: [],     // 深渊层无碰撞
  },
  [UnitLayer.BelowGrid]: {
    canBeAttackedBy: [],  // 默认不可被攻击（需要解除封印）
    canAttack: [],        // 默认不能攻击
    collidesWith: [UnitLayer.BelowGrid],  // 仅与同层碰撞
  },
  [UnitLayer.AboveGrid]: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir],  // 可被地面和低空攻击
    canAttack: [UnitLayer.Ground, UnitLayer.AboveGrid],     // 可攻击地面和同层
    collidesWith: [UnitLayer.AboveGrid],                    // 仅与同层碰撞
  },
  [UnitLayer.Ground]: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir, UnitLayer.AboveGrid],  // 可被地面、低空、地格上层攻击
    canAttack: [UnitLayer.Ground, UnitLayer.AboveGrid, UnitLayer.LowAir],        // 可攻击地面、地格上层、低空
    collidesWith: [UnitLayer.Ground],                                            // 仅与同层碰撞
  },
  [UnitLayer.LowAir]: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir],  // 可被地面和低空攻击
    canAttack: [UnitLayer.Ground, UnitLayer.LowAir, UnitLayer.AboveGrid],  // 可攻击地面、低空、地格上层
    collidesWith: [UnitLayer.LowAir],                                      // 仅与同层碰撞
  },
  [UnitLayer.Space]: {
    canBeAttackedBy: [],  // 太空层不可被攻击
    canAttack: [],        // 太空层不能攻击
    collidesWith: [],     // 太空层无碰撞
  },
};
