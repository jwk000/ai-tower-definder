# 开发日志 — 2026-05-11

## 飞书机器人安装与调试

### 背景
需要将飞书与 OpenCode AI 编程助手集成，实现通过飞书消息触达 AI 对话、代码生成和任务处理的全流程自动化。

### 方案选型
调研了 5 个开源实现后，选择 [NeverMore93/opencode-feishu](https://github.com/NeverMore93/opencode-feishu)（v1.10.8）作为飞书插件：
- **WebSocket 长连接**：无需公网 IP，通过飞书开放平台的事件长连接接收消息
- **流式卡片**：AI 回复实时渲染为 CardKit 2.0 流式卡片
- **群聊静默监听**：所有群消息作为上下文积累，仅 @bot 时回复
- **多媒体支持**：图片、文件、富文本、卡片表格等自动解析

### 环境准备
- Node v25.2.1 ✓
- Git v2.40.0 ✓
- OpenCode CLI（已安装于 `C:\Users\j__w_\AppData\Roaming\npm\opencode`）
- **Bun v1.3.13**（缺失，通过 `powershell -c "irm bun.sh/install.ps1 | iex"` 安装）
- **RipGrep v15.1.0**（缺失，通过 `winget install BurntSushi.ripgrep.MSVC` 安装）

### 安装步骤

#### 第一步：飞书开放平台创建应用（手动）
1. 在 [open.feishu.cn](https://open.feishu.cn) 创建「企业自建应用」
2. 开启机器人能力
3. 事件订阅 → 选择「使用长连接接收事件/回调」→ 订阅 `im.message.receive_v1`
4. 权限开通：`im:message`、`im:message:send_as_bot`、`im:chat`、`im:message:readonly`、`contact:user.base:readonly`
5. 发布并通过审批
6. 获取 App ID: `cli_aa8bbaded0f8dcd8`、App Secret: `MXAdDOfSKj0mJXIXpNFvrhT3ozW6PYPp`

#### 第二步：安装 opencode-feishu 插件
```bash
npm install opencode-feishu
```
工作目录：`C:\Users\j__w_\.config\opencode`

#### 第三步：创建飞书配置文件
创建 `C:\Users\j__w_\.config\opencode\plugins\feishu.json`：
```json
{
  "appId": "cli_aa8bbaded0f8dcd8",
  "appSecret": "MXAdDOfSKj0mJXIXpNFvrhT3ozW6PYPp"
}
```

`opencode.json` 中已预先配置：
```json
{
  "plugin": [
    "oh-my-openagent@3.16.0",
    "opencode-feishu"
  ]
}
```

### 错误排查

**现象**：从飞书发送消息后，返回错误：
```
状态：❌ 已失败
❌ default agent "Sisyphus - Ultraworker" not found
终态：❌ 已失败
```

**排查过程**：
1. 搜索 `opencode-feishu` 插件源码，未找到 "Ultraworker" 引用 → 错误不来自 feishu 插件
2. 搜索 `oh-my-openagent.json` 配置，发现已定义的 agent 有 `sisyphus`、`hephaestus`、`prometheus` 等，但**没有** `Sisyphus - Ultraworker`
3. 在 oh-my-openagent 缓存目录（`C:\Users\j__w_\.cache\opencode\packages\oh-my-openagent@3.16.0`）中搜索，发现关键代码

**根因分析**：

oh-my-openagent 插件中 `default_agent` 和 agent 注册使用了**不同的函数获取显示名称**，导致名称不匹配。

| 字段 | 值 | 来源函数 | 位置 |
|------|-----|---------|------|
| `default_agent` | `"Sisyphus - Ultraworker"` | `getAgentDisplayName("sisyphus")` | `dist/index.js:144218` |
| Agent 注册 key | `"\u200BSisyphus - Ultraworker"` | `getAgentListDisplayName("sisyphus")` | `dist/index.js:141847` |

两个函数的差异在于 `getAgentListDisplayName` 会在显示名称前加上**零宽空格前缀**（`\u200B`）用于 UI 排序：

```js
// dist/index.js:61035-61040
var AGENT_LIST_SORT_PREFIXES = {
  sisyphus: "\u200B",      // 零宽空格前缀
  hephaestus: "\u200B\u200B",
  prometheus: "\u200B\u200B\u200B",
  atlas: "\u200B\u200B\u200B\u200B"
};

// getAgentDisplayName("sisyphus") → "Sisyphus - Ultraworker"
// getAgentListDisplayName("sisyphus") → "\u200BSisyphus - Ultraworker"
```

Agent 注册时使用 `getAgentListDisplayName`（带前缀），但 `default_agent` 使用 `getAgentDisplayName`（无前缀）。OpenCode 核心按 `default_agent` 精确查找 agent 时，找不到匹配项。

**修复**：

修改 `oh-my-openagent/dist/index.js` 第 144216、144218 行：

```diff
- params.config.default_agent = getAgentDisplayName(configuredDefaultAgent);
+ params.config.default_agent = getAgentListDisplayName(configuredDefaultAgent);

- params.config.default_agent = getAgentDisplayName("sisyphus");
+ params.config.default_agent = getAgentListDisplayName("sisyphus");
```

修复后 `default_agent` = `"\u200BSisyphus - Ultraworker"`，与 Agent 注册 key 一致。

### 文件变更
- 修改: `C:\Users\j__w_\.config\opencode\plugins\feishu.json`（新增，飞书凭据配置）
- 修改: `C:\Users\j__w_\.cache\opencode\packages\oh-my-openagent@3.16.0\node_modules\oh-my-openagent\dist\index.js`（bug 修复，2 行）

### 验证结果
- ✅ 飞书消息正常路由到 Sisyphus agent
- ✅ AI 回复实时流式卡片
- ✅ OpenCode 会话管理正常

### 架构参考

**消息流**：
```
飞书用户消息 → WebSocket 长连接 → opencode-feishu 插件
  → 解析消息内容/附件 → 创建/复用 OpenCode 会话
  → POST /api/sessions/{id}/messages → AI 处理
  → SSE 流式响应 → 插件累积文本 → 飞书流式卡片
```

**插件依赖关系**：
```
opencode-feishu（消息接入层）
  └─ oh-my-openagent（Agent 管理层：模型配置、agent 注册、会话路由）
       └─ OpenCode Core（引擎层：会话管理、provider 调度）
```
