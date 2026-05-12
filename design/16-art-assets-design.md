# 16 — 美术资产设计

> MDA分析驱动 | 程序化几何美术 | 零外部素材 | PixiJS WebGL 渲染

---

## 〇、MDA 分析

### M — 机制（Mechanics）

| 机制 | 说明 |
|------|------|
| 塔防布阵 | 在21×9网格上建造6种塔，沿路径形成击杀区 |
| 单位操控 | 拖拽部署/移动6种我方单位，拦截敌人 |
| 资源经济 | 金币/能量/人口三资源链，生产建筑 |
| 波次推进 | 5-15波固定+随机波次，BOSS波 |
| 天气影响 | 5种天气实时改变攻防数值 |
| 技能释放 | 主动技能 + Buff/Debuff系统 |

### D — 动态（Dynamics）

| 动态 | 玩家行为 | 视觉需求 |
|------|----------|----------|
| 击杀区构建 | 塔位选择 + 升级决策 | 塔升级视觉变化（等级标识 + 体型增长） |
| 阵型调整 | 移动单位拖拽到关键位置 | 拖拽幽灵预览 + 移动轨迹 |
| 天气适应 | 根据天气切换策略 | 天气粒子 + 全屏色调滤镜 |
| 经济节奏 | 建造/升级/回收决策 | 金币飞行粒子 + 建造动画 |
| BOSS应对 | 集火 + 技能时机 | BOSS大血条 + 阶段转换效果 |
| 波间准备 | 查看预览 + 调整布局 | 波次预览面板 + 倒计时视觉效果 |

### A — 美学（Aesthetics）目标

| 美学类型 | 目标体验 | 视觉实现策略 |
|----------|----------|-------------|
| **挑战感** | 策略深度，每一步有意义 | 清晰的视觉层级——威胁（红色/大/闪烁）优先吸引注意 |
| **发现感** | 随机元素带来新鲜感 | 每个关卡独特的主题配色和装饰物风格 |
| **表达感** | 个性化的布阵方式 | 塔和单位的复合几何体有独特轮廓，让布局"可读" |
| **感官愉悦** | 粒子爆炸、流畅动画 | 程序化粒子的色彩和谐、缓动函数、屏幕震动 |
| **叙事感** | 5个主题场景的环境故事 | 天空渐变、远景几何装饰、地面纹理的程序化生成 |

---

## 一、核心设计原则

### 1.1 三大支柱

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🏗️ 复合几何体            🎬 动画状态机              🌅 场景分层     │
│   (Composite Shapes)       (Animation FSM)          (Scene Layers)  │
│                                                             │
│   每个单位 = 多个简单         每个单位有独立的状态机        11层独立渲染层   │
│   几何原语组合成              驱动所有视觉变化:             各层使用不同    │
│   可识别的轮廓                SPAWN → IDLE ⇄ ATTACK         渲染技术和     │
│                              ↓        ↓                   性能策略       │
│   绝对不是单个形状!            HIT ←────┘                                │
│                              ↓                                         │
│                             DEATH                                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 设计约束

| 约束 | 说明 |
|------|------|
| **零外部素材** | 不引入任何 PNG/SVG/精灵图。100% 程序化几何图形。 |
| **PixiJS Graphics API** | 使用 `Graphics` 绘制所有几何体，`ParticleContainer` 管理粒子 |
| **设计分辨率** | 1920×1080，横屏 16:9 |
| **帧率目标** | 60fps 稳定，200+ 同屏实体，500+ 粒子 |
| **配置驱动** | 所有视觉参数在配置中声明，系统自动渲染 |

### 1.3 对称几何风格演变

```
版本对比:

v1.0 (旧 demo)
  每个单位 = 一个形状 + 文字标签
  ┌────┐
  │  ⚫  │ "小兵"
  └────┘
  表现力: ★☆☆☆☆

v2.0 (本设计)
  每个单位 = 3-8 个几何原语的组合 + 动画状态机
       ▲  (皇冠三角)
    ╭──●──╮ (光环 + 主体圆 + 厚重描边)
    │ ▓▓▓ │ (HP条)
    ╰──●──╯ (脚下阴影)
  表现力: ★★★★☆
```

---

## 二、场景分层架构

### 2.1 完整层级图

```
Layer 10  OverlayLayer        ─── 暂停遮罩、结算面板、转场黑幕
Layer 9   UILayer             ─── HUD、工具栏、选中信息面板
Layer 8   ScreenFXLayer       ─── 屏幕震动偏移、全屏闪光、晕影暗角
Layer 7   WeatherLayer        ─── 天气粒子（雨/雪/雾/夜光点）
Layer 6   EffectLayer         ─── 爆炸粒子、命中火花、金币飞行
Layer 5   ProjectileLayer     ─── 弹道（箭矢/炮弹/冰晶/闪电/光束/蝙蝠）
Layer 4   EntityLayer         ─── 所有游戏实体（按Y轴排序）
Layer 3   ShadowLayer         ─── 实体阴影（地面投影椭圆）
Layer 2   DecorationLayer     ─── 场景装饰物（树/岩石/冰晶/石柱）
Layer 1   GroundLayer         ─── 地图网格、路径、可建区域高亮
Layer 0   BackgroundLayer     ─── 主题背景（天空渐变 + 远景几何装饰）
```

### 2.2 各层实现方案

#### Layer 0 — BackgroundLayer（背景层）

**实现方式**: 单个 `Graphics` 对象绘制天空渐变 + 远景几何形状，整帧不重绘（脏标记触发）

**5个主题的背景方案**:

| 主题 | 天空渐变 | 远景元素 |
|------|----------|----------|
| **平原** | 上 `#87CEEB` → 下 `#E8F5E9` | 远山（多个深浅绿色三角形叠合）、飘动白云（白色椭圆序列） |
| **沙漠** | 上 `#FF9800` → 下 `#FFE0B2` | 沙丘（多个圆滑弧线叠合）、远处金字塔三角 |
| **冰原** | 上 `#BBDEFB` → 下 `#ECEFF1` | 雪山（白色+浅蓝三角形）、极光（半透明渐变弧带） |
| **火山** | 上 `#D32F2F` → 下 `#1A0000` | 火山锥（暗红梯形+顶部橙黄发光三角）、烟柱（灰色椭圆上升序列） |
| **城堡** | 上 `#1A237E` → 下 `#37474F` | 城堡剪影（灰色矩形+锯齿城垛）、远处尖塔（细长三角） |

**白云生成算法**:
```
每个云 = 3-5个白色椭圆叠加，alpha 0.3-0.6，缓慢横向漂移
位置随机分布在天空上半部分
速度 10-30 px/s，到达边界后循环
```

#### Layer 1 — GroundLayer（地面层）

**实现方式**: 每次地图变化时重建 `Graphics`（建造/回收时），平时不重绘。

- Tile 网格（21×9，64px 方块）
- 每种 Tile 类型使用主题配色（见 07-map-level-system.md §5）
- 可建地块：半透明绿色叠加层 + 虚线边框
- 路径方向指示：路径 tile 上有微小的箭头纹理（每4个tile一个）

**地面纹理增强**（程序化，每 tile 填充后叠加）:
```
每个 tile 填充底色后，叠加程序化噪声纹理：
- 生成 64×64 的 Perlin-like 噪声（用 Math.sin 叠加频率实现）
- 作为 alpha 0.05-0.1 的暗色叠加
- 打破纯色块的单调感
```

#### Layer 2 — DecorationLayer（装饰层）

**实现方式**: 不参与碰撞的纯视觉实体，创建时绘制一次，不逐帧更新。

**装饰物几何构成**（升级现有 `OBSTACLE_VISUALS`）:

| 装饰物 | 当前（v1.0） | 升级后（v2.0） |
|--------|-------------|---------------|
| 树 | 单个绿色三角 | 棕色矩形（树干）+ 绿色三角（树冠）+ 小三角（层次） |
| 岩石 | 菱形 | 2-3个重叠的灰色菱形/圆，不同深浅灰 |
| 冰晶 | 菱形 | 中心大菱形 + 上下左右4个小菱形，白色渐变 |
| 仙人掌 | 绿色三角 | 绿色矩形（主干）+ 两侧小矩形（分枝）+ 小菱刺 |
| 石柱 | 灰色圆 | 灰色矩形（柱体）+ 顶部梯形（柱头）+ 底部阴影 |
| 火炬台 | 橙色圆 | 灰色矩形（支架）+ 橙色泪滴形（火焰，可加微小抖动） |

#### Layer 3 — ShadowLayer（阴影层）

**实现方式**: 每个实体脚下绘制半透明深色椭圆。

```
阴影形状: 横向椭圆
尺寸: 实体大小 × 1.2 (宽), × 0.3 (高)
颜色: rgba(0,0,0,0.3)
位置: 实体 position.y + 实体 size/2
```

> **重要**: 阴影在 EntityLayer 之下，确保实体始终在自身上方。

#### Layer 4 — EntityLayer（实体层）

**实现方式**: 每个实体 = 一个 `Container`，内含一个 `Graphics` 对象。每帧根据动画状态机更新 Graphics 内容。

- 按 Y 轴排序（`container.y` 直接决定排序）
- 实体 Container 结构:
  ```
  Container (entity)
    ├── Graphics (shadow)       —— 或移到 Layer 3
    ├── Graphics (body)         —— 主体复合几何体
    ├── Graphics (hpBar)        —— 血条
    ├── Graphics (statusIcons)  —— Buff/Debuff 图标
    └── Graphics (selectionRing)—— 选中光环
  ```

#### Layer 5 — ProjectileLayer（弹道层）

**实现方式**: 每个弹道 = 一个 `Graphics` + `Container`（用于旋转）。

弹道实体有短暂生命周期（创建→飞向目标→命中→销毁），命中时向 EffectLayer 发射粒子。

#### Layer 6 — EffectLayer（特效层）

**实现方式**: `ParticleContainer`，利用 WebGL 批量渲染。

- 粒子最大数量: 500
- 每个粒子: `{x, y, vx, vy, life, maxLife, size, color, alpha, shape}`
- 粒子形状: circle（默认）、rect（雨滴）、triangle（火花）
- 粒子系统每帧更新: 位置 += 速度×dt，life -= dt，alpha = life/maxLife

#### Layer 7 — WeatherLayer（天气层）

**实现方式**: 独立的 `ParticleContainer`，不与 EffectLayer 混合。

**5种天气的程序化粒子**:

| 天气 | 粒子形状 | 生成速率 | 速度 | 特效 |
|------|----------|----------|------|------|
| **晴** | 无持续粒子 | — | — | 背景光晕（太阳位置暖色辉光） |
| **雨** | 蓝色细长矩形 2×12px | 80-120/s | 600-800px/s ↓ | 地面溅射（小圆爆发） |
| **雪** | 白色圆 r=2-4 | 30-50/s | 80-150px/s ↓ + 横向摆动 | 地面白色覆盖（alpha递增） |
| **雾** | 白色半透明大圆 r=40-80 | 5-8团 | 30-60px/s 横向漂移 | 全屏灰白叠加 alpha 0.08 |
| **夜** | 黄白微光点 r=2-3 | 15-25/s 路径上方 | 静止+周期明灭 | 全屏深蓝叠加 alpha 0.15 |

**天气切换过渡**:
```
切换时:
1. 旧天气粒子 alpha 逐帧递减 (1.5s 内到 0)
2. 新天气粒子 alpha 逐帧递增 (1.5s 内到 1)
3. 天气色调叠加层 colorTint 渐变动画
4. 过渡期间两个 ParticleContainer 同时存在
```

#### Layer 8 — ScreenFXLayer（屏幕特效层）

**实现方式**: 全屏矩形叠加 + 偏移变换。

| 效果 | 实现 |
|------|------|
| **屏幕震动** | 整个 Stage 的 `x, y` 添加正弦偏移，持续 0.1-0.3s |
| **受击闪白** | 全屏白色矩形 alpha 0→0.3→0，0.1s |
| **BOSS 登场闪** | 全屏白色 alpha 0→0.6→0，0.3s + 慢动作 |
| **关卡转场** | 黑色矩形 alpha 0→1 (0.5s) → alpha 1→0 (0.5s) |
| **晕影暗角** | 四个边缘渐变黑色矩形，alpha 0.2-0.4 |

#### Layer 9 — UILayer（UI层）

保持现有设计（09-ui-ux.md），增强项：
- 工具栏按钮 hover: 轻微放大（scale 1→1.05）+ 发光描边
- 选中信息面板弹出: translateY 动画 + alpha 淡入
- 金币/能量飞行粒子: 使用贝塞尔曲线路径从实体位置飞到 HUD 位置

#### Layer 10 — OverlayLayer（覆盖层）

保持现有设计——暂停/结算/关卡选择。

---

## 三、复合几何体系统

### 3.1 设计哲学

```
单个形状 → 无法识别 → 需要文字标签   ❌ v1.0
复合几何体 → 独特轮廓 → 一眼可辨     ✅ v2.0
```

每个单位由 **基础部件** + **身份部件** + **动态部件** 三部分组成:

```
┌─────────────────────────────────────────┐
│            复合几何体结构                 │
│                                         │
│   ┌──────────┐                          │
│   │  身份部件  │  ← 定义"这是什么"       │
│   │ (符号特征) │     剑、弓、盾、冠...    │
│   └─────┬────┘                          │
│         │                               │
│   ┌─────┴────┐                          │
│   │  基础部件  │  ← 定义"在哪/多大"       │
│   │ (主体形状) │     身体、基座、底盘...    │
│   └─────┬────┘                          │
│         │                               │
│   ┌─────┴────┐                          │
│   │  动态部件  │  ← 定义"在做什么"       │
│   │ (动画变化) │     弹道口、翅膀、特效...  │
│   └──────────┘                          │
└─────────────────────────────────────────┘
```

### 3.2 部件类型库

所有实体都从以下部件类型库中选取组合:

| 部件类型 | PixiJS 绘制方式 | 参数 |
|----------|----------------|------|
| `body_rect` | `g.rect()` + `g.fill()` | x, y, w, h, color |
| `body_circle` | `g.circle()` + `g.fill()` | x, y, radius, color |
| `body_hexagon` | `g.poly()` 6点 | x, y, radius, color |
| `body_triangle` | `g.poly()` 3点 | x, y, size, rotation, color |
| `outline` | `g.stroke()` 在 fill 之后 | width, color |
| `symbol_sword` | 十字形（rect横+rect竖） | x, y, size, rotation, color |
| `symbol_shield` | 半圆弧 + rect | x, y, size, color |
| `symbol_bow` | 弧线（arc） | x, y, radius, angle, color |
| `symbol_crown` | 3个三角形 | x, y, size, color |
| `symbol_wings` | 2个拉伸三角形 | x, y, size, spread, color |
| `symbol_halo` | 空心圆（arc + stroke） | x, y, radius, color, alpha |
| `symbol_crystal` | 六边形 + 内切菱形 | x, y, size, color |
| `symbol_coil` | 螺旋线（多段 arc） | x, y, radius, turns, color |
| `deco_spikes` | N个三角形径向排列 | x, y, count, size, color |
| `deco_particles` | N个小圆环绕 | x, y, count, radius, color, alpha |
| `deco_glow` | 径向渐变模拟（多层半透明圆） | x, y, radius, color |

### 3.3 绘制流程

每帧绘制实体的 `Graphics` 对象:

```
1. g.clear()
2. 根据当前动画状态机的 state, phase 计算各部件的 transform
3. 绘制动态部件（最底层）—— 如翅膀展开、脚下光环
4. 绘制基础部件 —— 主体身体/基座
5. 绘制身份部件 —— 武器符号、皇冠、特殊标记
6. 绘制状态覆盖 —— 受击闪白、冰冻蓝、眩晕金星
7. 绘制选中高亮 —— 白色描边 + 虚线环
```

---

## 四、动画状态机

### 4.1 状态定义

```
                    ┌──────────────┐
          ┌────────→│    IDLE      │←─────────┐
          │         │  (待机/巡逻)   │          │
          │         └───┬─────┬────┘          │
          │             │     │               │
          │    目标进入范围│     │受到伤害       │
          │             │     │               │
          │         ┌───▼──┐ ┌▼────┐          │
          │         │ATTACK│ │ HIT │          │
          │         │(攻击) │ │(受击)│          │
          │         └───┬──┘ └──┬──┘          │
          │             │       │              │
          │   攻击完成   │       │受击动画完成    │
          │             │       │              │
          │             └───┬───┘              │
          │                 │                  │
          │                 │                  │
┌─────────┴──┐         ┌────▼────┐      ┌─────┴─────┐
│   SPAWN    │         │  DEATH  │      │  SPECIAL  │
│  (出生/建造)│         │  (死亡)  │      │(特殊/BOSS) │
└────────────┘         └─────────┘      └───────────┘
      │                      │                │
      │ 动画完成              │ 动画完成        │ 条件结束
      ▼                      ▼                ▼
    IDLE                  移除实体           IDLE
```

### 4.2 各状态视觉规范

#### SPAWN（出生/建造）

| 参数 | 值 |
|------|-----|
| **持续时间** | 0.3s（普通）/ 0.5s（BOSS） |
| **scale 动画** | 0 → 1.1 → 1.0（弹性缓出） |
| **alpha 动画** | 0 → 1 |
| **粒子效果** | 建造完成粒子（金色方块从基座上升） |
| **缓动函数** | `easeOutBack` (overshoot 1.1) |

**PixiJS 实现**:
```typescript
// 使用 elasticOut: c1 * sin, c2 * cos 近似
function elasticOut(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
}
```

#### IDLE（待机）

每个单位有独特的待机动画，防止场景僵硬:

| 单位类别 | 待机动画 | 参数 |
|----------|----------|------|
| **塔** | 基座不动，塔身微小上下浮动 | `yOffset = sin(time * 2) * 1` px |
| **我方单位** | 呼吸摇摆 | `rotation = sin(time * 1.5) * 0.03` rad |
| **移动中敌人** | 步行弹跳 | `yOffset = abs(sin(time * speed * 0.05)) * 2` px |
| **中立建筑** | 间歇脉动 | `scale = 1 + sin(time * 0.8) * 0.03` |
| **陷阱** | 微光呼吸 | `alpha = 0.6 + sin(time * 1.2) * 0.2` |

**特有单位待机特效**:

| 单位 | 额外待机特效 |
|------|-------------|
| 冰塔 | 冰晶缓慢旋转 `rotation += dt * 0.5` |
| 电塔 | 线圈间电弧跳动（间歇生成短线） |
| 激光塔 | 晶体发光脉动 `alpha = baseAlpha + sin(time * 2) * 0.2` |
| 蝙蝠塔 | 休眠时翅膀收起，激活时展开 + 暗影粒子 |
| 祭司 | 光环周围光点漂浮 |
| 工程师 | 齿轮粒子绕身旋转 |
| Boss | 脚下光环脉动 `scale pulse: 1 → 1.05 → 1` |

#### ATTACK（攻击）

| 参数 | 值 |
|------|-----|
| **持续时间** | 取决于攻速（attackSpeed），通常 0.15-0.4s |
| **前摇阶段** | 0-40% 时间：蓄力/拉弓/炮口后座 |
| **释放阶段** | 40-60% 时间：弹道生成 + 闪亮 |
| **后摇阶段** | 60-100% 时间：恢复 IDLE |

**各塔攻击动画**:

| 塔 | 前摇动画 | 释放动画 | 后摇动画 |
|----|----------|----------|----------|
| **箭塔** | 塔身微后倾（rotation -0.05） | 弹回 + 箭头粒子爆发 | 微小余震 2 次 |
| **炮塔** | 炮口后坐（xOffset -3px） | 弹回 + 橙色闪光 | 炮口烟雾粒子 |
| **冰塔** | 冰晶加速旋转 | 冰晶闪光 + 冰晶粒子爆发 | 旋转减速 |
| **电塔** | 线圈电弧加速跳动 | 放电针闪光 + 闪电生成 | 残留小电弧 |
| **激光塔** | 晶体亮度增加 | 光束生成 + 持续 0.15s | 晶体亮度回落 |
| **蝙蝠塔** | 翼展加大+暗影粒子凝聚+转身锁定（详见 [12-视觉特效 §9](./12-visual-effects.md#9-蝙蝠塔攻击动作设计)） | 弧线俯冲+撕咬獠牙+命中粒子爆散+绿光吸血回流 | 回弹归巢+翅膀减速+绿色余光淡出 |

**我方单位攻击动画**:

| 单位 | 前摇动画 | 释放动画 |
|------|----------|----------|
| **盾卫** | 盾牌前移 | 短距前冲 + 震荡波（白色圆扩散） |
| **剑士** | 剑举起（rotation +0.3） | 旋转 360° + 白色弧线 |
| **弓手** | 弓拉满（scale X 压缩） | 放箭 + 弓弹回 |
| **祭司** | 光环收缩 | 光环脉冲扩散 |
| **工程师** | 扳手举起 | 锤击动画 + 目标金色闪 |
| **刺客** | 消失（alpha 0） | 瞬移至目标 + 红色 X 线 |

#### HIT（受击）

| 参数 | 值 |
|------|-----|
| **持续时间** | 0.1s |
| **闪白效果** | 颜色强制变为 `#ffffff`（100ms），然后渐变回原色 |
| **位移** | 微后推 `xOffset = dirToAttacker * 2` px（仅移动单位） |
| **粒子** | 3-5个命中粒子从受击点飞散 |

**Buff/Debuff 视觉覆盖**（与 HIT 状态叠加）:

| 状态 | 视觉修改 | 持续特效 |
|------|----------|----------|
| **减速** | 颜色向 `#4488cc` 渐变 lerp | 脚下蓝色冰面纹 |
| **冰冻** | 颜色 `#00bcd4` + 外包白色冰晶轮廓线 | 完全静止（动画暂停） |
| **眩晕** | 颜色 `#ffd700` 间歇闪烁 | 头顶金色星形旋转 |
| **嘲讽** | 红色描边加粗 2px | 指向嘲讽者的虚线 |

#### DEATH（死亡）

| 参数 | 值 |
|------|-----|
| **普通单位** | scale 1→0 + alpha 1→0，0.3s，同时粒子爆散 |
| **BOSS** | 金色大爆炸（25+粒子）+ 全场 0.3s 闪白 + 0.1s 慢动作 |
| **建筑** | 崩塌动画（子部件逐个下落消散），0.4s |
| **粒子** | 实体颜色圆点，8-15 个，向外飞散 + 缩放消失 |

#### SPECIAL（特殊状态）

| 触发 | 动画 |
|------|------|
| **BOSS 进二阶段** | 白/红闪烁 0.3s + scale 1→1.3 弹性扩张 + 全场暂停 0.3s |
| **建造完成** | scale 0→1 弹性缓出 + 金色粒子上升 |
| **升级完成** | 白色光芒粒子上升 + 短暂放大 scale pulse |

### 4.3 状态机数据结构

```typescript
interface AnimationState {
  current: 'spawn' | 'idle' | 'attack' | 'hit' | 'death' | 'special';
  timer: number;          // 当前状态已持续时间
  phase: number;          // 当前状态内的阶段 (0-1)，用于动画插值
  config: StateConfig;    // 当前状态的参数配置
  nextState: AnimationState['current'] | null;  // 排队的下一个状态
}

interface StateConfig {
  duration: number;       // 状态持续时间
  loop: boolean;          // 是否循环（IDLE = true）
  interruptible: boolean; // 是否可被 HIT 打断
  transitions: Partial<Record<AnimationState['current'], boolean>>;
}
```

### 4.4 状态机更新逻辑

```typescript
function updateAnimationState(state: AnimationState, dt: number, events: GameEvent[]): void {
  state.timer += dt;
  state.phase = Math.min(state.timer / state.config.duration, 1);

  // 检查状态转换
  if (state.config.interruptible) {
    for (const event of events) {
      if (state.config.transitions[event.type]) {
        transitionTo(state, event.type);
        return;
      }
    }
  }

  // 状态自然结束
  if (state.phase >= 1) {
    if (state.config.loop) {
      state.timer = 0;
      state.phase = 0;
    } else if (state.nextState) {
      transitionTo(state, state.nextState);
    } else {
      transitionTo(state, 'idle');
    }
  }
}
```

---

## 五、单位视觉详细设计

### 5.1 塔类 — 6种

#### 箭塔 (Arrow Tower)

```
复合部件:
  基座        body_rect, 32×8, #5d4037 (棕色)
  塔身        body_rect, 10×30, #90a4ae (灰色石砌)
  箭头尖      body_triangle, 14, #4fc3f7 (蓝色)
  射击口      body_rect, 14×4, #37474f (深灰)
  等级菱      deco_diamond × N, #ffd700

待机: 塔身 ±1px 正弦浮动
攻击: 塔身后倾→弹回+箭头闪蓝
```

#### 炮塔 (Cannon Tower)

```
复合部件:
  基座        body_rect, 34×8, #5d4037
  塔身        body_rect, 16×18, #8d6e63 (炮身色)
  炮口        body_circle, r=7, #37474f
  炮口内圈    body_circle, r=5, #1a1a1a (炮膛)
  等级菱      deco_diamond × N, #ffd700

待机: 微小左右瞄准漂移
攻击: 炮口后坐(-3px)→弹回+炮口烟粒子
```

#### 冰塔 (Ice Tower)

```
复合部件:
  基座        body_rect, 30×8, #78909c
  冰晶核心    body_hexagon, r=14, #80deea
  冰晶内芯    body_diamond, r=8, #e0f7fa (浅色内切)
  外围小冰晶  deco_particles, 4个, r=4, #b2ebf2 (待机旋转)
  等级菱      deco_diamond × N, #ffd700

待机: 冰晶缓慢旋转 + 小冰晶绕转
攻击: 冰晶加速旋转→闪光+冰粒子爆发
```

#### 电塔 (Lightning Tower)

```
复合部件:
  基座        body_rect, 30×8, #546e7a
  线圈主体    body_rect, 10×22, #78909c
  线圈环      deco_coil, 3圈, #ffd54f (金色线圈)
  放电针      body_triangle, 8, #ffb300 (顶部)
  等级菱      deco_diamond × N, #ffd700

待机: 线圈间间歇电弧（2条随机短线）
攻击: 电弧加速跳动→针尖闪光+闪电生成
```

#### 激光塔 (Laser Tower)

```
复合部件:
  基座        body_rect, 28×8, #546e7a
  晶体柱      body_rect, 8×24, #4dd0e1 (青色)
  晶体辉光    deco_glow, r=10, #80deea (alpha 0.3，呼吸脉动)
  等级菱      deco_diamond × N, #ffd700

待机: 晶体辉光呼吸脉动 alpha 0.2-0.5
攻击: 晶体亮到峰值→光束生成→回落
```

#### 蝙蝠塔 (Bat Tower)

```
复合部件:
  基座        body_rect, 30×8, #424242
  塔柱        body_rect, 8×20, #616161
  蝙蝠翼      symbol_wings × 2, size=14, #7b1fa2 (紫色)
  蝙蝠身      body_circle, r=5, #4a148c
  等级菱      deco_diamond × N, #ffd700

待机(休眠): 蝙蝠翼收起（scale X 0.3），灰色
待机(激活): 蝙蝠翼展开，紫色 + 暗影粒子环绕
攻击: 翼完全展开→蝙蝠影飞出
```

#### 蝙蝠群成员（Bat Swarm Member）

> 蝙蝠塔生成的独立飞行单位，以群聚行为（boid）在塔周围盘旋，主动搜索并攻击敌人。

```
复合部件（与飞鸟动画同形）:
  身体        body_circle, r=size*0.6, #2d2d2d（深灰）, alpha 0.85
  左翅        triangle, 翼展 size*0.7, #2d2d2d, alpha 0.7
  右翅        triangle, 翼展 size*0.7, #2d2d2d, alpha 0.7

动画:
  翅膀拍动  翅膀展开角度 30°-70° 正弦循环（频率 3-6 Hz）
  上下浮动  正弦波起伏（幅度 5-15px）
  自由飞行  boid 集群算法（分离/对齐/聚集/归巢/游荡）

层: LowAir（在实体层之上）
大小: 10-14px（随等级成长）
```

### 5.2 我方移动单位 — 6种

#### 盾卫 (Shield Guard)

```
复合部件:
  身体        body_rect, 24×24, #42a5f5 (蓝色)
  盾牌        symbol_shield, 正面, size=16, #90caf9
  盾徽        body_circle, r=4, #1e88e5 (盾上标志)
  脚下阴影    body_ellipse, 28×8, rgba(0,0,0,0.3)

待机: 盾牌微光呼吸 alpha 0.8-1.0
移动: 缓慢步行弹跳 ±2px
攻击: 盾牌前冲→震荡波(白色圆扩散)
```

#### 剑士 (Swordsman)

```
复合部件:
  身体        body_rect, 22×22, #42a5f5
  剑刃        body_rect, 3×28, #e0e0e0 (银色)
  剑柄        body_rect, 8×3, #8d6e63
  剑尖        body_triangle, 5, #ffffff
  脚下阴影    body_ellipse, 24×7, rgba(0,0,0,0.3)

待机: 剑尖寒光闪烁 alpha 0.8-1.0
移动: 中等步行弹跳
攻击: 旋转360°(旋风斩) + 白色弧线扩散
```

#### 弓手 (Archer)

```
复合部件:
  身体        body_rect, 20×20, #42a5f5
  弓弧        symbol_bow, arc=π*0.7, r=14, #8d6e63
  弓弦        line, #e0e0e0
  箭袋        body_rect, 4×10, #795548 (背后)
  脚下阴影    body_ellipse, 22×7, rgba(0,0,0,0.3)

待机: 拉弓微蓄力（周期性弦后拉）
移动: 步履轻盈
攻击: 弓拉满→放箭→弓弦弹回
```

#### 祭司 (Priest)

```
复合部件:
  身体        body_rect, 20×22, #66bb6a (绿色系)
  光环        symbol_halo, r=16, #a5d6a7 (头顶圆环)
  光点        deco_particles, 3个, r=2, #ffffff (绕光环)
  法杖        body_rect, 2×18, #8d6e63
  杖顶宝石    body_circle, r=4, #4dd0e1
  脚下阴影    body_ellipse, 22×7, rgba(0,0,0,0.3)

待机: 光环旋转 + 光点漂浮
移动: 飘行（无弹跳，平滑移动）
攻击(治疗): 光环收缩→脉冲扩散(绿色波)
```

#### 工程师 (Engineer)

```
复合部件:
  身体        body_rect, 20×20, #ffa726 (橙色系)
  扳手        symbol_cross(rect×2), size=16, #e0e0e0
  齿轮粒子    deco_particles, 2个小齿轮旋转, #ffcc80
  头盔        body_rect, 18×6, #ff9800 (安全帽)
  脚下阴影    body_ellipse, 22×7, rgba(0,0,0,0.3)

待机: 齿轮绕身旋转
移动: 正常步行弹跳
攻击(修复): 锤击动画 + 目标建筑金色闪烁
```

#### 刺客 (Assassin)

```
复合部件:
  身体        body_rect, 18×22, #7e57c2 (紫色系)
  匕首        body_triangle, 12, #e0e0e0 (细长三角)
  面罩        body_rect, 14×4, #311b92 (眼部横带)
  残影        body_rect × 2, alpha 0.3 (移动时身后)
  脚下阴影    body_ellipse, 20×6, rgba(0,0,0,0.3)

待机: 微微前后重心转移
移动: 快速 + 身后2层残影拖尾
攻击: 消失(alpha→0)→瞬移目标旁→红色X斩击线
```

### 5.3 敌方单位 — 7种

#### 小兵 (Grunt)

```
复合部件:
  身体        body_circle, r=10, #e53935 (红色)
  描边        outline, 1px, #b71c1c
  眼睛        body_circle × 2, r=2, #ffffff (白色)
  瞳孔        body_circle × 2, r=1, #000000

待机: 无（沿路径移动）
移动: 匀速 + 步行弹跳 ±2px
```

#### 快兵 (Runner)

```
复合部件:
  身体        body_ellipse, w=18 h=12, #ff5252 (横向椭圆)
  速度线      body_rect × 2, 4×1, #ff8a80 (身后)
  描边        outline, 1px, #c62828
  眼睛        body_circle × 1, r=2, #ffffff

移动: 快速移动 + 身后速度线残影(alpha递减序列)
```

#### 重装兵 (Heavy)

```
复合部件:
  身体        body_circle, r=16, #c62828
  厚重描边    outline, 3px, #616161 (灰色铠甲)
  护甲铆钉    body_circle × 4, r=1.5, #9e9e9e
  眼睛        body_circle × 2, r=2.5, #ffeb3b (黄色怒目)

移动: 缓慢 + 每步微小震动（shadow 短暂放大）
```

#### 法师 (Mage)

```
复合部件:
  身体        body_hexagon, r=12, #7b1fa2 (紫色)
  魔法粒子    deco_particles, 3个, r=3, #ce93d8 (绕转)
  法杖        body_rect, 2×16, #4a148c
  法杖宝石    body_circle, r=4, #e040fb (杖顶)
  兜帽        body_triangle, 14, #6a1b9a (头顶三角帽)

移动: 中等速度，法杖高举姿态
待机(到达目标): 魔法粒子加速旋转（蓄力感）
```

#### 自爆虫 (Exploder)

```
复合部件:
  身体        body_circle, r=11, #ff6d00
  锯齿外圈    deco_spikes, 8个, size=4, #ff3d00 (不规则轮廓)
  核心脉动    body_circle, r=5, #ffab00 (内部闪烁)
  描边        outline, 2px, #dd2c00 (不规则抖动)

移动: 快速 + 身体不规则脉动（scale 1.0-1.2 快速循环）
死亡: 大爆炸粒子 + 屏幕微震
```

#### Boss · 指挥官 (Commander)

```
复合部件:
  身体        body_circle, r=24, #ffd54f (金色)
  厚重描边    outline, 3px, #ff8f00
  皇冠        symbol_crown, size=16, #ffab00 (头顶三三角)
  脚下光环    symbol_halo, r=28, #ffd54f alpha=0.4 (脉动)
  眼睛        body_circle × 2, r=3, #ff6d00 (怒目)
  披风        body_triangle, 20, #e65100 (背后披风)
  HP条        body_rect, 60×8, #4caf50 (Boss大血条)

移动: 慢速沉稳，身后跟随2-3个小兵视觉
二阶段: 颜色变红 #d32f2f，scale 1.3，光环变成红色脉动
```

#### Boss · 攻城兽 (Siege Beast)

```
复合部件:
  身体        body_circle, r=28, #e65100 (深橙色)
  背部尖刺    deco_spikes, 4根, size=14, #bf360c (背上)
  厚重描边    outline, 4px, #3e2723 (暗色厚甲)
  眼睛        body_circle × 2, r=3, #ffeb3b (小黄眼)
  地面裂纹    body_line × 3, #4e342e (脚下随机裂纹)
  HP条        body_rect, 70×8, #4caf50

移动: 极慢，每步地面裂纹扩散动画
二阶段: 背部尖刺变大 + 全身红色辉光
```

### 5.4 中立/建筑 — 6种

#### 金矿 (Gold Mine)

```
复合部件:
  建筑主体    body_rect, 28×24, #ffc107 (金色)
  金币符号    body_circle, r=8, #ffd54f (顶部)
  $符号       body_line(竖+弧), #ff8f00 (金币上)
  闪光        body_rect × 1, alpha 0→0.8→0 (间歇闪)

待机: 金币间歇闪烁 + 飘出小金币粒子
```

#### 能量塔 (Energy Tower)

```
复合部件:
  建筑主体    body_rect, 24×28, #7b1fa2
  能量球      body_circle, r=10, #e040fb (顶部)
  辉光        deco_glow, r=14, #ce93d8 alpha=0.4 (脉动)
  上升粒子    body_rect × 3, 2×6, #b39ddb (蓝色粒子上升)

待机: 能量球脉动 + 粒子上升
```

#### 尖刺陷阱 (Spike Trap)

```
复合部件:
  基座        body_rect, 24×6, #616161 (地面板)
  尖刺×3      body_triangle, 10, #e53935 (三个三角聚簇)

待机: 半透明 alpha 0.6
触发: 尖刺弹出(scale快速变大) + 红色闪烁
```

#### 治疗泉水 (Healing Spring)

```
复合部件:
  泉基        body_hexagon, r=14, #26c6da
  中央波纹    body_circle(r=4→12, alpha 1→0, 循环扩散) × 3层
  水面光点    deco_particles, 5个, r=1.5, #b2ebf2

待机: 三层波纹持续循环扩散
```

#### 金币宝箱 (Gold Chest)

```
复合部件:
  箱体        body_rect, 20×16, #ffc107
  箱盖        body_rect, 22×6, #ffb300 (半开状态)
  锁扣        body_circle, r=3, #ff8f00
  闪光        deco_glow, r=8, #ffd54f alpha 0→0.6→0 (间歇)

待机: 间歇闪光
```

#### 基地 (Base)

```
复合部件:
  建筑主体    body_hexagon, r=22, #1e88e5 (蓝色)
  护盾光环    symbol_halo, r=26, #42a5f5 alpha=0.3 (脉动)
  旗帜        body_rect(杆)+body_triangle(旗面), #ffffff
  HP条        body_rect, 50×8, #4caf50 (常显)

待机: 护盾光环持续脉动
```

#### 出生点 (Spawn Portal)

```
复合部件:
  门框        body_rect(轮廓), 30×24, #ff5722
  内部黑暗    body_rect, 26×20, #1a0000
  边缘粒子    deco_particles, 沿边缘, r=2, #ff8a65

待机: 边缘粒子缓慢飘动
敌人出现: 扩散波(圆 alpha 1→0 从中心扩散)
```

---

## 六、弹道增强设计

### 6.1 弹道系统架构

每个弹道 = `PixiJS Container` (+ `Graphics`), 生命周期:

```
创建 → 飞行(t) → 命中 → 粒子爆发 → 销毁
```

### 6.2 各弹道视觉规范（增强版）

| 塔 | 弹道形状 | 飞行曲线 | 尾迹 | 命中特效 |
|----|---------|----------|------|----------|
| **箭塔** | 细长三角(头)+细矩形(杆) | 直线 | 3个蓝色粒子渐小跟随 | 白色6粒子星爆 |
| **炮塔** | 橙色圆, r=6 | 抛物线(重力弧) | 灰色烟迹粒子 | 橙红15粒子爆炸+屏幕微震 |
| **冰塔** | 蓝色菱形, size=10 | 直线 | 4个冰晶粒子螺旋尾迹 | 白色冰雾圆扩散(冻结触发) |
| **电塔** | 锯齿闪电(3段折线) | 瞬时(0.05s) | 不需要，瞬达 | 目标闪黄+电弧跳下一目标 |
| **激光塔** | 青色细长矩形(2×射程) | 持续光束(0.15s) | 渐变淡出两端 | 敌人短暂青辉光 |
| **蝙蝠塔** | 紫色蝙蝠形(翼+身) | 弧线(飞去+飞回) | 紫色暗影粒子拖尾 | 绿色微光回流(吸血) |

### 6.3 抛物线弹道算法（炮塔）

```typescript
function updateParabolicProjectile(
  pos: {x: number, y: number},
  start: {x: number, y: number},
  end: {x: number, y: number},
  t: number,           // 0 → 1
  arcHeight: number,   // 弧高(px)
): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  pos.x = start.x + dx * t;
  pos.y = start.y + dy * t - arcHeight * 4 * t * (1 - t); // 抛物线
}
```

### 6.4 闪电弹道算法（电塔）

```typescript
function generateLightningPath(
  start: Vec2, end: Vec2, segments: number = 3, jitter: number = 20
): Vec2[] {
  const points: Vec2[] = [start];
  const dx = (end.x - start.x) / segments;
  const dy = (end.y - start.y) / segments;
  for (let i = 1; i < segments; i++) {
    points.push({
      x: start.x + dx * i + (Math.random() - 0.5) * jitter,
      y: start.y + dy * i + (Math.random() - 0.5) * jitter,
    });
  }
  points.push(end);
  return points;
}
```

---

## 七、主题视觉整合

### 7.1 每个主题的完整视觉设定

#### 草原 Plains（关卡1）

| 层 | 设定 |
|----|------|
| 天空 | `#87CEEB`→`#E8F5E9` 渐变，白云飘动 |
| 远景 | 3层深浅绿色三角形山丘 |
| 地面 | 绿地 `#7cb342`，棕土路 `#8d6e63` |
| 装饰 | 绿三角树、绿圆灌木、粉红花丛 |
| 氛围光 | 暖色调，略偏黄 |

#### 沙漠 Desert（关卡2）

| 层 | 设定 |
|----|------|
| 天空 | `#FF9800`→`#FFE0B2` 渐变，无云(或淡黄薄云) |
| 远景 | 沙丘弧线 + 远三角金字塔 |
| 地面 | 沙黄 `#e6c44d`，土褐路 `#bfa045` |
| 装饰 | 岩石、仙人掌、枯骨 |
| 氛围光 | 强暖光 + 淡黄色调覆盖 |

#### 冰原 Tundra（关卡3）

| 层 | 设定 |
|----|------|
| 天空 | `#BBDEFB`→`#ECEFF1`，极光弧带（半透明彩色渐变） |
| 远景 | 白+浅蓝三角形雪山 |
| 地面 | 白 `#cfd8dc`，冰蓝路 `#90a4ae`，路面永久减速指示(微蓝叠加) |
| 装饰 | 冰晶、雪松、冰封岩石 |
| 氛围光 | 冷蓝色调 |

#### 火山 Volcano（关卡4）

| 层 | 设定 |
|----|------|
| 天空 | `#D32F2F`→`#1A0000` 深红渐变 |
| 远景 | 火山锥 + 顶部橙黄发光 + 烟柱 |
| 地面 | 焦黑 `#4e342e`，暗红路 `#5d4037`，岩浆 block 红色脉动 |
| 装饰 | 熔岩裂缝(红橙发光纹)、枯树、火山岩 |
| 氛围光 | 暗红 + 橙色 flicker (模拟火光) |

#### 城堡 Castle（关卡5）

| 层 | 设定 |
|----|------|
| 天空 | `#1A237E`→`#37474F` 深蓝→暗灰 |
| 远景 | 城堡剪影（城垛锯齿+尖塔三角） |
| 地面 | 暗石 `#37474f`，石板路 `#546e7a` |
| 装饰 | 石柱、火炬台(火光照亮周围)、碎石堆 |
| 氛围光 | 暗沉 + 火炬 flicker 暖光点 |

### 7.2 氛围光实现

```typescript
// 全屏颜色叠加 (Layer 8 ScreenFXLayer)
function applyThemeTint(graphics: Graphics, theme: Theme): void {
  const tint = theme.ambientTint; // { color: string, alpha: number }
  graphics.clear();
  graphics.rect(0, 0, 1920, 1080);
  graphics.fill({ color: tint.color, alpha: tint.alpha });
  graphics.blendMode = 'multiply'; // 或 'screen' 根据主题
}
```

---

## 八、性能设计

### 8.1 绘制策略分层

| 层 | 重绘策略 | 说明 |
|----|----------|------|
| BackgroundLayer | 脏标记，仅主题切换时重绘 | 静态内容，无逐帧变化 |
| GroundLayer | 脏标记，建造/回收时重绘 | Tile 内容静态，仅可建区变化 |
| DecorationLayer | 创建时绘制，不再重绘 | 装饰物不移动不变形 |
| ShadowLayer | 每帧重绘（少量 Graphics） | 阴影跟随实体位置 |
| EntityLayer | 每帧重绘（全部实体） | 动画驱动，必须逐帧更新 |
| ProjectileLayer | 每帧重绘 | 弹道飞行 |
| EffectLayer | 每帧更新粒子位置 | ParticleContainer 批量 |
| WeatherLayer | 每帧更新粒子位置 | ParticleContainer 批量 |

### 8.2 优化关键点

1. **Graphics 复用**: 实体 `Graphics` 对象不每帧新建，而是 `g.clear()` 后重绘
2. **形状缓存**: 静态部件（如塔基座）缓存在 `Graphics` 中，仅动画部件每帧更新
3. **ParticleContainer**: 天气和特效粒子使用 `ParticleContainer`（WebGL 批处理），而非逐对象渲染
4. **脏标记系统**: 非动态层仅在变化时重绘
5. **LOD** (远处/非焦点实体):
   - 屏幕外的实体: 不绘制
   - 距离远的实体: 减少绘制细节（如省略小光点粒子）

### 8.3 性能预算

```
60fps = 16.67ms per frame

预算分配:
  BackgroundLayer    0ms (不重绘)
  GroundLayer        0ms (不重绘)
  DecorationLayer    0ms (不重绘)
  ShadowLayer        0.5ms (简单椭圆)
  EntityLayer        6ms (主要开销，200实体各30μs)
  ProjectileLayer    1ms (少量弹道)
  EffectLayer        2ms (粒子物理+绘制，ParticleContainer)
  WeatherLayer       1ms (ParticleContainer)
  ScreenFXLayer      0.5ms (简单矩形)
  UILayer            2ms (UI更新+绘制)
  其他(Game Loop)    3.67ms
  ─────────────────────
  总计               16.67ms
```

---

## 九、色彩调色板

### 9.1 阵营色

```
我方 (Player):    #1e88e5 (蓝), #42a5f5, #90caf9, #4fc3f7
敌方 (Enemy):     #e53935 (红), #c62828, #ff5252, #ff6d00
中立 (Neutral):   #ffc107 (金), #ffb300, #26c6da (青)
Boss:             #ffd54f (金), #ffab00, #d32f2f (二阶段)
```

### 9.2 状态色

```
受击闪白:         #ffffff
冰冻:             #00bcd4
减速:             #4488cc
眩晕:             #ffd700
中毒:             #76ff03
治疗:             #69f0ae
护盾:             #e0e0e0 (半透明)
```

### 9.3 UI 功能色

```
合法建造:         #66bb6a (绿)
非法建造:         #ef5350 (红)
可建区域高亮:     #81c784 (淡绿半透明)
选中高亮:         #ffffff (白描边)
HP 绿:            #4caf50
HP 黄:            #ffc107
HP 红:            #f44336
```

---

## 十、实现路线图

### 阶段 1: 场景分层基础（2天）

1. 建立 11 层 Container 架构（`PixiApp.ts` 扩展）
2. 实现 Layer 0 BackgroundLayer（天空渐变 + 远景几何，5个主题）
3. 实现 Layer 1 GroundLayer（Tile 纹理增强 + 主题色支持）
4. 实现 Layer 2 DecorationLayer（装饰物复合几何体重制）
5. 实现 Layer 8 ScreenFXLayer（屏幕震动、闪白、转场、暗角）

### 阶段 2: 复合几何体 + 动画状态机（3天）

6. 实现 AnimationStateMachine（状态定义 + 转换逻辑）
7. 实现实体 CompositeShape 绘制系统（部件类型库 + 组装）
8. 重制 6种塔的复合几何体 + 动画
9. 重制 6种我方单位的复合几何体 + 动画
10. 重制 7种敌人的复合几何体 + 动画
11. 重制 6种中立/建筑的复合几何体 + 动画

### 阶段 3: 视觉特效升级（2天）

12. 实现粒子系统（ParticleContainer 批量）
13. 重制弹道系统（抛物线、闪电、光束、弧线）
14. 实现天气粒子（5种天气的程序化粒子 + 过渡动画）
15. 实现 Layer 3 ShadowLayer（实体投影）
16. 实现金币飞行、建造/升级/回收特效

### 阶段 4: 主题整合 + 性能优化（1天）

17. 5个主题的完整视觉调色
18. 氛围光系统（全屏色调 + 动态 flicker）
19. 性能压测 + 优化（ParticleContainer、脏标记、LOD）
20. 最终视觉验收（60fps 稳定，200 实体 + 500 粒子）

---

## 十一、与现有设计的对齐

| 现有设计文档 | 本设计的对应 |
|-------------|-------------|
| `12-visual-effects.md` §2 渲染架构 | **升级**: 7层 → 11层，增加 ShadowLayer、ScreenFXLayer、WeatherLayer 独立 |
| `12-visual-effects.md` §3 单位视觉语言 | **升级**: 单形状 → 复合几何体，保持符号特征和配色 |
| `12-visual-effects.md` §6 动画系统 | **升级**: 散列动画 → 统一状态机 (SPAWN/IDLE/ATTACK/HIT/DEATH) |
| `09-ui-ux.md` 符号优于文字 | **保持**: 场景零文字，纯视觉识别 |
| `07-map-level-system.md` §5 主题配色 | **保持**: 配色表原样使用 |
| `11-weather-system.md` §4 天气特效 | **升级**: 独立 WeatherLayer + 程序化粒子 |
| `15-refactoring-plan.md` 阶段2 渲染升级 | **对齐**: PixiJS WebGL 架构，6个新渲染器 |

---

## 十二、等级升级视觉变化

> 所有可升级单位（6种塔 + 2种生产建筑）在不同等级拥有独特的视觉表现。通过**体型增长**、**部件增加**、**等级菱标识**、**辉光强度**、**粒子特效**五个维度逐级强化视觉辨识度。

### 12.1 通用升级视觉规律

所有可升级单位遵循统一的五级递进规则：

```
L1 «基础»     L2 «成长»     L3 «觉醒»      L4 «精进»      L5 «完美»
────────────────────────────────────────────────────────────────────
无等级菱      1个等级菱      2个等级菱       3个等级菱       4个等级菱
基础尺寸      尺寸 +3px      尺寸 +6px       尺寸 +9px       尺寸 +13px
无辉光        无辉光        微辉光(α0.15)   中辉光(α0.25)   强辉光(α0.4)
无装饰粒子    无装饰粒子    少量装饰粒子     中等装饰粒子    大量装饰粒子
基础配色      基础配色      配色加饱和      描边+1px        描边+2px(金)
```

#### 12.1.1 等级菱（Level Diamond）

每个可升级单位在底座下方排列金色菱形（`deco_diamond`，`#ffd700`），数量 = 等级 - 1：

```
等级菱排列规则:
  - 水平居中于单位下方，间距 6px
  - 每个等级菱尺寸: 4px
  - L5 时等级菱额外附加金色辉光（alpha 0.3）
  
排列示意（俯视）:
  L1:  [无]
  L2:  [◆]
  L3:  [◆ ◆]
  L4:  [◆ ◆ ◆]
  L5:  [◆ ◆ ◆ ◆] ✦ 辉光
```

#### 12.1.2 辉光系统

辉光通过多层半透明圆（`deco_glow`）叠加实现，在实体脚下渲染：

| 等级 | 辉光层数 | 辉光颜色 | alpha | 最大半径 | 脉动幅度 |
|------|---------|----------|-------|----------|----------|
| L1 | 0 | — | — | — | — |
| L2 | 0 | — | — | — | — |
| L3 | 1 | 单位主色 | 0.15 | 尺寸+6px | ±5% |
| L4 | 2 | 单位主色 | 0.25 | 尺寸+12px | ±8% |
| L5 | 3 | 单位主色+金色混合 | 0.4 | 尺寸+20px | ±12% |

#### 12.1.3 装饰粒子系统

| 等级 | 粒子数 | 粒子半径 | 颜色 | 行为 |
|------|--------|----------|------|------|
| L1 | 0 | — | — | — |
| L2 | 0 | — | — | — |
| L3 | 2-3 | 1.5px | 单位主色 | 底座周围缓慢漂浮 |
| L4 | 4-6 | 2px | 单位主色 + 白色 | 绕单位轨道旋转 |
| L5 | 8-12 | 2.5px | 单位主色 + 金色 | 上升螺旋 + 轨道旋转 |

#### 12.1.4 L3 被动技能视觉解锁

L3 是关键的视觉转折点——每个塔在此时解锁被动技能，同时获得对应的常驻视觉特效：

| 塔 | L3 被动 | 视觉解锁 |
|----|---------|----------|
| 箭塔 | 精准射击（15% 2×暴击） | 箭头尖端间歇金色闪光（每 0.5-1.5s 随机闪） |
| 炮塔 | 集束弹药（AOE+30%，溅射↑80%） | 炮口攻击时额外橙色光环扩散 |
| 冰塔 | 碎裂（冰冻结束 30 AOE伤害） | 被冰冻敌人出现裂纹纹理（白色折线叠加） |
| 电塔 | 过载（弹跳+2，衰减↓15%） | 电弧从黄色升级为亮白黄色 |
| 激光塔 | 无（贯穿增强内建于成长） | — |
| 蝙蝠塔 | 无（蝙蝠数量内建于成长） | — |

#### 12.1.5 升级完成瞬间动画

单位升级时触发统一动画（在 `onUpgrade` 生命周期事件中执行）：

```
1. 白色光芒粒子从底座爆发上升（8-12个，r=3-5px，#ffffff）
2. scale 动画: 1.0 → 1.2 → 1.0（elasticOut，0.3s）
3. 辉光 alpha: 0 → 目标值（0.2s 淡入）
4. 等级菱: scale 0 → 1.0（backOut，0.25s，逐个微延迟 0.05s）
5. 音效: SFX_TOWER_UPGRADE
```

---

### 12.2 各塔逐级视觉设计

#### 12.2.1 箭塔 (Arrow Tower) — `#4fc3f7`

```
L1 «基础箭塔»
  基座      body_rect, 32×8, #5d4037
  塔身      body_rect, 10×30, #90a4ae
  箭头尖    body_triangle, 14↑, #4fc3f7
  射击口    body_rect, 14×4, #37474f
  尺寸: 36px

L2 «强化箭塔»
  基座      body_rect, 34×8, #5d4037（+2 宽）
  塔身      body_rect, 12×32, #90a4ae（+2 宽,+2 高）
  箭头尖    body_triangle, 16↑, #4fc3f7（+2）
  射击口    body_rect, 16×4, #37474f（+2 宽）
  等级菱    1个 ◆ #ffd700
  尺寸: 39px

L3 «精准箭塔»  ⚡ L3被动解锁：箭头尖端间歇金色闪光(0.5-1.5s随机)
  基座      body_rect, 36×9, #5d4037
  塔身      body_rect, 14×34, #90a4ae
  箭头尖    body_triangle, 18↑, #4fc3f7
  射击口    body_rect, 18×5, #37474f
  弓臂装饰  body_arc(左右各一), r=6, #8d6e63（新增拉弓弧装饰）
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow, r=24, #4fc3f7, α0.15
  尺寸: 42px

L4 «精制箭塔»
  基座      body_rect, 38×10, #5d4037，描边 1px #3e2723
  塔身      body_rect, 16×36, #90a4ae（+2 宽）
  箭头尖    body_triangle, 20↑, #4fc3f7
  射击口    body_rect, 20×5, #37474f
  弓臂装饰  body_arc, r=8, #8d6e63（+2）
  铆钉装饰  body_circle ×2, r=1.5, #ffd700（塔身两侧金色铆钉）
  等级菱    3个 ◆◆◆ #ffd700
  中辉光    deco_glow, r=28, #4fc3f7, α0.25
  装饰粒子  3个蓝色光点在空中漂浮
  尺寸: 45px

L5 «至尊箭塔»  ⭐ 终极形态
  基座      body_rect, 42×12, #5d4037，金色描边 2px #ffd700
  塔身      body_rect, 18×38, #90a4ae（+2 宽）
  三箭头     body_triangle ×3, 扇形排列 20°间隔, 中间20↑/两侧14↑, #4fc3f7
  射击口    body_rect, 22×6, #37474f
  弓臂装饰  body_arc, r=10, #ffd700（金色弓臂）
  塔顶光点  body_circle, r=3, #ffffff, α0.8 间歇闪烁
  等级菱    4个 ◆◆◆◆ #ffd700 + 金色辉光 α0.3
  强辉光    deco_glow ×2, r=24/36, #4fc3f7, α0.4
  装饰粒子  6个蓝+3个金色光点绕塔螺旋上升
  尺寸: 49px
```

#### 12.2.2 炮塔 (Cannon Tower) — `#ff8a65`

```
L1 «基础炮塔»
  基座      body_rect, 34×8, #5d4037
  塔身      body_rect, 16×18, #8d6e63
  炮口      body_circle, r=7, #37474f
  炮膛      body_circle, r=5, #1a1a1a（内圈暗色）
  尺寸: 38px

L2 «强化炮塔»
  基座      body_rect, 36×9, #5d4037
  塔身      body_rect, 18×20, #8d6e63
  炮口      body_circle, r=8, #37474f（+1）
  炮膛      body_circle, r=6, #1a1a1a
  等级菱    1个 ◆ #ffd700
  尺寸: 41px

L3 «集束炮塔»  ⚡ L3被动：炮口攻击时额外橙色光环扩散(r=100,α0.2,持续0.15s)
  基座      body_rect, 38×10, #5d4037
  塔身      body_rect, 20×22, #8d6e63
  炮口      body_circle, r=9, #37474f
  炮膛      body_circle, r=7, #1a1a1a
  加固环    body_circle(stroke), r=11, #616161, 2px（炮口外加固钢环）
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow, r=24, #ff8a65, α0.15
  尺寸: 44px

L4 «重装炮塔»
  基座      body_rect, 40×12, #5d4037，描边 1px #3e2723
  塔身      body_rect, 22×24, #8d6e63（钢板焊接线纹理: body_line ×2, #a1887f）
  炮口      body_circle, r=10, #37474f
  炮膛      body_circle, r=8, #1a1a1a（更深的膛）
  加固环    body_circle(stroke), r=13, #616161, 2px
  底座铆钉  body_circle ×4, r=2, #9e9e9e（四角铆钉）
  等级菱    3个 ◆◆◆ #ffd700
  中辉光    deco_glow, r=30, #ff8a65, α0.25
  装饰粒子  4个橙色火花粒子漂浮
  尺寸: 47px

L5 «毁灭炮塔»  ⭐ 终极形态
  基座      body_rect, 44×14, #5d4037，金色描边 2px #ffd700
  塔身      body_rect, 24×26, #8d6e63，双焊接线
  主炮口    body_circle, r=12, #37474f（加大炮口）
  副炮口×2  body_circle ×2, r=5, #455a64（两侧副炮）
  主炮膛    body_circle, r=9, #1a1a1a，内圈渐亮
  加固环    body_circle(stroke), r=15, #ffd700, 2px（金色加固环）
  炮口火焰  body_triangle 倒三角, 8, #ff6e40, α0.6（常驻小火苗，间歇扩大）
  等级菱    4个 ◆◆◆◆ #ffd700 + 金色辉光 α0.3
  强辉光    deco_glow ×2, r=30/45, #ff8a65, α0.4
  装饰粒子  4个橙色火星 + 3个灰色烟粒绕炮口飘散
  尺寸: 51px
```

#### 12.2.3 冰塔 (Ice Tower) — `#81d4fa`

```
L1 «基础冰塔»
  基座      body_rect, 30×8, #78909c
  冰晶核心  body_hexagon, r=14, #80deea
  冰晶内芯  body_diamond, r=8, #e0f7fa
  小冰晶×4  deco_particles, 4个 r=4, #b2ebf2（均匀环绕，待机旋转）
  尺寸: 34px

L2 «强化冰塔»
  基座      body_rect, 32×9, #78909c
  冰晶核心  body_hexagon, r=16, #80deea（+2）
  冰晶内芯  body_diamond, r=10, #e0f7fa
  小冰晶×6  deco_particles, 6个 r=4.5, #b2ebf2（+2个，环绕加速）
  等级菱    1个 ◆ #ffd700
  尺寸: 37px

L3 «碎裂冰塔»  ⚡ L3被动：冰冻敌人出现裂纹纹理(白色折线×3叠加，α0.7，持续到解冻)
  基座     body_rect, 34×10, #78909c
  冰晶核心 body_hexagon, r=18, #80deea
  冰晶内芯 body_diamond, r=12, #e0f7fa
  中层冰环 body_hexagon(stroke), r=20, #b2ebf2, 1px（新增六边冰环轮廓）
  小冰晶×8 deco_particles, 8个 r=5, #b2ebf2（+2个，双层轨道旋转）
  等级菱   2个 ◆◆ #ffd700
  微辉光   deco_glow, r=24, #81d4fa, α0.15
  尺寸: 40px

L4 «寒冰塔»
  基座     body_rect, 36×11, #78909c，白色霜纹描边 #b0bec5
  冰晶核心 body_hexagon, r=20, #80deea
  冰晶内芯 body_diamond, r=13, #e0f7fa
  中层冰环 body_hexagon(stroke), r=23, #b2ebf2, 1.5px
  小冰晶×10 deco_particles, 10个 r=5, #b2ebf2（三层轨道）
  冰晶尖刺 body_triangle ×6, size=4, #b2ebf2（冰环外侧六角尖刺）
  等级菱   3个 ◆◆◆ #ffd700
  中辉光   deco_glow, r=30, #81d4fa, α0.25
  装饰粒子 5个冰蓝雪花粒子漂浮，缓慢下落
  尺寸: 43px

L5 «极寒冰塔»  ⭐ 终极形态
  基座     body_rect, 40×13, #78909c，金色描边 2px #ffd700，冰霜覆盖
  双核心   body_hexagon ×2, 外层 r=22 #4dd0e1，内层 r=14 #80deea（嵌套双核心）
  核心内芯 body_diamond, r=10, #ffffff（纯白内芯）
  中层冰环 body_hexagon(stroke), r=26, #e0f7fa, 2px
  小冰晶×16 deco_particles, 16个 r=5.5, #e1f5fe（四层轨道，错速旋转）
  冰晶尖刺 body_triangle ×12, size=5, #e0f7fa（密排十二角尖刺）
  顶部极光 body_arc, 180°, r=12, #b3e5fc, α0.6（塔顶微型极光弧）
  等级菱   4个 ◆◆◆◆ #ffd700 + 金色辉光 α0.3
  强辉光   deco_glow ×3, r=22/34/48, #81d4fa, α0.4
  装饰粒子 8个冰晶雪花绕塔螺旋，持续下落+重生循环
  尺寸: 47px
```

#### 12.2.4 电塔 (Lightning Tower) — `#fff176`

```
L1 «基础电塔»
  基座      body_rect, 30×8, #546e7a
  线圈主体  body_rect, 10×22, #78909c
  线圈环×3  deco_coil, 3圈, #ffd54f（金色线圈缠绕塔身）
  放电针    body_triangle, 8↑, #ffb300（顶部单放电针）
  尺寸: 34px

L2 «强化电塔»
  基座      body_rect, 32×9, #546e7a
  线圈主体  body_rect, 12×24, #78909c（+2 宽,+2 高）
  线圈环×4  deco_coil, 4圈, #ffd54f（+1圈）
  放电针    body_triangle, 10↑, #ffb300（+2）
  等级菱    1个 ◆ #ffd700
  尺寸: 37px

L3 «过载电塔»  ⚡ L3被动：电弧颜色从 #ffd54f 升级为 #fff9c4（亮白黄），跳动幅度+20%
  基座      body_rect, 34×10, #546e7a
  线圈主体  body_rect, 14×26, #78909c
  线圈环×5  deco_coil, 5圈, #ffd54f（+1圈）
  放电针×2  body_triangle ×2, 10↑, #ffb300（新增左右各一根放电针，V字形排列）
  微型电弧  body_line ×2, 随机折线, #fff9c4, α0.8（针尖之间间歇跳动）
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow, r=22, #fff176, α0.15
  尺寸: 40px

L4 «雷霆塔»
  基座      body_rect, 36×11, #546e7a
  线圈主体  body_rect, 16×28, #78909c（+2 宽）
  线圈环×6  deco_coil, 6圈, #ffd54f（+1圈）
  放电针×3  body_triangle ×3, 11↑, #ffb300（V字形展开，中间略高）
  微型电弧  body_line ×4, 随机折线, #fff9c4, α0.9（针间持续跳动）
  基座电极  body_circle ×2, r=3, #ffb300, α0.6（基座两侧电极球）
  等级菱    3个 ◆◆◆ #ffd700
  中辉光    deco_glow, r=28, #fff176, α0.25
  装饰粒子  4个电火花粒子快速无规则运动
  尺寸: 43px

L5 «雷神之塔»  ⭐ 终极形态
  基座      body_rect, 40×13, #546e7a，金色描边 2px #ffd700
  线圈主体  body_rect, 18×30, #78909c
  线圈环×8  deco_coil, 8圈, #ffd700（+2圈，升级为金色）
  放电针×5  body_triangle ×5, 10-14↑（扇形展开，中间最高），#ffb300
  持续电弧  body_line 折线×6, #ffffff, 针间持续跳动 + 向外延伸（间歇性大电弧跳出50px）
  基座电极  body_circle ×4, r=3.5, #ffb300, α0.8（四个电极球）
  电场光环  deco_glow(stroke), r=20, #fff176, 脉冲闪烁（底部电场环）
  等级菱    4个 ◆◆◆◆ #ffd700 + 金色辉光 α0.3
  强辉光    deco_glow ×2, r=26/42, #fff176, α0.4
  装饰粒子  8个电火花以塔为中心不规则飞窜，偶尔形成小电弧链
  尺寸: 47px
```

#### 12.2.5 激光塔 (Laser Tower) — `#00e5ff`

```
L1 «基础激光塔»
  基座      body_rect, 28×8, #546e7a
  晶体柱    body_rect, 8×24, #4dd0e1
  晶体辉光  deco_glow, r=10, #80deea, α0.3（呼吸脉动）
  尺寸: 36px

L2 «强化激光塔»
  基座      body_rect, 30×9, #546e7a
  晶体柱    body_rect, 10×28, #4dd0e1（+2 宽,+4 高）
  晶体辉光  deco_glow, r=12, #80deea, α0.35
  等级菱    1个 ◆ #ffd700
  尺寸: 39px

L3 «聚焦激光塔»
  基座      body_rect, 32×10, #546e7a
  晶体柱    body_rect, 12×32, #4dd0e1（+2 宽,+4 高）
  聚焦透镜  body_diamond, 10, #ffffff, α0.5（晶体顶部悬浮透镜菱形）
  晶体辉光  deco_glow, r=14, #80deea, α0.4
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow(bottom), r=22, #00e5ff, α0.15
  尺寸: 42px

L4 «棱镜激光塔»
  基座      body_rect, 34×11, #546e7a
  晶体柱    body_rect, 14×34, #4dd0e1（+2 宽,+2 高）
  聚焦透镜  body_diamond, 12, #ffffff, α0.6
  副晶体×2  body_rect ×2, 6×20, #26c6da（左右各一小晶体柱，间距6px）
  晶体辉光  deco_glow(top), r=16, #80deea, α0.5
  等级菱    3个 ◆◆◆ #ffd700
  中辉光    deco_glow(bottom), r=28, #00e5ff, α0.25
  装饰粒子  3个青色光子粒子围绕塔柱缓慢上升
  尺寸: 45px

L5 «超新星激光塔»  ⭐ 终极形态
  基座      body_rect, 38×13, #546e7a，金色描边 2px #ffd700
  主晶体    body_rect, 16×36, #00e5ff（颜色升级为纯青）
  聚焦透镜  body_diamond, 14, #ffffff, α0.8
  副晶体×4  body_rect ×4, 6×22, #18ffff（左右各两个副晶体，阶梯排列）
  连接光路  body_line ×2, #80deea, α0.4（主晶体→副晶体连线）
  晶体辉光  deco_glow(top)×2, r=14/22, #00e5ff, α0.6
  等级菱    4个 ◆◆◆◆ #ffd700 + 金色辉光 α0.3
  强辉光    deco_glow(bottom)×2, r=30/48, #00e5ff, α0.4
  装饰粒子  6个青白光子粒子螺旋上升，在透镜处汇聚后重新循环
  尺寸: 49px
```

#### 12.2.6 蝙蝠塔 (Bat Tower) — `#7c4dff`

```
L1 «基础蝙蝠塔»
  基座      body_rect, 30×8, #424242
  塔柱      body_rect, 8×20, #616161
  蝙蝠翼×2  symbol_wings ×2, size=14, #7b1fa2
  蝙蝠身    body_circle, r=5, #4a148c
  尺寸: 34px

L2 «强化蝙蝠塔»
  基座      body_rect, 32×9, #424242
  塔柱      body_rect, 10×22, #616161（+2 宽,+2 高）
  蝙蝠翼×2  symbol_wings ×2, size=16, #7b1fa2（+2 翼展）
  蝙蝠身    body_circle, r=6, #4a148c
  暗影粒子  deco_particles, 2个 r=3, #4a148c, α0.4（塔身周围缓慢飘落）
  等级菱    1个 ◆ #ffd700
  尺寸: 37px

L3 «暗夜蝙蝠塔»
  基座      body_rect, 34×10, #424242
  塔柱      body_rect, 12×24, #616161
  蝙蝠翼×4  symbol_wings ×4, size=17, #7b1fa2（双蝙蝠，上下排列）
  蝙蝠身×2  body_circle ×2, r=6, #4a148c
  暗影粒子  deco_particles, 4个 r=3.5, #6a1b9a, α0.5
  塔顶尖刺  body_triangle, 8↑, #311b92（哥特式塔尖）
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow, r=22, #7c4dff, α0.15
  尺寸: 40px

L4 «深渊蝙蝠塔»
  基座      body_rect, 36×11, #424242
  塔柱      body_rect, 14×26, #616161
  蝙蝠翼×6  symbol_wings ×6, size=18, #7b1fa2（三蝙蝠，三角排列）
  蝙蝠身×3  body_circle ×3, r=6.5, #4a148c
  暗影粒子  deco_particles, 6个 r=4, #6a1b9a, α0.6（粒子速度加快）
  塔顶尖刺  body_triangle, 10↑, #311b92
  暗影光环  body_circle(stroke), r=18, #311b92, α0.3, 1px（塔身暗环）
  等级菱    3个 ◆◆◆ #ffd700
  中辉光    deco_glow, r=26, #7c4dff, α0.25
  尺寸: 43px

L5 «血族圣塔»  ⭐ 终极形态
  基座      body_rect, 40×13, #424242，金色描边 2px #ffd700
  塔柱      body_rect, 16×28, #616161
  蝙蝠翼×8  symbol_wings ×8, size=20, #9c27b0（四蝙蝠，菱形排列+旋转）
  蝙蝠身×4  body_circle ×4, r=7, #6a1b9a
  暗影粒子  deco_particles, 10个 r=5, #7b1fa2, α0.7（密集环绕，仿飞蝠群）
  塔顶尖刺  body_triangle, 12↑, #311b92 + 底部小三角皇冠（3个三角）
  暗影光环  body_circle(stroke), r=22, #9c27b0, α0.5, 2px（脉动暗环）
  血光之眼  body_circle, r=4, #e53935, α0.8（塔顶中心红色光点，间歇脉动）
  等级菱    4个 ◆◆◆◆ #ffd700 + 金色辉光 α0.3
  强辉光    deco_glow ×2, r=24/40, #7c4dff, α0.4
  尺寸: 47px
```

---

### 12.3 生产建筑逐级视觉设计

#### 12.3.1 金矿 (Gold Mine) — `#ffd54f`（L1-L3）

```
L1 «基础金矿»
  建筑主体  body_rect, 24×20, #ffc107
  木支架×2  body_rect ×2, 4×24, #795548（左右木质支撑柱）
  金币符号  body_circle, r=8, #ffd54f（顶部金币）
  金币纹理  body_line(弧形), #ff8f00（金币上的$纹）
  间歇闪光  deco_glow, r=6, #ffd54f, α0→0.6→0（2s 循环）
  尺寸: 36px

L2 «强化金矿»
  建筑主体  body_rect, 28×22, #ffb300（颜色加深）
  石支架×2  body_rect ×2, 5×26, #8d6e63（升级为石质支架）
  大金币    body_circle, r=10, #ffd54f（+2）
  金币纹理  body_line(弧形), #ff8f00
  副金币×2  body_circle ×2, r=5, #ffc107（两侧小金币）
  间歇闪光  deco_glow, r=8, #ffd54f, α 更强
  等级菱    1个 ◆ #ffd700
  尺寸: 39px

L3 «富饶金矿»  ⭐ 满级
  建筑主体  body_rect, 32×24, #ff8f00（深金色）
  金支架×2  body_rect ×2, 6×28, #ffd54f（金色支柱，描边 #ff6f00）
  大金币    body_circle, r=12, #ffd54f
  金币纹理  body_line, #ff8f00
  金币堆×3  body_circle ×3, r=6, #ffc107（底部堆叠三枚金币）
  间歇闪光  deco_glow, r=12, #ffd54f, α0→0.8→0（1.5s 循环，更亮更快）
  飘出金币  deco_particles, 2个小金币 r=3, #ffd54f, 间歇向上飘出
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow(bottom), r=22, #ffd54f, α0.2
  尺寸: 42px
```

#### 12.3.2 能量塔 (Energy Tower) — `#81c784`（L1-L3）

```
L1 «基础能量塔»
  建筑主体  body_rect, 20×26, #7b1fa2（紫色六边形基底 → 改为机身 rect）
  能量球    body_circle, r=9, #e040fb（顶部能量球）
  辉光环    deco_glow, r=13, #ce93d8, α0.35（球体辉光脉动）
  上升粒子  deco_particles, 2个 r=2, #b39ddb, 持续缓慢上升
  尺寸: 34px

L2 «强化能量塔»
  建筑主体  body_rect, 24×28, #6a1b9a（+4 宽,+2 高，颜色加深）
  能量球    body_circle, r=11, #e040fb（+2）
  辉光环    deco_glow, r=16, #ce93d8, α0.45
  上升粒子  deco_particles, 4个 r=2.5, #b39ddb（+2个）
  稳定环    body_circle(stroke), r=13, #e040fb, α0.6, 1px（环绕能量球）
  等级菱    1个 ◆ #ffd700
  尺寸: 37px

L3 «超载能量塔»  ⭐ 满级
  建筑主体  body_rect, 28×30, #4a148c（深紫色，描边 1px #7b1fa2）
  巨大能量球 body_circle, r=14, #ea80fc（增大，颜色更亮）
  内层辉光  deco_glow, r=14, #ffffff, α0.3（内圈白光）
  外层辉光  deco_glow, r=20, #ce93d8, α0.55
  上升粒子  deco_particles, 8个 r=3, #b39ddb（密集上升，螺旋轨迹）
  稳定环×2  body_circle(stroke)×2, r=12/16, #ea80fc（双层稳定环，反向旋转）
  电弧粒子  body_line ×2, #e040fb, α0.4（粒子间偶尔生成小电弧）
  等级菱    2个 ◆◆ #ffd700
  微辉光    deco_glow(bottom), r=24, #81c784, α0.2
  尺寸: 40px
```

---

### 12.4 升级视觉数据表（汇总）

#### 12.4.1 塔类升级视觉参数速查

| 塔 | L1 尺寸 | L5 尺寸 | 等级菱位置 | L3 辉光半径 | L5 辉光半径 | L3 粒子 | L5 粒子 |
|----|---------|---------|-----------|-------------|-------------|---------|---------|
| 箭塔 | 36 | 49 | 基座下方居中 | 24 | 36/24 | 无 | 9个螺旋 |
| 炮塔 | 38 | 51 | 基座下方居中 | 24 | 45/30 | 无 | 7个飘散 |
| 冰塔 | 34 | 47 | 基座下方居中 | 24 | 48/34/22 | 无 | 8个雪花循环 |
| 电塔 | 34 | 47 | 基座下方居中 | 22 | 42/26 | 无 | 8个闪电乱窜 |
| 激光塔 | 36 | 49 | 基座下方居中 | 22 | 48/30 | 3个光子 | 6个光子螺旋 |
| 蝙蝠塔 | 34 | 47 | 基座下方居中 | 22 | 40/24 | 4个暗影 | 10个暗影环绕 |

#### 12.4.2 L3 被动视觉解锁速查

| 塔 | L3 视觉解锁 | 触发条件 | 视觉表现 |
|----|-----------|----------|----------|
| 箭塔 | 暴击闪光 | 攻击时15%概率 | 箭头瞬间金色 `#ffd700`，0.1s 内恢复 |
| 炮塔 | 集束光环 | 每次攻击 | 橙色光环从炮口扩散 r=100, α0.2, 0.15s |
| 冰塔 | 碎裂纹理 | 冰冻目标 | 白色折线×3 在目标身上叠加，解冻时消失 |
| 电塔 | 电弧升级 | 每次攻击 | 电弧颜色 `#fff9c4`（原 `#ffd54f`），跳动+20% |
| 激光塔 | 光束加宽 | 持续 | 激光束宽度从 6px → 8px |
| 蝙蝠塔 | 蝙蝠+1 | 持续 | 蝙蝠群从 4只 → 5只 |

#### 12.4.3 生产建筑升级视觉参数速查

| 建筑 | L1 尺寸 | L3 尺寸 | L3 粒子 | L3 辉光半径 |
|------|---------|---------|---------|-------------|
| 金矿 | 36 | 42 | 2个金币飘出 | 22 (α0.2) |
| 能量塔 | 34 | 40 | 8个粒子螺旋+电弧 | 24 (α0.2) |

---

### 12.5 实现说明

#### 12.5.1 数据驱动方式

所有等级视觉参数应通过配置驱动，而非硬编码。建议在 `UnitTypeConfig` 中扩展视觉配置：

```typescript
interface UpgradeVisual {
  /** 该等级的几何体缩放比例（相对基础尺寸） */
  scaleMultiplier: number;
  /** 该等级的等级菱数量 */
  diamondCount: number;
  /** 该等级的辉光配置 */
  glow?: { radius: number; alpha: number; color: string };
  /** 该等级的粒子配置 */
  particles?: { count: number; radius: number; color: string; behavior: string };
  /** 该等级新增的装饰部件列表 */
  extraParts: DecorativePart[];
  /** 该等级是否解锁 L3 被动视觉 */
  passiveVisual?: PassiveVisualConfig;
}

// 将每个等级的 UpgradeVisual 存储在 tower 配置的 special 中
special: {
  // ... existing
  upgradeVisuals: UpgradeVisual[];  // index 0 = L1, index 4 = L5
}
```

#### 12.5.2 优先实现顺序

1. **阶段 A**（基础）：尺寸缩放 + 等级菱显示（覆盖所有等级）
2. **阶段 B**（中级）：辉光系统（L3-L5）
3. **阶段 C**（高级）：装饰粒子 + L3 被动视觉（L3-L5）
4. **阶段 D**（完满）：升级动画 + L5 终极特效

#### 12.5.3 与现有系统的集成点

| 现有系统 | 集成方式 |
|----------|----------|
| `RenderSystem` | 读取当前等级 → 选择对应 `UpgradeVisual` → 绘制额外部件 |
| `UnitTag.level` | 已有等级字段，直接读取 |
| `onUpgrade` 生命周期 | 触发升级动画（12.1.5） |
| `deco_diamond` 部件 | 已在部件类型库中定义 |
| `deco_glow` 部件 | 已在部件类型库中定义 |
| `deco_particles` 部件 | 已在部件类型库中定义 |

---

> **版本**: v1.1 | **日期**: 2026-05-10 | **作者**: Sisyphus (MDA 分析驱动)
