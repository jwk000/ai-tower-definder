#!/usr/bin/env bash
# OpenCode Token 监控（被动观察 + 系统通知）
#
# 用途: 后台轮询 OpenCode SQLite 数据库, 监测当前项目活跃会话的 token 使用率;
#       达到阈值时通过 macOS 通知中心告警, 不修改任何会话状态。
#
# 设计:
#   - 数据源: ~/.local/share/opencode/opencode.db (sqlite3, 只读)
#   - 监测对象: 指定项目目录下"最近活跃"会话的最新 assistant message.data.tokens.total
#   - 上下文上限: 200,000 tokens (Claude Opus / Sonnet 4 系)
#   - 阈值: 60% INFO, 70% WARN, 85% CRITICAL
#   - 去重: 同一 (session_id, level) 只通知一次, 状态文件 ~/.cache/opencode-token-monitor.state
#   - 轮询: 30s, 可通过 --interval 调整
#   - 退出: SIGINT/SIGTERM 优雅退出
#
# 使用:
#   ./opencode-token-monitor.sh                          # 监控当前 git 项目
#   ./opencode-token-monitor.sh --dir /path/to/project   # 指定项目目录
#   ./opencode-token-monitor.sh --once                   # 跑一次就退出 (干跑/调试)
#   ./opencode-token-monitor.sh --interval 60            # 自定义轮询间隔(秒)
#   ./opencode-token-monitor.sh --threshold-warn 75      # 自定义 WARN 阈值(%)
#   ./opencode-token-monitor.sh --limit 200000           # 自定义上下文上限
#
# 退出码: 0 正常, 1 参数错误, 2 依赖缺失, 3 数据库不可读

set -euo pipefail

# ---------- 默认配置 ----------
DB_PATH="$HOME/.local/share/opencode/opencode.db"
LOG_DIR="$HOME/.local/share/opencode/log"
LOG_FILE="$LOG_DIR/token-monitor.log"
STATE_FILE="$HOME/.cache/opencode-token-monitor.state"
PROJECT_DIR="$(pwd)"
INTERVAL=30
LIMIT=200000
TH_INFO=60
TH_WARN=70
TH_CRIT=85
ONCE=0

# ---------- 参数解析 ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) PROJECT_DIR="$2"; shift 2;;
    --interval) INTERVAL="$2"; shift 2;;
    --limit) LIMIT="$2"; shift 2;;
    --threshold-info) TH_INFO="$2"; shift 2;;
    --threshold-warn) TH_WARN="$2"; shift 2;;
    --threshold-crit) TH_CRIT="$2"; shift 2;;
    --once) ONCE=1; shift;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "[ERR] 未知参数: $1" >&2; exit 1;;
  esac
done

# ---------- 依赖检查 ----------
command -v sqlite3 >/dev/null 2>&1 || { echo "[ERR] 缺少 sqlite3" >&2; exit 2; }
command -v osascript >/dev/null 2>&1 || { echo "[ERR] 缺少 osascript (需要 macOS)" >&2; exit 2; }
[[ -r "$DB_PATH" ]] || { echo "[ERR] 无法读取 $DB_PATH" >&2; exit 3; }

mkdir -p "$LOG_DIR" "$(dirname "$STATE_FILE")"
touch "$STATE_FILE"

  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

# ---------- 日志 ----------
log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" | tee -a "$LOG_FILE" >&2
}

# ---------- 通知 ----------
# notify <level> <session_id> <title> <message>
notify() {
  local level="$1" sid="$2" title="$3" msg="$4"
  local sound=""
  case "$level" in
    INFO) sound="";;
    WARN) sound="Tink";;
    CRITICAL) sound="Sosumi";;
  esac

  local safe_msg="${msg//\"/\\\"}"
  local safe_title="${title//\"/\\\"}"

  if [[ -n "$sound" ]]; then
    osascript -e "display notification \"$safe_msg\" with title \"$safe_title\" sound name \"$sound\"" >/dev/null 2>&1 || true
  else
    osascript -e "display notification \"$safe_msg\" with title \"$safe_title\"" >/dev/null 2>&1 || true
  fi
  log "NOTIFY[$level] session=$sid msg=$msg"
}

# ---------- 状态去重 (状态文件每行: session_id|level) ----------
state_seen() {
  local sid="$1" level="$2"
  grep -qxF "$sid|$level" "$STATE_FILE" 2>/dev/null
}
state_mark() {
  local sid="$1" level="$2"
  echo "$sid|$level" >> "$STATE_FILE"
}

# ---------- 核心查询 ----------
# 找当前项目最近活跃会话的最新 assistant message tokens.total
# 返回格式: <session_id>|<title>|<tokens_total>|<model>
# 找不到时返回空
query_current() {
  sqlite3 -separator '|' "$DB_PATH" <<SQL 2>/dev/null
WITH latest_session AS (
  SELECT id, title FROM session
  WHERE directory = '$PROJECT_DIR'
  ORDER BY time_updated DESC
  LIMIT 1
),
latest_msg AS (
  SELECT m.data
  FROM message m
  JOIN latest_session s ON m.session_id = s.id
  ORDER BY m.time_created DESC
  LIMIT 20
)
SELECT
  (SELECT id FROM latest_session),
  (SELECT title FROM latest_session),
  json_extract(data, '\$.tokens.total'),
  json_extract(data, '\$.modelID')
FROM latest_msg
WHERE json_extract(data, '\$.role') = 'assistant'
  AND COALESCE(json_extract(data, '\$.tokens.total'), 0) > 0
ORDER BY json_extract(data, '\$.time.created') DESC
LIMIT 1;
SQL
}

# ---------- 主循环单步 ----------
tick() {
  local row
  row="$(query_current)" || true

  if [[ -z "$row" ]]; then
    log "TICK 无活跃会话或 token 数据 (project=$PROJECT_DIR)"
    return 0
  fi

  local sid title tokens model
  IFS='|' read -r sid title tokens model <<<"$row"

  if [[ -z "$tokens" || "$tokens" == "null" ]]; then
    log "TICK session=$sid 无 tokens 数据"
    return 0
  fi

  local pct=$(( tokens * 100 / LIMIT ))
  log "TICK session=$sid title=\"$title\" tokens=$tokens pct=${pct}% model=$model"

  local level=""
  if   (( pct >= TH_CRIT )); then level="CRITICAL"
  elif (( pct >= TH_WARN )); then level="WARN"
  elif (( pct >= TH_INFO )); then level="INFO"
  fi

  [[ -z "$level" ]] && return 0

  if state_seen "$sid" "$level"; then
    return 0
  fi

  local title_short="${title:0:30}"
  local msg
  case "$level" in
    INFO)
      msg="会话已用 ${pct}% (${tokens}/${LIMIT}). 留意收敛工作, 70% 应触发 /handoff."
      ;;
    WARN)
      msg="⚠️ 会话已用 ${pct}% (${tokens}/${LIMIT}). 请要求 agent 立即 /handoff!"
      ;;
    CRITICAL)
      msg="🚨 会话已用 ${pct}% (${tokens}/${LIMIT}). 即将自动压缩! 立刻 /handoff."
      ;;
  esac

  notify "$level" "$sid" "OpenCode Token 监控 — $title_short" "$msg"
  state_mark "$sid" "$level"
}

# ---------- 优雅退出 ----------
on_exit() {
  log "STOP monitor exited"
  exit 0
}
trap on_exit INT TERM

# ---------- 启动 ----------
log "START monitor project=$PROJECT_DIR interval=${INTERVAL}s limit=$LIMIT thresholds=INFO:${TH_INFO}%/WARN:${TH_WARN}%/CRIT:${TH_CRIT}%"

if (( ONCE )); then
  tick
  exit 0
fi

while true; do
  tick || log "TICK 异常 (忽略, 继续轮询)"
  sleep "$INTERVAL"
done
