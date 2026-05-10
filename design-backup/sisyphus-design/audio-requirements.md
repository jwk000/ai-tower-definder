# Tower Defender — 音效需求汇总

> 本文档汇总游戏所需音效，并为每个音效生成 AI 音频生成提示词（Suno/Udio/Stable Audio 等工具可用）。
> 音效风格：几何极简风 → 配电子/合成器/8-bit 风格音效。

---

## 音效清单

### 1. UI 交互音效

| ID | 名称 | 触发时机 | 风格 | 优先级 |
|----|------|----------|------|--------|
| SFX_UI_CLICK | 按钮点击 | 点击任何 UI 按钮 | 短促清脆 click | P0 |
| SFX_UI_BUILD | 建造确认 | 成功放置箭塔 | 有力的"咚"声 | P0 |
| SFX_UI_ERROR | 操作失败 | 金币不足/位置非法 | 低沉 buzz | P1 |
| SFX_UI_WAVE_START | 波次开始 | 点击"开始波次" | 警报/号角短音 | P1 |

**提示词示例 (SFX_UI_BUILD):**
> A short, crisp electronic "thunk" sound, like a mechanical piece locking into place. Duration <0.3s. 8-bit or chiptune style. Clean transient, no reverb.

---

### 2. 战斗音效

| ID | 名称 | 触发时机 | 风格 | 优先级 |
|----|------|----------|------|--------|
| SFX_ARROW_SHOOT | 箭塔射击 | 箭塔每次攻击 | 轻快的"咻"声 | P0 |
| SFX_ARROW_HIT | 箭矢命中 | 箭矢击中敌人 | 钝器打击声 | P0 |
| SFX_ENEMY_HIT | 敌人受击 | 敌人受到任何伤害 | 短促反馈音 | P1 |
| SFX_ENEMY_DIE | 敌人死亡 | 敌人血量归零 | 碎裂/爆裂声 | P0 |
| SFX_ENEMY_SPAWN | 敌人出现 | 敌人在出生点生成 | 低沉涌现声 | P1 |
| SFX_BASE_DAMAGED | 基地受伤 | 敌人到达终点攻击基地 | 警报脉冲 | P1 |

**提示词示例 (SFX_ARROW_SHOOT):**
> A quick, airy "whoosh" sound of an arrow being released from a bow. Light and sharp. Duration <0.2s. Electronic/synth texture, like a laser shot but softer.

**提示词示例 (SFX_ENEMY_DIE):**
> A short shatter or pop sound, like glass breaking or a bubble bursting. Duration <0.3s. 8-bit arcade death sound. Slightly crunchy, no low-end rumble.

---

### 3. 金币/经济音效

| ID | 名称 | 触发时机 | 风格 | 优先级 |
|----|------|----------|------|--------|
| SFX_GOLD_EARN | 获得金币 | 敌人死亡掉落金币 | 清脆的金属碰撞/铃铛 | P0 |
| SFX_GOLD_SPEND | 花费金币 | 建造/升级扣费 | 硬币滚动声 | P1 |

**提示词示例 (SFX_GOLD_EARN):**
> A bright, short coin pickup sound. Like two coins clinking together. Duration <0.3s. Synth chime, major key, cheerful. Think Mario coin but more modern and subtle.

---

### 4. 状态/提示音效

| ID | 名称 | 触发时机 | 风格 | 优先级 |
|----|------|----------|------|--------|
| SFX_VICTORY | 胜利 | 所有波次通关 | 胜利号角/上升旋律 | P0 |
| SFX_DEFEAT | 失败 | 基地被摧毁 | 下降/低沉旋律 | P0 |
| SFX_WAVE_CLEAR | 波次清除 | 一波敌人全部消灭 | 短促完成音 | P1 |
| SFX_WARNING | 警告 | 基地血量低于30% | 心跳/脉冲警报 | P1 |

**提示词示例 (SFX_VICTORY):**
> A triumphant 3-note ascending fanfare. Synth/chiptune style. Duration 1-2s. Major chord resolution. Clean and bright. Not orchestral — electronic arcade victory jingle.

**提示词示例 (SFX_DEFEAT):**
> A sad descending 3-note motif. Minor key. Duration 1-2s. 8-bit game over sound. Subdued but clear. Not dramatic — minimalist.

---

### 5. 环境/背景音效（Phase 4 后期添加）

| ID | 名称 | 说明 | 优先级 |
|----|------|------|--------|
| SFX_AMBIENT | 环境白噪 | 低音量合成器氛围音，战斗时增强 | P2 |
| SFX_BATTLE_INTENSE | 战斗激烈 | 多敌人时动态增强节奏 | P2 |

---

## 技术实现方案

- **格式**: WAV (开发) / MP3 或 OGG (发布)
- **音频引擎**: Web Audio API (`AudioContext`)
- **实现方式**: 
  1. 创建 `AudioManager` 单例
  2. 预加载所有音效到 `AudioBuffer`
  3. 提供 `play(sfxId, volume?)` 接口
  4. 支持音量调节和静音
- **延迟要求**: UI 音效 <50ms 延迟（需预加载）
- **同时播放数**: 最多 8 个音效同时播放（限制 AudioBufferSourceNode 数量）
- **文件大小目标**: 所有音效总计 <500KB (压缩后)

---

## 优先级说明

- **P0 (Phase 1-2)**: 核心反馈音效，MVP 阶段必需
- **P1 (Phase 3)**: 增强沉浸感，内容填充阶段添加
- **P2 (Phase 4)**: 锦上添花，打磨阶段添加
