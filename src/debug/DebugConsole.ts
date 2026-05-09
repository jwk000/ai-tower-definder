import type { LogEntry, LogLevel } from './types.js';
import { FONT_FAMILY } from '../config/fonts.js';

/**
 * 调试控制台
 * 
 * 显示游戏运行时的日志输出，支持：
 * - 日志级别过滤
 * - 分类过滤
 * - 搜索
 * - 自动滚动
 */
export class DebugConsole {
  private container: HTMLElement;
  private logContainer: HTMLElement;
  private filterContainer: HTMLElement;
  
  // 状态
  private isVisible: boolean = false;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private autoScroll: boolean = true;
  
  // 过滤器
  private levelFilter: Set<LogLevel> = new Set(['debug', 'info', 'warn', 'error']);
  private categoryFilter: string = '';
  private searchText: string = '';
  
  // 统计
  private stats = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  constructor(container: HTMLElement) {
    this.container = container;
    
    // 创建主容器
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      flex-direction: column;
      z-index: 10000;
    `;
    
    // 创建标题栏
    const titleBar = this.createTitleBar();
    this.container.appendChild(titleBar);
    
    // 创建过滤器
    this.filterContainer = this.createFilterBar();
    this.container.appendChild(this.filterContainer);
    
    // 创建日志容器
    this.logContainer = document.createElement('div');
    this.logContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      font-family: ${FONT_FAMILY};
      font-size: 12px;
      background: #1e1e2e;
    `;
    this.container.appendChild(this.logContainer);
    
    // 创建状态栏
    const statusBar = this.createStatusBar();
    this.container.appendChild(statusBar);
  }

  /**
   * 创建标题栏
   */
  private createTitleBar(): HTMLElement {
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      background: #1e1e2e;
      border-bottom: 1px solid #3a3a4a;
    `;
    
    // 标题
    const title = document.createElement('div');
    title.style.cssText = `
      color: #e0e0e0;
      font-size: 16px;
      font-weight: bold;
    `;
    title.textContent = '调试控制台';
    titleBar.appendChild(title);
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
    `;
    
    // 清除按钮
    const clearButton = this.createButton('清除日志', () => this.clearLogs());
    buttonContainer.appendChild(clearButton);
    
    // 导出按钮
    const exportButton = this.createButton('导出日志', () => this.exportLogs());
    buttonContainer.appendChild(exportButton);
    
    // 关闭按钮
    const closeButton = this.createButton('关闭', () => this.hide());
    closeButton.style.background = '#f44336';
    buttonContainer.appendChild(closeButton);
    
    titleBar.appendChild(buttonContainer);
    
    return titleBar;
  }

  /**
   * 创建过滤器栏
   */
  private createFilterBar(): HTMLElement {
    const filterBar = document.createElement('div');
    filterBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 10px 20px;
      background: #252535;
      border-bottom: 1px solid #3a3a4a;
    `;
    
    // 日志级别过滤
    const levelContainer = document.createElement('div');
    levelContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    const levelLabel = document.createElement('span');
    levelLabel.style.cssText = `
      color: #a0a0b0;
      font-size: 12px;
    `;
    levelLabel.textContent = '级别:';
    levelContainer.appendChild(levelLabel);
    
    const levels: Array<{ level: LogLevel; label: string; color: string }> = [
      { level: 'debug', label: 'Debug', color: '#757575' },
      { level: 'info', label: 'Info', color: '#2196F3' },
      { level: 'warn', label: 'Warn', color: '#FF9800' },
      { level: 'error', label: 'Error', color: '#f44336' },
    ];
    
    for (const { level, label, color } of levels) {
      const checkbox = document.createElement('label');
      checkbox.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        color: ${color};
        font-size: 12px;
        cursor: pointer;
      `;
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;
      input.style.cssText = `
        margin: 0;
      `;
      input.addEventListener('change', () => {
        if (input.checked) {
          this.levelFilter.add(level);
        } else {
          this.levelFilter.delete(level);
        }
        this.applyFilters();
      });
      
      checkbox.appendChild(input);
      checkbox.appendChild(document.createTextNode(label));
      levelContainer.appendChild(checkbox);
    }
    
    filterBar.appendChild(levelContainer);
    
    // 搜索框
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    `;
    
    const searchLabel = document.createElement('span');
    searchLabel.style.cssText = `
      color: #a0a0b0;
      font-size: 12px;
    `;
    searchLabel.textContent = '搜索:';
    searchContainer.appendChild(searchLabel);
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索日志内容...';
    searchInput.style.cssText = `
      flex: 1;
      padding: 6px 10px;
      background: #1e1e2e;
      border: 1px solid #3a3a4a;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 12px;
    `;
    searchInput.addEventListener('input', () => {
      this.searchText = searchInput.value.toLowerCase();
      this.applyFilters();
    });
    searchContainer.appendChild(searchInput);
    
    filterBar.appendChild(searchContainer);
    
    // 自动滚动开关
    const autoScrollContainer = document.createElement('label');
    autoScrollContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      color: #a0a0b0;
      font-size: 12px;
      cursor: pointer;
    `;
    
    const autoScrollCheckbox = document.createElement('input');
    autoScrollCheckbox.type = 'checkbox';
    autoScrollCheckbox.checked = this.autoScroll;
    autoScrollCheckbox.style.cssText = `
      margin: 0;
    `;
    autoScrollCheckbox.addEventListener('change', () => {
      this.autoScroll = autoScrollCheckbox.checked;
    });
    
    autoScrollContainer.appendChild(autoScrollCheckbox);
    autoScrollContainer.appendChild(document.createTextNode('自动滚动'));
    filterBar.appendChild(autoScrollContainer);
    
    return filterBar;
  }

  /**
   * 创建状态栏
   */
  private createStatusBar(): HTMLElement {
    const statusBar = document.createElement('div');
    statusBar.id = 'console-status-bar';
    statusBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 20px;
      background: #1e1e2e;
      border-top: 1px solid #3a3a4a;
      font-size: 11px;
      color: #a0a0b0;
    `;
    
    this.updateStatusBar();
    
    return statusBar;
  }

  /**
   * 更新状态栏
   */
  private updateStatusBar(): void {
    const statusBar = document.getElementById('console-status-bar');
    if (!statusBar) return;
    
    statusBar.innerHTML = `
      <span>总计: ${this.logs.length} 条日志</span>
      <span>
        <span style="color: #757575;">Debug: ${this.stats.debug}</span> |
        <span style="color: #2196F3;">Info: ${this.stats.info}</span> |
        <span style="color: #FF9800;">Warn: ${this.stats.warn}</span> |
        <span style="color: #f44336;">Error: ${this.stats.error}</span>
      </span>
    `;
  }

  /**
   * 创建按钮
   */
  private createButton(text: string, onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      padding: 6px 12px;
      background: #3a3a4a;
      color: #e0e0e0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.background = '#4a4a5a';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#3a3a4a';
    });
    return button;
  }

  /**
   * 添加日志
   */
  addLog(entry: LogEntry): void {
    // 更新统计
    this.stats[entry.level]++;
    
    // 添加到日志列表
    this.logs.push(entry);
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      const removed = this.logs.shift();
      if (removed) {
        this.stats[removed.level]--;
      }
    }
    
    // 检查是否符合过滤条件
    if (this.shouldShowLog(entry)) {
      this.appendLogElement(entry);
    }
    
    // 更新状态栏
    this.updateStatusBar();
    
    // 自动滚动
    if (this.autoScroll && this.isVisible) {
      this.scrollToBottom();
    }
  }

  /**
   * 检查日志是否应该显示
   */
  private shouldShowLog(entry: LogEntry): boolean {
    // 检查级别
    if (!this.levelFilter.has(entry.level)) {
      return false;
    }
    
    // 检查分类
    if (this.categoryFilter && entry.category !== this.categoryFilter) {
      return false;
    }
    
    // 检查搜索文本
    if (this.searchText) {
      const searchIn = `${entry.message} ${entry.category} ${JSON.stringify(entry.data || '')}`.toLowerCase();
      if (!searchIn.includes(this.searchText)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 追加日志元素
   */
  private appendLogElement(entry: LogEntry): void {
    const logElement = document.createElement('div');
    logElement.style.cssText = `
      padding: 4px 8px;
      border-bottom: 1px solid #2a2a3a;
      display: flex;
      gap: 10px;
    `;
    
    // 时间戳
    const timestamp = document.createElement('span');
    timestamp.style.cssText = `
      color: #666;
      min-width: 80px;
    `;
    timestamp.textContent = this.formatTimestamp(entry.timestamp);
    logElement.appendChild(timestamp);
    
    // 级别
    const level = document.createElement('span');
    level.style.cssText = `
      min-width: 50px;
      font-weight: bold;
    `;
    level.textContent = entry.level.toUpperCase();
    switch (entry.level) {
      case 'debug':
        level.style.color = '#757575';
        break;
      case 'info':
        level.style.color = '#2196F3';
        break;
      case 'warn':
        level.style.color = '#FF9800';
        break;
      case 'error':
        level.style.color = '#f44336';
        break;
    }
    logElement.appendChild(level);
    
    // 分类
    const category = document.createElement('span');
    category.style.cssText = `
      color: #9C27B0;
      min-width: 80px;
    `;
    category.textContent = `[${entry.category}]`;
    logElement.appendChild(category);
    
    // 消息
    const message = document.createElement('span');
    message.style.cssText = `
      flex: 1;
      color: #e0e0e0;
      word-break: break-all;
    `;
    message.textContent = entry.message;
    logElement.appendChild(message);
    
    // 数据（如果有）
    if (entry.data !== undefined) {
      const data = document.createElement('span');
      data.style.cssText = `
        color: #666;
        font-size: 10px;
      `;
      data.textContent = JSON.stringify(entry.data);
      logElement.appendChild(data);
    }
    
    this.logContainer.appendChild(logElement);
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 应用过滤器
   */
  private applyFilters(): void {
    // 清空日志容器
    this.logContainer.innerHTML = '';
    
    // 重新添加符合条件的日志
    for (const entry of this.logs) {
      if (this.shouldShowLog(entry)) {
        this.appendLogElement(entry);
      }
    }
    
    // 自动滚动
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * 清除日志
   */
  private clearLogs(): void {
    this.logs = [];
    this.stats = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };
    this.logContainer.innerHTML = '';
    this.updateStatusBar();
  }

  /**
   * 导出日志
   */
  private exportLogs(): void {
    const logText = this.logs.map(entry => {
      const timestamp = this.formatTimestamp(entry.timestamp);
      const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      return `${timestamp} [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${data}`;
    }).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 滚动到底部
   */
  private scrollToBottom(): void {
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  /**
   * 显示控制台
   */
  show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
    this.scrollToBottom();
  }

  /**
   * 隐藏控制台
   */
  hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
  }

  /**
   * 获取是否可见
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * 切换可见性
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}
