# 开发日志

> Tower Defender — 开发过程记录

---

## Phase 1 — MVP 核心闭环

### 2026-05-06 — 项目启动

**完成工作**:
- 项目脚手架 (Vite + TypeScript + Canvas 2D)
- ECS 核心框架 (World / Entity / Component / System)
- 8 个 ECS 组件 (Position, Render, Health, Attack, Movement, Tower, Enemy, PlayerOwned, GridOccupant)
- 8 个 ECS 系统 (Render, Movement, Attack, Health, Wave, Economy, Build, UI)
- 跨平台输入抽象 (鼠标+触屏 → 统一 InputAction)
- Canvas 几何图形渲染器 (命令缓冲模式)
- 地图网格系统 (30×17 格 Zig-zag 路径)
- 攻击塔系统 (箭塔：建造/自动攻击/升级框架)
- 敌人系统 (小兵：路径移动/受击/死亡)
- 波次系统 (3 波配置/生成/结算)
- 经济系统 (起始200金币/杀敌+10/造塔-50)
- UI 系统 (顶部HUD/左侧建造面板/波次按钮)
- VS Code 调试配置 (F5 启动 Chrome)
- 构建工具 (Makefile + build.ps1 + npm scripts)

**解决的关键问题**:

| 问题 | 根因 | 修复 |
|------|------|------|
| 画面完全空白 | `beginFrame()` 在 `world.update()` 之后调用，清空了渲染命令缓冲 | 调整游戏循环顺序：beginFrame → input → update → endFrame |
| UI 按钮被地图覆盖 | RenderSystem 注册在 UISystem 之后，地图命令后入缓冲排在顶层 | 交换注册顺序：RenderSystem → UISystem |
| 字体在缩小窗口后不可读 | 固定 12-18px 字号 + canvas 透明背景 | 字号放大至 18-26px；canvas 改为实色背景 |
| 字体用 `monospace` 可能无中文字体 | 浏览器回退字体不确定 | 改用系统默认(monospace) + 增大字号补偿 |

### 2026-05-07 — 视觉重构

**新增**:
- 弹道系统: `Projectile` 组件 + `ProjectileSystem`
- 攻击系统改为发射弹道 (箭塔发射蓝色箭头)
- 箭头形状: 箭杆 + 三角箭头，指向目标方向
- `RenderCommand` 支持文本标签 (`label/labelColor/labelSize`)
- 塔渲染: 蓝色圆圈 + "箭塔" 文字
- 敌人渲染: 红色圆圈 + "小兵" 文字
- 基地渲染: 六边形 + "基地" 文字

**优化**:
- 血条高度: 4px → 3px
- 血条偏移: -6px → -14px (离单位更远)
- 血条颜色: 单色 → 绿(>60%) → 黄(30-60%) → 红(<30%)
- 地图颜色调亮 (空地块: #3a7d44, 路径: #a1887f)

**架构决策**:
- 弹道系统在 AttackSystem 之后、HealthSystem 之前运行，确保弹道在死亡检测前命中
- RenderSystem 自动识别 Projectile 组件，将 Render.shape 覆盖为 'arrow' 并计算目标方向

---

## Phase 2 — 系统完善

### 2026-05-07 — Phase 2 完成

**新增塔类型 (3种)**:
- 炮塔 (Cannon): 物理AOE + 击退，橙色圆炮弹，80px溅射半径
- 冰塔 (Ice): 魔法减速 + 冰冻，叠5层冻结1秒，蓝色冰晶弹
- 电塔 (Lightning): 魔法链式闪电，弹跳3-5次/衰减20%，黄色三角弹

**新增敌人类型 (5种)**:
- 快兵 (Runner): 高速低血量，冲基地型
- 重装兵 (Heavy): 高血量高护甲，慢速
- 法师 (Mage): 远程攻击建筑，低血量
- 自爆虫 (Exploder): 死亡爆炸伤害周围建筑
- 指挥官/攻城兽 (Boss): 阶段转换、多技能

**新增敌人攻击建筑行为**:
- `EnemyAttacker` 组件 + `EnemyAttackSystem`
- 敌人可在建筑旁停下攻击，建筑被摧毁需修复

**新增可移动单位 (2种)**:
- 盾卫: 高血量坦克，嘲讽技能（强制周围敌人攻击自己3秒）
- 剑士: 近战输出，旋风斩技能（AOE伤害）
- `Unit` + `PlayerControllable` 组件
- `UnitSystem`: 拖拽移动 + 自动攻击最近敌人

**新增 Buff 系统**:
- `BuffContainer` 组件: 管理实体上的 Buff 列表
- `BuffSystem`: 每帧 tick 持续时间，驱除过期 Buff
- 冰塔减速专精: 叠加5层 → 冰冻
- 影响属性: HP/ATK/Speed/Defense/Range/AttackSpeed

**新增技能系统**:
- `Skill` 组件 + `SkillSystem`
- 主动技能: CD制 + 能量消耗
- 被动技能框架
- 嘲讽 (taunt): 8s CD, 20能量
- 旋风斩 (whirlwind): 6s CD, 15能量

**新增 Boss 系统**:
- `Boss` 组件 (阶段/HP阈值/技能列表)
- 阶段转换: HP < 50% → 速度+30%
- 视觉: 尺寸1.3x, 头顶金色三角冠

**新增生产建筑 (2种)**:
- 金矿: 100G建造，2金/秒产出
- 能量塔: 75G建造，1能量/秒产出
- `Production` 组件 + `ProductionSystem`

**新增资源**:
- 能量 (Energy): 起始50，能量塔产出，用于技能
- 人口 (Population): 上限6，单位部署消耗

**架构变更**:
- 系统数量: 8 → 14 (新增6个系统)
- 组件数量: 9 → 15 (新增6个组件)
- 系统注册顺序: movement → enemyAttack → attack → projectile → wave → health → economy → unit → skill → buff → production → build → render → ui

**文件清单**:
- 新增: 10个文件 (5组件 + 4系统 + 0数据)
- 修改: 7个文件 (类型/数据/攻击/弹道/移动/生命/主入口)

### 文档体系重组

- 拆分 GDD 为 11个子文档 + 索引 (`.sisyphus/design/README.md`)
- 新增 Phase 2 详细设计文档 (`11-phase2-design.md`)
- 建立开发日志 (`.sisyphus/dev-log.md`)

---

### 验收修复 + 已知问题修复 (2026-05-07)

| 问题 | 修复 |
|------|------|
| 血条显示为方块 | rect 增加 `h` 字段支持非正方形；血条 w=barW, h=4px |
| 无塔攻击范围预览 | 选中塔时绘制半透明范围圈 (alpha 0.15填 + 0.4描边) |
| 无塔数值提示 | 底部信息面板: 名称/等级/ATK/范围/攻速/升级费/HP |
| 左侧面板缺数值 | 扩展至6行: 名称/价格/ATK/范围/攻速/伤害类型 |
| 炮塔击退像抖动 | 距离60→100px + 加200ms硬直 (movementPaused) |
| 单位无受击反馈 | 受击 hitFlashTimer=0.12s → 渲染白色1帧 |
| 塔升级无交互 | 信息面板"升级"按钮 → 扣费+升等级+更新属性+刷新标签 |
| 单位部署UI缺失 | 右侧面板 (x=1760-1920) 盾卫/剑士按钮 → 部署模式 → 点击地图放置 |
| 生产建筑无法建造 | 左侧"生产"区: 金矿/能量塔; BuildSystem + placementMode |
| Boss阶段视觉弱 | 阶段转换: 0.5s白/红闪烁 + 0.3s全场暂停 |
| HUD缺少资源 | 增加能量和人口显示: "金币:200  能量:50  人口:0/6" |

**Buff视觉清单**: `.sisyphus/design/12-buff-visuals.md`
- 冰减速: 颜色向#4488cc渐变(按层数); 冰冻: #00bcd4; Boss P2: 偏红35%; 受击: 白闪1帧

---

## Phase 3 — 内容填充

### 2026-05-07 — 连续战斗流 + 倍速 + 暂停菜单

**流程重构**:
- 取消手动"开始波次"按钮，改为自动倒计时 (开局5s，波间3s)
- 倒计时可手动跳过 ([▶立即] 按钮)
- 战斗中允许建造/部署 (移除 Phase 限制)
- Victory/Defeat 阶段才禁用建造

**新增 UI 控件**:
- 1x/2x 倍速切换按钮 (HUD 右侧，蓝/红色)
- 暂停按钮 → 暂停浮层菜单 (继续/重新开始/退出)
- 倒计时显示: "⏱ 下一波: 3.2s"

### 2026-05-07 — 炮塔击退→眩晕

| 改动 | 文件 |
|------|------|
| TowerConfig.knockback → stunDuration | types/index.ts, data/gameData.ts |
| Projectile.knockback → stunDuration | components/Projectile.ts |
| 眩晕逻辑: enemy.stunTimer, 金色渲染 | ProjectileSystem.ts, Enemy.ts, RenderSystem.ts |
| 移除了瞬间位移代码 | MovementSystem.ts |

眩晕效果: 炮塔命中 → 范围内敌人 stunTimer=1.5s → 金色闪烁 → 无法移动/攻击

### 2026-05-07 — UI 全面重构

**布局变更**:
| 区域 | 改前 | 改后 |
|------|------|------|
| 单位/生产/陷阱 | 右侧面板 (x=1780-1910) 盖住场景 | **底部面板** (y=900-1080) 与场景分离 |
| 塔建造 | 左侧面板含生产区 | 左侧面板**仅塔** (x=0-160, y=60-900) |
| 选中信息 | 屏幕底部大面板 | **实体上方小型 Tooltip** |
| 放置方式 | 点击建造 | **拖拽放置** + 幽灵预览 |
| 建造区 | 任意空地 | **路径邻格 (8方向1格内)** |
| 建造区视觉 | 无区分 | 可建格: 浅绿+边框 |
| HUD | 无敌人计数 | "敌军: 存活 X / 总数 Y" |
| 敌人交互 | 无 | 点击敌人 → Tooltip (名称/HP/速度/特性) |

**拖拽放置流程**:
- mousedown 在按钮上 → 进入拖拽模式 → 光标处半透明幽灵预览
- mouseup 在有效格上 → 放置实体
- mouseup 在其他位置 → 取消

### 2026-05-07 — Phase 3 内容层 (并行完成)

| 模块 | 文件 | 说明 |
|------|------|------|
| 5个关卡 | src/data/levels/level-01~05.ts | 平原/沙漠/冰原/火山/城堡，各 10-15波 |
| 关卡选择 UI | src/systems/LevelSelectUI.ts | 3+2 卡片布局，星级/锁定/无尽模式按钮 |
| 存档系统 | src/utils/SaveManager.ts | LocalStorage, 进度/星级/高分 |
| 无尽模式 | src/systems/EndlessWaveGenerator.ts | 程序化波次，递增难度，5波一Boss |
| 中立单位 | Trap/HealingSpring/GoldChest | 陷阱系统/治疗泉/宝箱，3组件+2系统 |

---

## 已知问题 (当前)

| # | 描述 | 状态 |
|---|------|------|
| 3 | 音效系统未接入 | 待办 |
| 4 | 无新手引导 | Phase 4 |
| 8 | 单位技能无释放按钮 | 待办 |

---

### 2026-05-07 — 场景完全变黑 (Bug修复)

**根因**: 黑色边框用单个 rect (size=mapW+4, alpha=1, color='#000000') 实心填满整个场景区域，完全盖住所有地图格。
**修复**: 改为 4 条细边框 rect (上下左右各 3px)，`isAdjacentToPath` 移到 `src/utils/grid.ts` 消除跨系统依赖。

**场景重建**:
- 地图: 30×16 → **21×9** (1344×576px)
- 场景偏移: (288, 50)，居中 + 2px 黑色边框
- 所有坐标转换统一使用 sceneOffsetX/Y

**UI 统一**:
- 移除左侧塔面板、右侧单位面板
- **底部统一工具栏**: 塔 | 单位+陷阱 | 生产 | 选中信息 (按钮 120×80)
- 顶部 HUD 单行紧凑: 💰⚡👥 波次 敌军 ⏱ [1x][⏸]
- 移除阶段文字标签 (避免重叠)

**单位系统完整实现**:
- UnitSystem: 移动至玩家目标 + 自动追击最近敌人 + 近战攻击
- 单位拖动: 地图上拖拽已部署单位重新定位
- 单位限制: 不可进入路径格，限制在场景范围内
- 单位死亡: 红色死亡特效 + 释放人口 + 50%金币回收

**地刺改造**:
- 3个红色三角形聚簇 (← /|\ → 布局)
- 仅可放置在路径格上
- 持续伤害: 每秒 20 伤害 (damagePerSecond * dt)
- 敌人站上去时地刺变亮 (闪红)

**实体回收**:
- 选中实体 → 工具提示显示红色"回收"按钮
- 退还 50% 总投资 (建造+升级费用)
- 释放人口 (如果是单位)，清除网格占用
