import type { TowerWorld } from '../core/World.js';
import {
  Position,
  Health,
  Faction,
  Layer,
  Category,
  Visual,
  Attack,
  Movement,
  Tower,
  Production,
  Trap,
  Skill,
  UnitTag,
  Boss,
  Stunned,
  Frozen,
  Slowed,
  Taunted,
  BuildingTower,
  PlayerOwned,
  PlayerControllable,
  BuffContainer,
  FactionVal,
  LayerVal,
  CategoryVal,
} from '../core/components.js';
import {
  TOWER_CONFIGS,
  UNIT_CONFIGS,
  ENEMY_CONFIGS,
  PRODUCTION_CONFIGS,
  SKILL_CONFIGS,
  UNIT_TYPE_BY_ID,
} from '../data/gameData.js';
import { TowerType, EnemyType, UnitType, ProductionType } from '../types/index.js';
import { hasComponent, entityExists } from 'bitecs';
import { getBuffs, type BuffData } from '../systems/BuffSystem.js';

type LabeledValue = { label: string; value: string };
type Section = { title: string; rows: LabeledValue[] };

export interface InspectorState {
  entityId: number;
  displayName: string;
  sections: Section[];
}

const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,
  TowerType.Cannon,
  TowerType.Ice,
  TowerType.Lightning,
  TowerType.Laser,
  TowerType.Bat,
  TowerType.Missile,
  TowerType.Vine,
  TowerType.Command,
  TowerType.Ballista,
];

const FACTION_LABEL: Record<number, string> = {
  [FactionVal.Player]: 'Player（玩家）',
  [FactionVal.Enemy]: 'Enemy（敌方）',
  [FactionVal.Neutral]: 'Neutral（中立）',
};

const LAYER_LABEL: Record<number, string> = {
  [LayerVal.Abyss]: 'Abyss（深渊）',
  [LayerVal.BelowGrid]: 'BelowGrid（地下）',
  [LayerVal.AboveGrid]: 'AboveGrid（地表）',
  [LayerVal.Ground]: 'Ground（地面）',
  [LayerVal.LowAir]: 'LowAir（低空）',
  [LayerVal.Space]: 'Space（高空）',
};

const CATEGORY_LABEL: Record<number, string> = {
  [CategoryVal.Tower]: 'Tower（防御塔）',
  [CategoryVal.Soldier]: 'Soldier（士兵）',
  [CategoryVal.Enemy]: 'Enemy（敌人）',
  [CategoryVal.Building]: 'Building（建筑）',
  [CategoryVal.Trap]: 'Trap（陷阱）',
  [CategoryVal.Neutral]: 'Neutral（中立）',
  [CategoryVal.Objective]: 'Objective（目标）',
  [CategoryVal.Effect]: 'Effect（特效）',
};

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.abs(n) >= 100 ? Math.round(n) : parseFloat(n.toFixed(digits));
  return String(rounded);
}

function maybeRow(label: string, value: string | number | undefined, formatter?: (n: number) => string): LabeledValue | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return { label, value: formatter ? formatter(value) : fmt(value) };
  }
  if (value === '') return null;
  return { label, value };
}

function pushRow(rows: LabeledValue[], row: LabeledValue | null): void {
  if (row) rows.push(row);
}

function resolveUnitMeta(eid: number): { name: string; description?: string; skillId?: string } | null {
  const typeIdx = UnitTag.unitTypeNum[eid];
  if (typeIdx === undefined) return null;
  const unitType = UNIT_TYPE_BY_ID[typeIdx];
  if (!unitType) return null;
  const cfg = UNIT_CONFIGS[unitType];
  if (!cfg) return null;
  return { name: cfg.name, skillId: cfg.skillId };
}

function resolveTowerMeta(eid: number): { name: string; description?: string } | null {
  const towerTypeVal = Tower.towerType[eid];
  if (towerTypeVal === undefined) return null;
  const towerType = TOWER_TYPE_BY_ID[towerTypeVal];
  if (!towerType) return null;
  const cfg = TOWER_CONFIGS[towerType];
  if (!cfg) return null;
  return { name: cfg.name };
}

function resolveEnemyMeta(displayName: string | undefined): { name: string; description?: string } | null {
  if (!displayName) return null;
  for (const cfg of Object.values(ENEMY_CONFIGS)) {
    if (cfg.name === displayName) {
      return { name: cfg.name, description: cfg.description };
    }
  }
  return null;
}

function resolveProductionMeta(eid: number): { name: string } | null {
  const resourceType = Production.resourceType[eid];
  if (resourceType === undefined) return null;
  const type = resourceType === 0 ? ProductionType.GoldMine : ProductionType.EnergyTower;
  const cfg = PRODUCTION_CONFIGS[type];
  if (!cfg) return null;
  return { name: cfg.name };
}

export function buildInspectorState(world: TowerWorld, eid: number | null): InspectorState | null {
  if (eid === null) return null;
  if (!entityExists(world.world, eid)) return null;
  if (!hasComponent(world.world, Position, eid)) return null;

  const w = world.world;
  const sections: Section[] = [];

  let displayName = world.getDisplayName(eid) ?? '未知实体';
  let description: string | undefined;
  let skillId: string | undefined;

  if (hasComponent(w, Tower, eid)) {
    const meta = resolveTowerMeta(eid);
    if (meta) {
      displayName = meta.name;
      description = meta.description;
    }
  } else if (hasComponent(w, UnitTag, eid) && UnitTag.isEnemy[eid] === 1) {
    const meta = resolveEnemyMeta(world.getDisplayName(eid));
    if (meta) {
      displayName = meta.name;
      description = meta.description;
    }
  } else if (hasComponent(w, UnitTag, eid)) {
    const meta = resolveUnitMeta(eid);
    if (meta) {
      displayName = meta.name;
      description = meta.description;
      skillId = meta.skillId;
    }
  } else if (hasComponent(w, Production, eid)) {
    const meta = resolveProductionMeta(eid);
    if (meta) {
      displayName = meta.name;
    }
  } else if (hasComponent(w, Trap, eid)) {
    displayName = world.getDisplayName(eid) ?? '陷阱';
  }
  const basicRows: LabeledValue[] = [];
  basicRows.push({ label: 'Entity ID', value: String(eid) });
  basicRows.push({ label: '名称', value: displayName });
  if (description) basicRows.push({ label: '描述', value: description });
  pushRow(basicRows, maybeRow('位置', `${fmt(Position.x[eid])}, ${fmt(Position.y[eid])}`));
  if (hasComponent(w, Faction, eid)) {
    const f = Faction.value[eid];
    pushRow(basicRows, maybeRow('阵营', f !== undefined ? FACTION_LABEL[f] ?? `Unknown(${f})` : undefined));
  }
  if (hasComponent(w, Layer, eid)) {
    const l = Layer.value[eid];
    pushRow(basicRows, maybeRow('层级', l !== undefined ? LAYER_LABEL[l] ?? `Unknown(${l})` : undefined));
  }
  if (hasComponent(w, Category, eid)) {
    const c = Category.value[eid];
    pushRow(basicRows, maybeRow('分类', c !== undefined ? CATEGORY_LABEL[c] ?? `Unknown(${c})` : undefined));
  }
  pushRow(basicRows, maybeRow('玩家拥有', hasComponent(w, PlayerOwned, eid) ? '是' : undefined));
  sections.push({ title: '基本信息', rows: basicRows });
  if (hasComponent(w, Health, eid)) {
    const rows: LabeledValue[] = [];
    const cur = Health.current[eid];
    const max = Health.max[eid];
    pushRow(rows, maybeRow('当前血量', cur !== undefined && max !== undefined ? `${Math.ceil(cur)} / ${Math.ceil(max)}` : undefined));
    pushRow(rows, maybeRow('护甲', Health.armor[eid]));
    pushRow(rows, maybeRow('魔抗', Health.magicResist[eid]));
    sections.push({ title: '生命与防御', rows });
  }
  if (hasComponent(w, Attack, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('攻击力', Attack.damage[eid]));
    pushRow(rows, maybeRow('攻击速度', Attack.attackSpeed[eid], (n) => `${fmt(n)} /秒`));
    pushRow(rows, maybeRow('攻击距离', Attack.range[eid], (n) => `${fmt(n)} px`));
    pushRow(rows, maybeRow('警戒距离', Attack.alertRange[eid], (n) => `${fmt(n)} px`));
    pushRow(rows, maybeRow('攻击冷却剩余', Attack.cooldownTimer[eid], (n) => `${fmt(n)} 秒`));
    pushRow(rows, maybeRow('伤害类型', Attack.damageType[eid] !== undefined ? (Attack.damageType[eid] === 0 ? '物理' : '魔法') : undefined));
    pushRow(rows, maybeRow('远程攻击', Attack.isRanged[eid] === 1 ? '是' : '否'));
    pushRow(rows, maybeRow('当前目标', Attack.targetId[eid] && Attack.targetId[eid] !== 0 ? `eid=${Attack.targetId[eid]}` : undefined));
    pushRow(rows, maybeRow('溅射半径', Attack.splashRadius[eid], (n) => n > 0 ? `${fmt(n)} px` : '—'));
    pushRow(rows, maybeRow('弹跳次数', Attack.chainCount[eid], (n) => n > 0 ? String(n) : '—'));
    pushRow(rows, maybeRow('吸血比例', Attack.drainPercent[eid], (n) => n > 0 ? `${fmt(n * 100)}%` : '—'));
    pushRow(rows, maybeRow('嘲讽容量', Attack.tauntCapacity[eid], (n) => n > 0 ? `${n} / 当前 ${Attack.attackerCount[eid] ?? 0}` : '—'));
    if (rows.length > 0) sections.push({ title: '战斗属性', rows });
  }
  if (hasComponent(w, Movement, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('基础移速', Movement.speed[eid], (n) => `${fmt(n)} px/秒`));
    pushRow(rows, maybeRow('当前移速', Movement.currentSpeed[eid], (n) => `${fmt(n)} px/秒`));
    pushRow(rows, maybeRow('移动模式', Movement.moveMode[eid]));
    pushRow(rows, maybeRow('家点', `${fmt(Movement.homeX[eid])}, ${fmt(Movement.homeY[eid])}`));
    pushRow(rows, maybeRow('移动范围', Movement.moveRange[eid], (n) => n > 0 ? `${fmt(n)} px` : '—'));
    pushRow(rows, maybeRow('路径进度', Movement.progress[eid], (n) => `${fmt(n * 100, 1)}%`));
    if (rows.length > 0) sections.push({ title: '移动属性', rows });
  }
  if (hasComponent(w, Tower, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('等级', Tower.level[eid]));
    pushRow(rows, maybeRow('总投资', Tower.totalInvested[eid], (n) => `${fmt(n)} G`));
    sections.push({ title: '塔属性', rows });
  }
  if (hasComponent(w, UnitTag, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('等级', UnitTag.level[eid], (n) => `${n} / ${UnitTag.maxLevel[eid] ?? '?'}`));
    pushRow(rows, maybeRow('人口占用', UnitTag.popCost[eid]));
    pushRow(rows, maybeRow('造价', UnitTag.cost[eid], (n) => `${fmt(n)} G`));
    pushRow(rows, maybeRow('总投资', UnitTag.totalInvested[eid], (n) => `${fmt(n)} G`));
    pushRow(rows, maybeRow('击杀奖励金币', UnitTag.rewardGold[eid], (n) => n > 0 ? `${fmt(n)} G` : '—'));
    pushRow(rows, maybeRow('击杀奖励能量', UnitTag.rewardEnergy[eid], (n) => n > 0 ? `${fmt(n)}` : '—'));
    pushRow(rows, maybeRow('Boss', UnitTag.isBoss[eid] === 1 ? '是' : undefined));
    pushRow(rows, maybeRow('可攻击建筑', UnitTag.canAttackBuildings[eid] === 1 ? '是' : undefined));
    if (rows.length > 0) sections.push({ title: '单位标签', rows });
  }
  if (hasComponent(w, Production, eid)) {
    const rows: LabeledValue[] = [];
    const resourceType = Production.resourceType[eid];
    pushRow(rows, maybeRow('资源类型', resourceType !== undefined ? (resourceType === 0 ? '金币' : '能量') : undefined));
    pushRow(rows, maybeRow('产出速率', Production.rate[eid], (n) => `${fmt(n)} /秒`));
    pushRow(rows, maybeRow('等级', Production.level[eid], (n) => `${n} / ${Production.maxLevel[eid] ?? '?'}`));
    pushRow(rows, maybeRow('累积值', Production.accumulator[eid]));
    sections.push({ title: '生产建筑', rows });
  }
  if (hasComponent(w, Trap, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('DPS', Trap.damagePerSecond[eid]));
    pushRow(rows, maybeRow('半径', Trap.radius[eid], (n) => `${fmt(n)} px`));
    pushRow(rows, maybeRow('冷却', Trap.cooldown[eid], (n) => `${fmt(n)} 秒`));
    pushRow(rows, maybeRow('冷却剩余', Trap.cooldownTimer[eid], (n) => `${fmt(n)} 秒`));
    const triggers = Trap.triggerCount[eid];
    const maxTriggers = Trap.maxTriggers[eid];
    if (triggers !== undefined && maxTriggers !== undefined && maxTriggers > 0) {
      pushRow(rows, maybeRow('触发次数', `${triggers} / ${maxTriggers}`));
    }
    sections.push({ title: '陷阱', rows });
  }
  if (hasComponent(w, Skill, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('冷却', Skill.cooldown[eid], (n) => `${fmt(n)} 秒`));
    pushRow(rows, maybeRow('剩余冷却', Skill.currentCooldown[eid], (n) => `${fmt(n)} 秒`));
    pushRow(rows, maybeRow('能量消耗', Skill.energyCost[eid]));
    sections.push({ title: '技能（组件）', rows });
  }

  if (skillId) {
    const cfg = SKILL_CONFIGS[skillId];
    if (cfg) {
      const rows: LabeledValue[] = [
        { label: '技能 ID', value: cfg.id },
        { label: '技能名', value: cfg.name },
        { label: '描述', value: cfg.description },
        { label: '触发方式', value: cfg.trigger },
        { label: '基础冷却', value: `${fmt(cfg.cooldown)} 秒` },
        { label: '能量消耗', value: String(cfg.energyCost) },
        { label: '范围', value: `${fmt(cfg.range)} px` },
        { label: '数值', value: fmt(cfg.value) },
      ];
      if (cfg.buffId) rows.push({ label: '关联 Buff', value: cfg.buffId });
      sections.push({ title: '技能（配置）', rows });
    }
  }
  if (hasComponent(w, Boss, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('当前阶段', Boss.phase[eid]));
    pushRow(rows, maybeRow('二阶段血量比', Boss.phase2HpRatio[eid], (n) => `${fmt(n * 100, 1)}%`));
    pushRow(rows, maybeRow('阶段转换计时', Boss.transitionTimer[eid], (n) => `${fmt(n)} 秒`));
    sections.push({ title: 'Boss', rows });
  }
  const stateRows: LabeledValue[] = [];
  if (hasComponent(w, Stunned, eid)) {
    pushRow(stateRows, maybeRow('眩晕剩余', Stunned.timer[eid], (n) => `${fmt(n)} 秒`));
  }
  if (hasComponent(w, Frozen, eid)) {
    pushRow(stateRows, maybeRow('冰冻剩余', Frozen.timer[eid], (n) => `${fmt(n)} 秒`));
  }
  if (hasComponent(w, Slowed, eid)) {
    const pct = Slowed.percent[eid];
    const stacks = Slowed.stacks[eid];
    const timer = Slowed.timer[eid];
    if (pct !== undefined) stateRows.push({ label: '减速', value: `${fmt(pct * 100, 1)}% × ${stacks ?? 1} 层 (${fmt(timer)} 秒)` });
  }
  if (hasComponent(w, Taunted, eid)) {
    pushRow(stateRows, maybeRow('嘲讽来源', Taunted.sourceId[eid] ? `eid=${Taunted.sourceId[eid]}` : undefined));
    pushRow(stateRows, maybeRow('嘲讽剩余', Taunted.timer[eid], (n) => `${fmt(n)} 秒`));
  }
  if (hasComponent(w, BuildingTower, eid)) {
    pushRow(stateRows, maybeRow('建造剩余', BuildingTower.timer[eid], (n) => `${fmt(n)} 秒`));
  }
  if (hasComponent(w, PlayerControllable, eid)) {
    pushRow(stateRows, maybeRow('玩家选中', PlayerControllable.selected[eid] === 1 ? '是' : '否'));
  }
  if (stateRows.length > 0) sections.push({ title: '状态效果', rows: stateRows });
  let buffs: BuffData[] = [];
  try {
    buffs = getBuffs(eid);
  } catch {
    buffs = [];
  }
  if (hasComponent(w, BuffContainer, eid) || buffs.length > 0) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('Buff 数量', BuffContainer.buffCount[eid] ?? buffs.length));
    if (buffs.length === 0) {
      rows.push({ label: '当前 Buff', value: '（无）' });
    } else {
      for (const b of buffs) {
        const valueStr = b.isPercent ? `${fmt(b.value * 100, 1)}%` : fmt(b.value);
        const stacksStr = b.maxStacks > 1 ? ` × ${b.stacks}` : '';
        rows.push({
          label: b.id,
          value: `${b.attribute} ${valueStr}${stacksStr}  剩余 ${fmt(b.duration)}s  来源 eid=${b.sourceId}`,
        });
      }
    }
    sections.push({ title: 'Buff', rows });
  }
  if (hasComponent(w, Visual, eid)) {
    const rows: LabeledValue[] = [];
    pushRow(rows, maybeRow('尺寸', Visual.size[eid], (n) => `${fmt(n)} px`));
    pushRow(rows, maybeRow('透明度', Visual.alpha[eid], (n) => fmt(n, 2)));
    const r = Visual.colorR[eid];
    const g = Visual.colorG[eid];
    const b = Visual.colorB[eid];
    if (r !== undefined && g !== undefined && b !== undefined) {
      rows.push({ label: '颜色 RGB', value: `${r}, ${g}, ${b}` });
    }
    pushRow(rows, maybeRow('朝向', Visual.facing[eid], (n) => n < 0 ? '左' : '右'));
    if (rows.length > 0) sections.push({ title: '视觉', rows });
  }

  return { entityId: eid, displayName, sections };
}

export class InspectorWindow {
  private container: HTMLElement;
  private panel: HTMLElement;
  private titleText: HTMLElement;
  private content: HTMLElement;
  private isOpen = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'debug-inspector-window';
    this.container.style.cssText = `
      position: fixed;
      top: 60px;
      right: 380px;
      width: 360px;
      max-height: calc(100vh - 100px);
      z-index: 9997;
      display: none;
      flex-direction: column;
      background: rgba(20, 20, 32, 0.96);
      border: 2px solid #3a3a4a;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;

    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #1e1e2e;
      border-bottom: 1px solid #3a3a4a;
      border-radius: 6px 6px 0 0;
      flex-shrink: 0;
    `;

    this.titleText = document.createElement('div');
    this.titleText.style.cssText = 'color: #e0e0e0; font-size: 14px; font-weight: bold;';
    this.titleText.textContent = 'Inspector — 未选中实体';
    titleBar.appendChild(this.titleText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭 (Esc)';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #a0a0b0;
      font-size: 18px;
      cursor: pointer;
      padding: 2px 10px;
      border-radius: 4px;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#3a3a4a';
      closeBtn.style.color = '#e0e0e0';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
      closeBtn.style.color = '#a0a0b0';
    });
    closeBtn.addEventListener('click', () => this.hide());
    titleBar.appendChild(closeBtn);

    this.container.appendChild(titleBar);

    this.content = document.createElement('div');
    this.content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px 14px;
      color: #e0e0e0;
      font-size: 12px;
      line-height: 1.5;
    `;
    this.content.innerHTML = '<div style="color:#888;text-align:center;padding:20px 0;">点击战场任意单位查看其属性</div>';
    this.container.appendChild(this.content);

    this.panel = this.container;
    document.body.appendChild(this.container);
  }

  show(state: InspectorState | null): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.updateState(state);
  }

  hide(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  toggle(state: InspectorState | null): void {
    if (this.isOpen) this.hide();
    else this.show(state);
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  updateState(state: InspectorState | null): void {
    if (!this.isOpen) return;
    if (state === null) {
      this.titleText.textContent = 'Inspector — 未选中实体';
      this.content.innerHTML = '<div style="color:#888;text-align:center;padding:20px 0;">点击战场任意单位查看其属性</div>';
      return;
    }

    this.titleText.textContent = `Inspector — ${state.displayName} (eid=${state.entityId})`;
    this.content.innerHTML = '';
    for (const section of state.sections) {
      this.content.appendChild(this.renderSection(section));
    }
  }

  private renderSection(section: Section): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom: 12px;';

    const title = document.createElement('div');
    title.textContent = section.title;
    title.style.cssText = `
      color: #7eb6ff;
      font-size: 12px;
      font-weight: bold;
      padding: 4px 0;
      margin-bottom: 4px;
      border-bottom: 1px solid #2a2a3a;
    `;
    wrapper.appendChild(title);

    for (const row of section.rows) {
      const r = document.createElement('div');
      r.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        padding: 2px 0;
      `;
      const labelEl = document.createElement('span');
      labelEl.textContent = row.label;
      labelEl.style.cssText = 'color: #a0a0b0; flex-shrink: 0;';
      const valueEl = document.createElement('span');
      valueEl.textContent = row.value;
      valueEl.style.cssText = 'color: #e0e0e0; text-align: right; word-break: break-word;';
      r.appendChild(labelEl);
      r.appendChild(valueEl);
      wrapper.appendChild(r);
    }

    return wrapper;
  }

  destroy(): void {
    this.container.remove();
  }
}
