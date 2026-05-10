// ============================================================
// Tower Defender — Log Monitor Widget
//
// 调试面板内的日志监视器，实时显示结构化调试日志。
//
// 特性：
//   - 级别过滤器（ERROR/WARN/INFO/DEBUG 复选框）
//   - 模块过滤器（文本输入）
//   - 颜色编码的日志条目
//   - 自动滚动（可切换）
//   - 打开面板时加载环形缓冲区中的历史记录
//   - 面板关闭时日志继续在后台记录
// ============================================================

import {
  type LogEntry,
  type LogLevel,
  LogLevel as LogLevelVal,
  LEVEL_LABELS,
  subscribe,
  getEntries,
  getFrame,
} from '../utils/debugLog.js';
import { FONT_FAMILY } from '../config/fonts.js';

// ============================================================
// 级别显示配置
// ============================================================

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; label: string }> = {
  [LogLevelVal.ERROR]: { color: '#ef5350', bg: '#3d1515', label: 'ERROR' },
  [LogLevelVal.WARN]: { color: '#ff9800', bg: '#3d2e0a', label: 'WARN' },
  [LogLevelVal.INFO]: { color: '#42a5f5', bg: '#0d2137', label: 'INFO' },
  [LogLevelVal.DEBUG]: { color: '#9e9e9e', bg: '#151520', label: 'DEBUG' },
};

// ============================================================
// 模块颜色（常用模块的高亮色）
// ============================================================

const MODULE_COLORS: Record<string, string> = {
  Entity: '#81c784',
  Component: '#64b5f6',
  System: '#ffb74d',
  BuffSystem: '#ce93d8',
  HealthSystem: '#ef5350',
  MovementSystem: '#4fc3f7',
  AttackSystem: '#f48fb1',
  ProjectileSystem: '#aed581',
  Game: '#ffd54f',
  World: '#4db6ac',
};

/**
 * 日志监视器 — 调试面板中的嵌入式日志查看器。
 */
export class LogMonitor {
  private container: HTMLElement;
  private logContainer: HTMLElement;
  private toolbarElement: HTMLElement;
  private statusBar: HTMLElement;

  // 状态
  private enabledLevels: Set<LogLevel> = new Set([
    LogLevelVal.ERROR,
    LogLevelVal.WARN,
    LogLevelVal.INFO,
    LogLevelVal.DEBUG,
  ]);
  private moduleFilter: string = '';
  private autoScroll: boolean = true;
  private maxVisibleEntries: number = 200;

  // 订阅管理
  private unsubscribe: (() => void) | null = null;

  /** 当前可见的 DOM 元素数 */
  private visibleCount: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // 工具栏：级别过滤 + 模块过滤 + 控制按钮
    this.toolbarElement = this.createToolbar();
    this.container.appendChild(this.toolbarElement);

    // 日志列表
    this.logContainer = document.createElement('div');
    this.logContainer.id = 'log-monitor-list';
    this.logContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      font-family: ${FONT_FAMILY};
      font-size: 11px;
      background: #1a1a2e;
    `;
    this.container.appendChild(this.logContainer);

    // 状态栏
    this.statusBar = this.createStatusBar();
    this.container.appendChild(this.statusBar);

    // 加载历史记录
    this.loadHistory();

    // 订阅实时日志
    this.unsubscribe = subscribe((entry) => this.onNewLog(entry));
  }

  // ============================================================
  // 工具栏
  // ============================================================

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: #252535;
      border-bottom: 1px solid #3a3a4a;
      flex-shrink: 0;
      flex-wrap: wrap;
    `;

    // 级别过滤标题
    const levelLabel = document.createElement('span');
    levelLabel.style.cssText = `color: #a0a0b0; font-size: 11px;`;
    levelLabel.textContent = '级别:';
    toolbar.appendChild(levelLabel);

    // 级别复选框
    const levels: Array<{ level: LogLevel; label: string; color: string }> = [
      { level: LogLevelVal.ERROR, label: 'E', color: '#ef5350' },
      { level: LogLevelVal.WARN, label: 'W', color: '#ff9800' },
      { level: LogLevelVal.INFO, label: 'I', color: '#42a5f5' },
      { level: LogLevelVal.DEBUG, label: 'D', color: '#9e9e9e' },
    ];

    for (const { level, label, color } of levels) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.title = `${LEVEL_LABELS[level]} — 点击切换`;
      btn.style.cssText = `
        width: 22px;
        height: 22px;
        padding: 0;
        background: ${color}33;
        border: 1px solid ${color}88;
        border-radius: 3px;
        color: ${color};
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.15s;
      `;
      btn.addEventListener('click', () => {
        if (this.enabledLevels.has(level)) {
          this.enabledLevels.delete(level);
          btn.style.background = '#1e1e2e';
          btn.style.borderColor = '#3a3a4a';
          btn.style.color = '#666';
        } else {
          this.enabledLevels.add(level);
          btn.style.background = `${color}33`;
          btn.style.borderColor = `${color}88`;
          btn.style.color = color;
        }
        this.rebuildList();
      });
      toolbar.appendChild(btn);
    }

    // 分隔符
    const sep = document.createElement('span');
    sep.style.cssText = `color: #444; margin: 0 4px;`;
    sep.textContent = '|';
    toolbar.appendChild(sep);

    // 模块过滤输入
    const moduleLabel = document.createElement('span');
    moduleLabel.style.cssText = `color: #a0a0b0; font-size: 11px;`;
    moduleLabel.textContent = '模块:';
    toolbar.appendChild(moduleLabel);

    const moduleInput = document.createElement('input');
    moduleInput.type = 'text';
    moduleInput.placeholder = '过滤模块...';
    moduleInput.style.cssText = `
      width: 100px;
      padding: 3px 6px;
      background: #1e1e2e;
      border: 1px solid #3a3a4a;
      border-radius: 3px;
      color: #e0e0e0;
      font-size: 11px;
      outline: none;
    `;
    moduleInput.addEventListener('input', () => {
      this.moduleFilter = moduleInput.value.trim().toLowerCase();
      this.rebuildList();
    });
    toolbar.appendChild(moduleInput);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.cssText = `flex: 1;`;
    toolbar.appendChild(spacer);

    // 自动滚动
    const autoScrollBtn = document.createElement('button');
    autoScrollBtn.textContent = '↙';
    autoScrollBtn.title = '自动滚动';
    autoScrollBtn.style.cssText = this.createSmallBtnStyle('#42a5f5');
    autoScrollBtn.addEventListener('click', () => {
      this.autoScroll = !this.autoScroll;
      autoScrollBtn.style.color = this.autoScroll ? '#42a5f5' : '#666';
      if (this.autoScroll) this.scrollToBottom();
    });
    toolbar.appendChild(autoScrollBtn);

    // 清除按钮
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '✕';
    clearBtn.title = '清除可见日志（不清除缓冲区）';
    clearBtn.style.cssText = this.createSmallBtnStyle('#757575');
    clearBtn.addEventListener('click', () => {
      this.logContainer.innerHTML = '';
      this.visibleCount = 0;
      this.updateStatusBar();
    });
    toolbar.appendChild(clearBtn);

    return toolbar;
  }

  // ============================================================
  // 状态栏
  // ============================================================

  private createStatusBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.id = 'log-monitor-status';
    bar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px;
      background: #1e1e2e;
      border-top: 1px solid #3a3a4a;
      font-size: 10px;
      color: #888;
      flex-shrink: 0;
    `;
    bar.textContent = '日志监视器就绪';
    return bar;
  }

  private updateStatusBar(): void {
    this.statusBar.innerHTML = `
      <span>显示 ${this.visibleCount} 条 · 缓冲区 ${this.visibleCount > 0 ? '(环形·2048条)' : '空'}</span>
      <span>帧 #${getFrame()}</span>
    `;
  }

  // ============================================================
  // 日志管理
  // ============================================================

  /** 打开面板时加载历史记录 */
  private loadHistory(): void {
    const entries = getEntries();
    if (entries.length === 0) return;

    // 只加载最近 N 条，避免一次性渲染过多 DOM
    const recent = entries.slice(-this.maxVisibleEntries);
    for (const entry of recent) {
      if (this.shouldShow(entry)) {
        this.appendEntry(entry);
      }
    }
    if (this.autoScroll && recent.length > 0) {
      this.scrollToBottom();
    }
    this.updateStatusBar();
  }

  /** 新日志到达回调 */
  private onNewLog(entry: LogEntry): void {
    if (!this.shouldShow(entry)) return;
    this.appendEntry(entry);
    this.pruneOldEntries();
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    this.updateStatusBar();
  }

  /** 重新构建整个列表（过滤条件变化时） */
  private rebuildList(): void {
    this.logContainer.innerHTML = '';
    this.visibleCount = 0;

    const entries = getEntries();
    const recent = entries.slice(-this.maxVisibleEntries);
    for (const entry of recent) {
      if (this.shouldShow(entry)) {
        this.appendEntry(entry);
      }
    }
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    this.updateStatusBar();
  }

  /** 检查日志条目是否满足过滤条件 */
  private shouldShow(entry: LogEntry): boolean {
    if (!this.enabledLevels.has(entry.level)) return false;
    if (this.moduleFilter && !entry.module.toLowerCase().includes(this.moduleFilter)) return false;
    return true;
  }

  /** 限制可见 DOM 元素数量 */
  private pruneOldEntries(): void {
    while (this.visibleCount > this.maxVisibleEntries) {
      const first = this.logContainer.firstChild;
      if (first) {
        this.logContainer.removeChild(first);
        this.visibleCount--;
      }
    }
  }

  // ============================================================
  // DOM 渲染
  // ============================================================

  /** 追加一条日志到列表 */
  private appendEntry(entry: LogEntry): void {
    const el = document.createElement('div');
    const cfg = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG[LogLevelVal.DEBUG];
    const moduleColor = MODULE_COLORS[entry.module] ?? '#90caf9';

    el.style.cssText = `
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 2px 8px;
      border-bottom: 1px solid #222233;
      min-height: 18px;
      line-height: 18px;
    `;

    // 帧编号
    const frameSpan = document.createElement('span');
    frameSpan.style.cssText = `
      color: #555;
      min-width: 36px;
      text-align: right;
      flex-shrink: 0;
      font-size: 10px;
    `;
    frameSpan.textContent = `[${entry.frame}]`;
    el.appendChild(frameSpan);

    // 级别标签
    const levelSpan = document.createElement('span');
    levelSpan.style.cssText = `
      color: ${cfg.color};
      background: ${cfg.bg};
      padding: 0 4px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: bold;
      flex-shrink: 0;
      text-transform: uppercase;
    `;
    levelSpan.textContent = cfg.label;
    el.appendChild(levelSpan);

    // 模块名称
    const moduleSpan = document.createElement('span');
    moduleSpan.style.cssText = `
      color: ${moduleColor};
      min-width: 60px;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 10px;
    `;
    moduleSpan.textContent = entry.module;
    el.appendChild(moduleSpan);

    // 消息
    const msgSpan = document.createElement('span');
    msgSpan.style.cssText = `
      color: #ccc;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    msgSpan.textContent = entry.message;
    msgSpan.title = entry.message; // 悬停显示完整文本
    el.appendChild(msgSpan);

    // 附加数据（如有）
    if (entry.data !== undefined && entry.data !== null) {
      const dataSpan = document.createElement('span');
      dataSpan.style.cssText = `
        color: #666;
        font-size: 9px;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      try {
        const str = JSON.stringify(entry.data);
        dataSpan.textContent = str.length > 40 ? str.slice(0, 40) + '…' : str;
        dataSpan.title = str;
      } catch {
        dataSpan.textContent = '[…]';
      }
      el.appendChild(dataSpan);
    }

    this.logContainer.appendChild(el);
    this.visibleCount++;
  }

  // ============================================================
  // 工具方法
  // ============================================================

  private scrollToBottom(): void {
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  private createSmallBtnStyle(color: string): string {
    return `
      width: 22px;
      height: 22px;
      padding: 0;
      background: #2a2a3a;
      border: 1px solid #3a3a4a;
      border-radius: 3px;
      color: ${color};
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /** 销毁监视器，取消订阅 */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.container.innerHTML = '';
  }
}
