# 天气系统设计文档

## 1. 概述

天气系统为 Tower Defender 增加动态环境因素，共有 **5 种天气类型**：晴天、下雨、下雪、下雾、夜晚。每种天气会对游戏单位的数值属性产生全局影响（通过 Buff 系统实现），同时附带视觉特效以增强沉浸感。

### 1.1 设计目标

- **策略深度**：天气因素迫使玩家根据天气变化调整防御策略，不同天气下塔的优劣发生变化
- **沉浸感**：天气视觉特效（粒子、色调滤镜）与游戏场景融合
- **可配置性**：天气类型与波次/关卡关联，支持预设和随机
- **纯净集成**：依赖现有 Buff 系统传递属性修正，不引入额外耦合

## 2. 天气类型定义

### 2.1 WeatherType 枚举

```typescript
enum WeatherType {
  Sunny  = 'sunny',   // 晴天（默认）
  Rain   = 'rain',    // 下雨
  Snow   = 'snow',    // 下雪
  Fog    = 'fog',     // 下雾
  Night  = 'night',   // 夜晚
}
```

### 2.2 每种天气的数值影响

#### 晴天（Sunny）
默认天气，阳光普照，激光能量被稀释，但火药在高温下燃烧更充分。

| 目标单位 | 属性 | 效果 | 理由 |
|----------|------|------|------|
| 激光塔 | ATK | **-30%** | 阳光干扰激光束聚焦，能量逸散 |
| 炮塔 | ATK | **+20%** | 高温助燃火药，爆炸威力提升 |
| 冰塔 | ATK | **-10%** | 高温加速冰块融化，冰冻时间减少 0.3s |
| 所有单位 | — | 无其他影响 | — |

#### 下雨（Rain）
大雨滂沱，火药受潮哑火，但积水和湿气成为电流的绝佳导体。

| 目标单位 | 属性 | 效果 | 理由 |
|----------|------|------|------|
| 炮塔 | ATK | **-30%** | 火药受潮，引燃困难，爆炸范围减少 20px |
| 电塔 | ATK | **+30%** | 雨水导电，闪电链 +1 跳，链衰减降低 5% |
| 箭塔 | ATK | **-10%** | 弓弦受潮弹性下降，射速降低 |
| 所有敌人 | Speed | **-5%（地面泥泞）** | — |
| 激光塔 | ATK | **+10%** | 雨滴折射增加光束散射伤害 |

#### 下雪（Snow）
暴雪肆虐，严寒冻结一切，地面结冰导致行动迟缓。

| 目标单位 | 属性 | 效果 | 理由 |
|----------|------|------|------|
| 所有敌人 | Speed | **-25%** | 冰雪路面，移动困难 |
| 冰塔 | ATK | **+30%** | 严寒环境增强冰冻效果，每次攻击额外 +1 减速层 |
| 炮塔 | ATK | **+10%** | 低温使金属脆化，溅射破片伤害提升 |
| 电塔 | ATK | **-10%** | 低温增加电阻，闪电链 -1 跳 |
| 所有单位 | — | 冰冻层数上限 +1 | — |

#### 下雾（Fog）
浓雾弥漫，视野受阻，箭矢失去准头，但激光在雾中发生散射反而扩大伤害面。

| 目标单位 | 属性 | 效果 | 理由 |
|----------|------|------|------|
| 箭塔 | AttackSpeed | **-30%**（命中率下降模拟）| 浓雾导致瞄准困难，有效射速降低 |
| 激光塔 | ATK | **+30%** | 雾中水珠折射，激光散射范围伤害 |
| 所有塔 | Range | **-15%** | 浓雾限制可视射程 |
| 蝙蝠塔 | — | 不受射程惩罚（声波探测无视视力） | — |
| 所有敌人 | Speed | **-10%** | 敌人也看不清路 |

#### 夜晚（Night）
夜幕降临，黑暗笼罩战场。普通防御塔失去视野优势，但暗夜生物开始活跃。

| 目标单位 | 属性 | 效果 | 理由 |
|----------|------|------|------|
| 蝙蝠塔 | ATK | **可攻击（+50% ATK）** | 仅在夜晚/下雾时激活；夜色增强暗系攻击 |
| 所有塔 | Range | **-20%** | 黑夜限制可视射程（蝙蝠塔除外） |
| 所有敌人 | Speed | **+18%** | 夜色掩护加速行军 |
| 激光塔 | Range | **+10%** | 光束在黑暗中更加显眼，有效射程反而增加 |
| 电塔 | AttackSpeed | **+15%** | 闪电光芒照亮周围，攻击频率提升 |

### 2.3 天气影响汇总表

| 单位 / 属性 | 晴天 | 下雨 | 下雪 | 下雾 | 夜晚 |
|-------------|------|------|------|------|------|
| 箭塔 ATK | — | **-10%** | — | *-30% AtkSpeed* | — |
| 箭塔 Range | — | — | — | **-15%** | **-20%** |
| 炮塔 ATK | **+20%** | **-30%** | +10% | — | — |
| 炮塔 Range | — | — | — | -15% | -20% |
| 冰塔 ATK | **-10%** | — | **+30%** | — | — |
| 冰塔 Range | — | — | — | -15% | -20% |
| 电塔 ATK | — | **+30%** | -10% | — | — |
| 电塔 Range | — | — | — | -15% | -20% |
| 激光塔 ATK | **-30%** | +10% | — | **+30%** | — |
| 激光塔 Range | — | — | — | -15% | **+10%** |
| 蝙蝠塔 ATK | *不可攻击* | *不可攻击* | *不可攻击* | **+50%** | **+50%** |
| 蝙蝠塔 Range | *不可攻击* | *不可攻击* | *不可攻击* | 无惩罚 | 无惩罚 |
| 敌人 Speed | — | -5% | **-25%** | -10% | **+18%** |
| 特殊效果 | 冰塔冰冻-0.3s | 电塔链+1跳 | 冰冻层上限+1 | — | 电塔AtkSpeed+15% |

> **注意**：百分比为相对变化量。例如 `+20% ATK` 表示攻击力变为原来的 120%。

## 3. 新增单位设计

### 3.1 激光塔（Laser Tower）

高穿透力的能量武器，攻击为线性穿透伤害（贯穿路径上所有敌人），但攻速慢、对单体伤害一般。

| 属性 | 数值 |
|------|------|
| ID | `laser_tower` |
| 名称 | 激光塔 |
| 分类 | Tower |
| 层级 | Ground |
| HP | 80 |
| ATK | 22 |
| Defense | 0 |
| AttackSpeed | 0.4 次/秒 |
| AttackRange | 250 px |
| MoveSpeed | 0 |
| MagicResist | 0 |
| 颜色 | `#00e5ff` |
| 大小 | 36 |
| 形状 | rect |
| 费用 | 90 |
| 回收价 | 45 |
| 升级费用 | [55, 85, 130, 190] |
| AI | `tower_laser` |
| 伤害类型 | magic |
| 穿透机制 | 攻击以光束形式直线命中，沿途所有敌人受到伤害（每穿透一个衰减 15%）|
| 升级加成 | ATK: [+6, +9, +13, +18]，Range: [+15, +15, +20, +20] |

**天气互动**：
- 晴天 ATK **-30%**（阳光干扰聚焦）
- 下雨 ATK **+10%**（雨滴散射）
- 下雾 ATK **+30%**（雾中水珠折射扩大伤害面）
- 夜晚 Range **+10%**（光束更显眼）

### 3.2 蝙蝠塔（Bat Tower）

暗夜生物栖息的塔楼，白天/晴天休眠，仅在下雾和夜晚激活。攻击附带生命偷取效果。

| 属性 | 数值 |
|------|------|
| ID | `bat_tower` |
| 名称 | 蝙蝠塔 |
| 分类 | Tower |
| 层级 | LowAir（蝙蝠飞行攻击） |
| HP | 90 |
| ATK | 25（仅在可攻击时生效） |
| Defense | 0 |
| AttackSpeed | 0.75 次/秒 |
| AttackRange | 200 px |
| MoveSpeed | 0 |
| MagicResist | 0 |
| 颜色 | `#7c4dff` |
| 大小 | 34 |
| 形状 | rect |
| 费用 | 85 |
| 回收价 | 42 |
| 升级费用 | [50, 80, 120, 175] |
| AI | `tower_bat` |
| 伤害类型 | magic |
| 特殊机制 | 攻击回复自身 HP（生命偷取 30% 伤害量）；下雾时无视射程惩罚 |
| 升级加成 | ATK: [+7, +10, +15, +21]，Range: [+15, +15, +20, +20] |

**天气互动**：
- 晴天/下雨/下雪：**不可攻击**（蝙蝠休眠）
- 下雾/夜晚：**可攻击**，且 ATK **+50%**
- 下雾时不承受 Range 惩罚（声波探测）

## 4. 技术架构

### 4.1 新增类型定义

```typescript
// 在 types/index.ts 中新增

enum WeatherType {
  Sunny  = 'sunny',
  Rain   = 'rain',
  Snow   = 'snow',
  Fog    = 'fog',
  Night  = 'night',
}

// 扩展 TowerType 枚举
enum TowerType {
  Arrow    = 'arrow',
  Cannon   = 'cannon',
  Ice      = 'ice',
  Lightning = 'lightning',
  Laser    = 'laser',    // 新增
  Bat      = 'bat',      // 新增
}

// 天气对属性的修正项
interface WeatherModifier {
  targetType: string;          // 目标塔种类或 'enemy'
  attribute: BuffAttribute;    // 哪个属性受影响
  value: number;               // 数值变化（正=增强，负=削弱）
  isPercent: boolean;          // 是否百分比
}

// 天气配置
interface WeatherConfig {
  type: WeatherType;
  name: string;                // 中文名
  modifiers: WeatherModifier[]; // 属性修正列表
  visualEffects: string[];     // 视觉特效ID列表
  screenTint: string;          // 画面叠加色（rgba）
}

// 扩展到 LevelConfig
interface LevelConfig {
  // ... 现有字段
  weatherPool?: WeatherType[];     // 可选的天气池（每波之间随机切换）
  weatherFixed?: WeatherType;      // 固定天气（覆盖随机）
  weatherChangeInterval?: number;  // 天气切换间隔（波次数，默认每3波）
}
```

### 4.2 天气系统（WeatherSystem）

作为新增 ECS System 运行，不直接操作实体，而是统一维护全局天气状态并通过 Buff 系统对实体生效。

```
WeatherSystem
├── requiredComponents: []  (无实体依赖)
├── update(dt): 
│   ├── 管理天气持续时间 / 切换倒计时
│   ├── 定时切换天气（按波次或随机）
│   ├── 为匹配的实体施加/更新 WeatherBuff
│   └── 管理视觉特效（粒子发射/色调渐变）
```

### 4.3 系统注册位置

参照 AGENTS.md 中的系统顺序，`WeatherSystem` 注册在 `BuffSystem` **之前**、`AttackSystem` **之后**：

```
...
AttackSystem
WeatherSystem    ← 新增：天气修正（在 Buff 系统之前）
BuffSystem       ← 随后处理 buff 过期
...
```

这样确保天气 Buff 在每帧逻辑计算（攻击/移动/伤害）之前已经生效。

### 4.4 天气 Buff 机制

利用现有的 `BuffInstance` 接口，WeatherSystem 为每个受影响的实体动态施加 `WeatherBuff`：

```typescript
{
  id: 'weather_sunny_laser_atk',     // 唯一标识
  name: '晴天-激光削弱',
  attribute: BuffAttribute.ATK,
  value: -30,
  isPercent: true,
  duration: Infinity,                 // 持续到天气切换
  maxStacks: 1,
  currentStacks: 1,
  sourceEntityId: -1,                // -1 表示全局来源
}
```

天气切换时，WeatherSystem 清除所有 `weather_` 前缀的 buff，然后重新施加新天气的 buff。

### 4.5 视觉特效

| 天气 | 特效描述 | 实现方式 |
|------|----------|----------|
| 晴天 | 无特效（默认） | 无 |
| 下雨 | 从顶部持续下落的水滴粒子 | RenderSystem 叠加层：`rect 2x8` 蓝色半透明粒子 |
| 下雪 | 飘落的雪花粒子（缓飘、随机摇摆） | RenderSystem 叠加层：`circle r=2~4` 白色粒子 + 地面白色覆盖 |
| 下雾 | 画面叠加灰色半透明层 + 白色雾团粒子缓慢漂移 | 全屏 RGBA 叠加 + 10~15 个大型半透明白色圆圈随机移动 |
| 夜晚 | 画面叠加深蓝色半透明层 + 敌人路径点有微弱光芒 | 全屏 RGBA 叠加 + 路径点小光点 |

### 4.6 天气切换机制

1. **默认**：关卡开始为晴天（Sunny）
2. **切换时机**：每波结束后的 `WaveBreak` 阶段，从天气池中随机选择下一个天气（可重复）
3. **渐变过渡**：视觉特效在 1.5 秒内渐变（旧天气淡出 → 新天气淡入）
4. **固定天气**：若关卡配置 `weatherFixed`，则全程不切换
5. **波次指定**：可扩展为 `WaveConfig` 中每波独立指定天气

## 5. 数据文件修改计划

### 5.1 types/index.ts

- 新增 `WeatherType` 枚举
- 扩展 `TowerType` 枚举（增加 `Laser`, `Bat`）
- 新增 `WeatherModifier` 接口
- 新增 `WeatherConfig` 接口
- 扩展 `LevelConfig` 接口（增加 `weatherPool`, `weatherFixed`）
- 可选：扩展 `WaveConfig` 接口（增加 `weatherOverride`）

### 5.2 data/units/unitConfigs.ts

- 新增 `LASER_TOWER_CONFIG`
- 新增 `BAT_TOWER_CONFIG`
- 导出新增配置

### 5.3 data/weatherConfigs.ts（新文件）

- `WEATHER_CONFIGS: Record<WeatherType, WeatherConfig>` — 5 种天气的完整配置
- 每种天气包含 modifiers 数组和视觉参数

### 5.4 data/levels/*.ts

- 每个关卡配置增加天气相关字段（可选）

### 5.5 systems/WeatherSystem.ts（新文件）

- 天气状态管理
- Buff 施加/清理
- 视觉特效粒子管理
- 天气切换逻辑

### 5.6 其他文件

- `main.ts`：注册 WeatherSystem
- `RenderSystem.ts`：天气粒子绘制
- `AttackSystem.ts` / `MovementSystem.ts` / `ProjectileSystem.ts`：查询天气 buff 影响
- 可选：`ai/presets/aiConfigs.ts` — 新增 `tower_laser`, `tower_bat` AI 预设

## 6. 需求任务拆解

### 阶段一：类型与数据层（基础）

| 任务ID | 任务描述 | 优先级 |
|--------|----------|--------|
| T-01 | 在 `types/index.ts` 中新增 `WeatherType` 枚举 | P0 |
| T-02 | 扩展 `TowerType` 枚举增加 `Laser` 和 `Bat` | P0 |
| T-03 | 新增 `WeatherModifier` 接口 | P0 |
| T-04 | 新增 `WeatherConfig` 接口 | P0 |
| T-05 | 扩展 `LevelConfig` 接口增加天气字段 | P1 |
| T-06 | 创建 `data/weatherConfigs.ts` — 5 种天气完整配置 | P0 |
| T-07 | 在 `unitConfigs.ts` 中新增 `LASER_TOWER_CONFIG` | P0 |
| T-08 | 在 `unitConfigs.ts` 中新增 `BAT_TOWER_CONFIG` | P0 |

### 阶段二：天气系统核心（逻辑）

| 任务ID | 任务描述 | 优先级 |
|--------|----------|--------|
| T-09 | 创建 `systems/WeatherSystem.ts` — 天气状态机、Buff 管理 | P0 |
| T-10 | 实现天气切换逻辑（按波次 / 随机 / 固定） | P0 |
| T-11 | 实现 Buff 施加与清理（`weather_` 前缀管理） | P0 |
| T-12 | 实现天气渐变过渡（1.5s 视觉过渡） | P2 |
| T-13 | 在 `main.ts` 中注册 WeatherSystem（正确顺序） | P0 |

### 阶段三：单位天气交互（数值生效）

| 任务ID | 任务描述 | 优先级 |
|--------|----------|--------|
| T-14 | 蝙蝠塔：晴天/下雨/下雪时禁止攻击逻辑 | P0 |
| T-15 | 蝙蝠塔：生命偷取机制（攻击回血 30% 伤害） | P1 |
| T-16 | 激光塔：穿透攻击机制（贯穿路径敌人，衰减 15%/个） | P1 |
| T-17 | AttackSystem / EnemyAttackSystem 查询天气 buff 修正伤害 | P1 |
| T-18 | MovementSystem 查询天气 buff 修正速度 | P1 |
| T-19 | 现有单位数值查询时整合天气 buff 影响 | P1 |

### 阶段四：视觉特效（渲染）

| 任务ID | 任务描述 | 优先级 |
|--------|----------|--------|
| T-20 | RenderSystem 增加天气粒子绘制接口 | P1 |
| T-21 | 实现下雨粒子特效（蓝色水滴下落） | P1 |
| T-22 | 实现下雪粒子特效（白色雪花飘落 + 地面覆盖） | P1 |
| T-23 | 实现下雾特效（半透明覆盖 + 雾团漂移） | P1 |
| T-24 | 实现夜晚特效（深蓝色覆盖 + 路径光点） | P1 |
| T-25 | 实现天气渐变过渡动画 | P2 |

### 阶段五：集成与测试

| 任务ID | 任务描述 | 优先级 |
|--------|----------|--------|
| T-26 | 每个关卡配置合适的天气池 | P2 |
| T-27 | AI 预设：`tower_laser`, `tower_bat` 行为树 | P1 |
| T-28 | BuildSystem UI 增加激光塔/蝙蝠塔建造按钮 | P1 |
| T-29 | 关卡选择界面显示天气预览 | P2 |
| T-30 | 跑 typecheck + build 确保无编译错误 | P0 |

## 7. 气候与关卡主题的叙事关联

| 关卡 | 主题 | 推荐天气池 | 叙事理由 |
|------|------|-----------|----------|
| 第1关 平原 | 村庄郊外 | `[Sunny, Rain, Fog]` | 草原天气多变，但无极端寒冷 |
| 第2关 沙漠 | 炽热沙丘 | `[Sunny, Fog, Night]` | 沙漠极少雨雪，但沙暴（雾）和夜晚温差大 |
| 第3关 冰原 | 极寒冻土 | `[Snow, Fog, Night]` | 极地环境，常伴暴雪和极夜 |
| 第4关 火山 | 熔岩地带 | `[Sunny, Rain, Fog]` | 火山灰云形成雾霾，热气流催生降雨 |
| 第5关 城堡 | 暗影要塞 | `[Rain, Night, Fog]` | 哥特城堡终年阴暗潮湿 |

---

*本文档为天气系统设计的权威来源，所有实现必须与此文档保持一致。*
