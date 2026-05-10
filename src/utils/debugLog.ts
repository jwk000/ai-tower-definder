// ============================================================
// Tower Defender — Debug Logging Utility
//
// 结构化调试日志，用于追踪实体生命周期和系统崩溃。
//
// 特性：
//   - 环形缓冲区（内存），崩溃时自动输出最近 N 条
//   - 帧计数，方便跨帧关联事件
//   - 分级日志：ERROR / WARN / INFO / DEBUG
//   - 实体生命周期追踪（创建/销毁/添加组件/移除组件）
//   - 系统执行追踪（耗时、异常）
//
// 生产环境可通过 setEnabled(false) 关闭。
// ============================================================

// ============================================================
// Log Level
// ============================================================

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

// ============================================================
// Log Entry
// ============================================================

export interface LogEntry {
  /** 毫秒级时间戳 */
  timestamp: number;
  /** 帧编号（由外部设置） */
  frame: number;
  /** 日志级别 */
  level: LogLevel;
  /** 日志来源模块 */
  module: string;
  /** 日志消息 */
  message: string;
  /** 附加数据 */
  data?: Record<string, unknown>;
}

/** 日志级别到标签的反向映射 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
};

// ============================================================
// Ring Buffer Config
// ============================================================

const RING_SIZE = 2048;

const ringBuffer: LogEntry[] = [];
let ringCursor = 0;
let frameCounter = 0;
let logLevel: LogLevel = LogLevel.DEBUG;
let enabled = true;

// ============================================================
// Public API
// ============================================================

/** 推进帧计数（系统每帧调用一次） */
export function tickFrame(): void {
  frameCounter++;
}

/** 获取当前帧编号 */
export function getFrame(): number {
  return frameCounter;
}

/** 设置日志级别 */
export function setLogLevel(level: LogLevel): void {
  logLevel = level;
}

/** 启用/禁用日志 */
export function setEnabled(on: boolean): void {
  enabled = on;
}

/** 是否有指定级别的日志被启用 */
export function isLevel(level: LogLevel): boolean {
  return enabled && level <= logLevel;
}

/**
 * 记录一条日志。
 *
 * @param level   日志级别
 * @param module  来源模块名（如 'BuffSystem', 'World', 'Entity'）
 * @param message 日志消息
 * @param data    附加数据（可选）
 */
export function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!isLevel(level)) return;

  const entry: LogEntry = {
    timestamp: performance.now(),
    frame: frameCounter,
    level,
    module,
    message,
    data,
  };

  // 写入环形缓冲区
  ringBuffer[ringCursor] = entry;
  ringCursor = (ringCursor + 1) % RING_SIZE;

  // 同步输出到控制台（含颜色）
  writeConsole(entry);
}

/** 简写：ERROR */
export function error(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.ERROR, module, message, data);
}

/** 简写：WARN */
export function warn(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.WARN, module, message, data);
}

/** 简写：INFO */
export function info(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.INFO, module, message, data);
}

/** 简写：DEBUG */
export function debug(module: string, message: string, data?: Record<string, unknown>): void {
  log(LogLevel.DEBUG, module, message, data);
}

// ============================================================
// 实体生命周期专用日志
// ============================================================

/**
 * 记录实体创建事件。
 */
export function entityCreated(eid: number, source?: string): void {
  if (!isLevel(LogLevel.DEBUG)) return;
  log(LogLevel.DEBUG, 'Entity', `eid=${eid} created`, source ? { source } : undefined);
}

/**
 * 记录实体销毁事件。
 */
export function entityDestroyed(eid: number, reason?: string): void {
  if (!isLevel(LogLevel.DEBUG)) return;
  log(LogLevel.DEBUG, 'Entity', `eid=${eid} destroyed`, reason ? { reason } : undefined);
}

/**
 * 记录组件添加事件。
 */
export function componentAdded(eid: number, componentName: string): void {
  if (!isLevel(LogLevel.DEBUG)) return;
  log(LogLevel.DEBUG, 'Component', `eid=${eid} +${componentName}`);
}

/**
 * 记录组件移除事件。
 */
export function componentRemoved(eid: number, componentName: string): void {
  if (!isLevel(LogLevel.DEBUG)) return;
  log(LogLevel.DEBUG, 'Component', `eid=${eid} -${componentName}`);
}

// ============================================================
// 系统执行专用日志
// ============================================================

/**
 * 记录系统开始执行。
 */
export function systemStart(systemName: string): void {
  if (!isLevel(LogLevel.DEBUG)) return;
  log(LogLevel.DEBUG, 'System', `${systemName} start`);
}

/**
 * 记录系统执行完成（含耗时）。
 */
export function systemEnd(systemName: string, elapsedMs: number): void {
  if (!isLevel(LogLevel.DEBUG)) return;
  log(LogLevel.DEBUG, 'System', `${systemName} end (${elapsedMs.toFixed(2)}ms)`);
}

/**
 * 记录系统崩溃。
 */
export function systemCrashed(systemName: string, error: unknown, context?: Record<string, unknown>): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack : undefined;
  log(LogLevel.ERROR, 'System', `${systemName} CRASHED: ${errMsg}`, {
    stack: errStack,
    ...context,
  });
  // 崩溃时立即输出环形缓冲区全部内容
  dumpBuffer();
}

// ============================================================
// 缓冲区导出
// ============================================================

/**
 * 将环形缓冲区全部日志输出到控制台。
 * 在系统崩溃时自动调用，也可手动调用用于排查。
 */
export function dumpBuffer(
  filter?: 'all' | 'error' | 'warn' | 'info' | 'debug',
): void {
  if (ringCursor === 0 && ringBuffer[0] === undefined) {
    console.warn('[DebugLog] Buffer is empty');
    return;
  }

  // 收集有效条目（环形缓冲区中环指针之前的区域可能包含旧数据）
  const entries: LogEntry[] = [];
  for (let i = 0; i < RING_SIZE; i++) {
    const idx = (ringCursor + i) % RING_SIZE;
    const entry = ringBuffer[idx];
    if (entry) {
      entries.push(entry);
    }
  }

  // 按时间戳排序
  entries.sort((a, b) => a.timestamp - b.timestamp);

  // 过滤
  const filtered =
    filter && filter !== 'all'
      ? entries.filter((e) => {
          if (filter === 'error') return e.level === LogLevel.ERROR;
          if (filter === 'warn') return e.level <= LogLevel.WARN;
          if (filter === 'info') return e.level <= LogLevel.INFO;
          return true;
        })
      : entries;

  console.groupCollapsed(
    `%c[DebugLog] Buffer Dump — ${filtered.length} entries (frame 0-${frameCounter})`,
    'color: #ff9800; font-weight: bold',
  );

  if (filtered.length === 0) {
    console.log('  (no entries match filter)');
  } else {
    console.table(
      filtered.map((e) => ({
        frame: e.frame,
        level: LEVEL_LABELS[e.level] ?? 'UNKNOWN',
        module: e.module,
        message: e.message,
        ...(e.data ? { data: JSON.stringify(e.data) } : {}),
      })),
    );
  }

  console.groupEnd();
}

/**
 * 获取当前缓冲区中的条目数（用于监控）。
 */
export function getBufferSize(): number {
  let count = 0;
  for (let i = 0; i < RING_SIZE; i++) {
    if (ringBuffer[i]) count++;
  }
  return count;
}

// ============================================================
// 内部控制台输出
// ============================================================

const LEVEL_STYLES: Record<LogLevel, { color: string; prefix: string }> = {
  [LogLevel.ERROR]: { color: '#ef5350', prefix: '❌' },
  [LogLevel.WARN]: { color: '#ff9800', prefix: '⚠' },
  [LogLevel.INFO]: { color: '#42a5f5', prefix: 'ℹ' },
  [LogLevel.DEBUG]: { color: '#9e9e9e', prefix: '·' },
};

function writeConsole(entry: LogEntry): void {
  const style = LEVEL_STYLES[entry.level] ?? LEVEL_STYLES[LogLevel.DEBUG];
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  console.log(
    `%c[F${entry.frame}]%c ${style.prefix} [${entry.module}] ${entry.message}${dataStr}`,
    'color: #78909c; font-weight: bold',
    `color: ${style.color}`,
  );
}
