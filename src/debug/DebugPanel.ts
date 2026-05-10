import { BehaviorTreeRenderer } from './BehaviorTreeRenderer.js';
import { LogMonitor } from './LogMonitor.js';
import type { BTNodeDebugInfo, BehaviorTreeDebugState, LogEntry, LogLevel } from './types.js';
import { FONTS, FONT_FAMILY } from '../config/fonts.js';

/**
 * 调试面板 - 半屏覆盖式界面
 * 
 * 特点：
 * - 覆盖在游戏界面上
 * - 可展开/收起
 * - 包含行为树查看器和控制台
 */
export class DebugPanel {
  private container: HTMLElement;
  private panel: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: BehaviorTreeRenderer;
  
  // 状态
  private isExpanded: boolean = false;
  private activeTab: 'behavior_tree' | 'console' | 'log_monitor' = 'behavior_tree';
  private currentState: BehaviorTreeDebugState | null = null;
  private lastEntityId: number | null = null; // 跟踪上次选择的实体
  private needFitToContent: boolean = false; // 是否需要适应视图
  
  // 日志
  private logs: LogEntry[] = [];
  private maxLogs: number = 500;
  private logContainer: HTMLElement | null = null;

  // 日志监视器
  private logMonitor: LogMonitor | null = null;
  private logMonitorContent: HTMLElement | null = null;
  
  // 回调
  private onEntitySelect: ((entityId: number) => void) | null = null;

  constructor() {
    // 创建主容器
    this.container = document.createElement('div');
    this.container.id = 'debug-panel';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 600px;
      height: 100vh;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      pointer-events: none;
    `;
    
    // 创建面板
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 100%;
      height: 100%;
      background: rgba(30, 30, 46, 0.95);
      border-left: 2px solid #3a3a4a;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      pointer-events: auto;
    `;
    
    // 创建标题栏
    const titleBar = this.createTitleBar();
    this.panel.appendChild(titleBar);
    
    // 创建标签页
    const tabs = this.createTabs();
    this.panel.appendChild(tabs);
    
    // 创建内容区域
    const content = this.createContent();
    this.panel.appendChild(content);
    
    this.container.appendChild(this.panel);
    
    // 创建展开按钮
    const expandButton = this.createExpandButton();
    this.container.appendChild(expandButton);
    
    document.body.appendChild(this.container);
    
    // 创建渲染器
    this.canvas = document.createElement('canvas');
    this.renderer = new BehaviorTreeRenderer(this.canvas);
    
    // 开始渲染循环
    this.startRenderLoop();
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
      padding: 10px 15px;
      background: #1e1e2e;
      border-bottom: 1px solid #3a3a4a;
      min-height: 40px;
    `;
    
    // 标题
    const title = document.createElement('div');
    title.style.cssText = `
      color: #e0e0e0;
      font-size: 14px;
      font-weight: bold;
    `;
    title.textContent = '调试面板';
    titleBar.appendChild(title);
    
    // 单位信息
    const unitInfo = document.createElement('div');
    unitInfo.id = 'debug-unit-info';
    unitInfo.style.cssText = `
      color: #a0a0b0;
      font-size: 12px;
      flex: 1;
      text-align: center;
    `;
    unitInfo.textContent = '未选择单位';
    titleBar.appendChild(unitInfo);
    
    // 收起按钮
    const collapseButton = document.createElement('button');
    collapseButton.innerHTML = '✕';
    collapseButton.title = '收起面板';
    collapseButton.style.cssText = `
      background: none;
      border: none;
      color: #a0a0b0;
      font-size: 16px;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 4px;
    `;
    collapseButton.addEventListener('click', () => this.collapse());
    collapseButton.addEventListener('mouseenter', () => {
      collapseButton.style.background = '#3a3a4a';
      collapseButton.style.color = '#e0e0e0';
    });
    collapseButton.addEventListener('mouseleave', () => {
      collapseButton.style.background = 'none';
      collapseButton.style.color = '#a0a0b0';
    });
    titleBar.appendChild(collapseButton);
    
    return titleBar;
  }

  /**
   * 创建标签页
   */
  private createTabs(): HTMLElement {
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex;
      background: #252535;
      border-bottom: 1px solid #3a3a4a;
    `;
    
    // 行为树标签
    const btTab = document.createElement('button');
    btTab.id = 'tab-behavior-tree';
    btTab.textContent = '行为树';
    btTab.style.cssText = `
      flex: 1;
      padding: 10px;
      background: #3a3a4a;
      border: none;
      color: #e0e0e0;
      cursor: pointer;
      font-size: 12px;
    `;
    btTab.addEventListener('click', () => this.switchTab('behavior_tree'));
    tabs.appendChild(btTab);
    
    // 控制台标签
    const consoleTab = document.createElement('button');
    consoleTab.id = 'tab-console';
    consoleTab.textContent = '控制台';
    consoleTab.style.cssText = `
      flex: 1;
      padding: 10px;
      background: #252535;
      border: none;
      color: #a0a0b0;
      cursor: pointer;
      font-size: 12px;
    `;
    consoleTab.addEventListener('click', () => this.switchTab('console'));
    tabs.appendChild(consoleTab);

    // 日志监视器标签
    const logMonitorTab = document.createElement('button');
    logMonitorTab.id = 'tab-log-monitor';
    logMonitorTab.textContent = '日志';
    logMonitorTab.style.cssText = `
      flex: 1;
      padding: 10px;
      background: #252535;
      border: none;
      color: #a0a0b0;
      cursor: pointer;
      font-size: 12px;
    `;
    logMonitorTab.addEventListener('click', () => this.switchTab('log_monitor'));
    tabs.appendChild(logMonitorTab);
    
    return tabs;
  }

  /**
   * 创建内容区域
   */
  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // 行为树内容
    const btContent = document.createElement('div');
    btContent.id = 'content-behavior-tree';
    btContent.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `;
    
    // Canvas容器
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
      flex: 1;
      position: relative;
      min-height: 300px;
    `;
    canvasContainer.id = 'bt-canvas-container';
    btContent.appendChild(canvasContainer);
    
    // 节点信息面板
    const infoPanel = document.createElement('div');
    infoPanel.id = 'bt-node-info';
    infoPanel.style.cssText = `
      padding: 10px;
      background: #1e1e2e;
      border-top: 1px solid #3a3a4a;
      max-height: 150px;
      overflow-y: auto;
      font-size: 11px;
      color: #a0a0b0;
    `;
    infoPanel.textContent = '悬停在节点上查看详细信息';
    btContent.appendChild(infoPanel);
    
    content.appendChild(btContent);
    
    // 控制台内容
    const consoleContent = document.createElement('div');
    consoleContent.id = 'content-console';
    consoleContent.style.cssText = `
      flex: 1;
      display: none;
      flex-direction: column;
    `;
    
    // 控制台工具栏
    const consoleToolbar = document.createElement('div');
    consoleToolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 10px;
      background: #252535;
      border-bottom: 1px solid #3a3a4a;
    `;
    
    // 清除按钮
    const clearButton = document.createElement('button');
    clearButton.textContent = '清除';
    clearButton.style.cssText = `
      padding: 5px 10px;
      background: #3a3a4a;
      border: none;
      color: #e0e0e0;
      cursor: pointer;
      font-size: 11px;
      border-radius: 4px;
    `;
    clearButton.addEventListener('click', () => this.clearLogs());
    consoleToolbar.appendChild(clearButton);
    
    // 自动滚动开关
    const autoScrollLabel = document.createElement('label');
    autoScrollLabel.style.cssText = `
      display: flex;
      align-items: center;
      gap: 5px;
      color: #a0a0b0;
      font-size: 11px;
      cursor: pointer;
    `;
    const autoScrollCheckbox = document.createElement('input');
    autoScrollCheckbox.type = 'checkbox';
    autoScrollCheckbox.checked = true;
    autoScrollLabel.appendChild(autoScrollCheckbox);
    autoScrollLabel.appendChild(document.createTextNode('自动滚动'));
    consoleToolbar.appendChild(autoScrollLabel);
    
    consoleContent.appendChild(consoleToolbar);
    
    // 日志容器
    this.logContainer = document.createElement('div');
    this.logContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      font-family: ${FONT_FAMILY};
      font-size: 11px;
      background: #1e1e2e;
    `;
    consoleContent.appendChild(this.logContainer);

    content.appendChild(consoleContent);

    // 日志监视器内容
    const logMonitorContent = document.createElement('div');
    logMonitorContent.id = 'content-log-monitor';
    logMonitorContent.style.cssText = `
      flex: 1;
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;
    this.logMonitorContent = logMonitorContent;
    content.appendChild(logMonitorContent);

    return content;
  }

  /**
   * 创建展开按钮
   */
  private createExpandButton(): HTMLElement {
    const button = document.createElement('button');
    button.id = 'debug-expand-button';
    button.innerHTML = '🔧';
    button.title = '打开调试面板 (F12)';
    button.style.cssText = `
      position: absolute;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: 36px;
      height: 36px;
      background: rgba(30, 30, 46, 0.9);
      border: 2px solid #3a3a4a;
      border-right: none;
      border-radius: 8px 0 0 8px;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      transition: all 0.2s ease;
      z-index: 9999;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(58, 58, 74, 0.95)';
      button.style.width = '42px';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(30, 30, 46, 0.9)';
      button.style.width = '36px';
    });
    
    button.addEventListener('click', () => this.expand());
    
    return button;
  }

  /**
   * 切换标签页
   */
  private switchTab(tab: 'behavior_tree' | 'console' | 'log_monitor'): void {
    this.activeTab = tab;

    // 更新标签样式
    const btTab = document.getElementById('tab-behavior-tree');
    const consoleTab = document.getElementById('tab-console');
    const logMonitorTab = document.getElementById('tab-log-monitor');
    const btContent = document.getElementById('content-behavior-tree');
    const consoleContent = document.getElementById('content-console');
    const logMonitorContent = document.getElementById('content-log-monitor');

    // 重置所有标签样式
    if (btTab) { btTab.style.background = '#252535'; btTab.style.color = '#a0a0b0'; }
    if (consoleTab) { consoleTab.style.background = '#252535'; consoleTab.style.color = '#a0a0b0'; }
    if (logMonitorTab) { logMonitorTab.style.background = '#252535'; logMonitorTab.style.color = '#a0a0b0'; }

    // 隐藏所有内容
    if (btContent) btContent.style.display = 'none';
    if (consoleContent) consoleContent.style.display = 'none';
    if (logMonitorContent) logMonitorContent.style.display = 'none';

    if (tab === 'behavior_tree') {
      if (btTab) { btTab.style.background = '#3a3a4a'; btTab.style.color = '#e0e0e0'; }
      if (btContent) btContent.style.display = 'flex';
    } else if (tab === 'console') {
      if (consoleTab) { consoleTab.style.background = '#3a3a4a'; consoleTab.style.color = '#e0e0e0'; }
      if (consoleContent) consoleContent.style.display = 'flex';
    } else if (tab === 'log_monitor') {
      if (logMonitorTab) { logMonitorTab.style.background = '#3a3a4a'; logMonitorTab.style.color = '#e0e0e0'; }
      if (logMonitorContent) logMonitorContent.style.display = 'flex';
      // 延迟初始化日志监视器（首次切换到该标签时创建）
      this.ensureLogMonitorCreated();
    }
  }

  /**
   * 展开面板
   */
  expand(): void {
    this.isExpanded = true;
    this.panel.style.transform = 'translateX(0)';
    
    // 隐藏展开按钮
    const expandButton = document.getElementById('debug-expand-button');
    if (expandButton) {
      expandButton.style.display = 'none';
    }
    
    // 延迟调整Canvas大小
    setTimeout(() => this.resizeCanvas(), 300);
  }

  /**
   * 收起面板
   */
  collapse(): void {
    this.isExpanded = false;
    this.panel.style.transform = 'translateX(100%)';
    
    // 显示展开按钮
    const expandButton = document.getElementById('debug-expand-button');
    if (expandButton) {
      expandButton.style.display = 'flex';
    }
  }

  /**
   * 切换展开/收起
   */
  toggle(): void {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /**
   * 调整Canvas大小
   */
  private resizeCanvas(): void {
    const container = document.getElementById('bt-canvas-container');
    if (!container || !this.canvas) return;
    
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvas.style.display = 'block';
    
    // 重新添加Canvas到容器
    if (!container.contains(this.canvas)) {
      container.appendChild(this.canvas);
    }
    
    // 适应视图
    this.renderer.fitToContent();
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(): void {
    const render = () => {
      if (this.isExpanded && this.activeTab === 'behavior_tree') {
        this.renderBehaviorTree();
        this.updateNodeInfo();
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /**
   * 渲染行为树
   */
  private renderBehaviorTree(): void {
    if (!this.canvas) return;
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    // 如果需要适应视图（选择了新单位）
    if (this.needFitToContent && this.currentState?.root) {
      this.needFitToContent = false;
      this.resizeCanvas();
      this.renderer.fitToContent();
    }
    
    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.currentState?.root) {
      // 显示提示信息
      ctx.fillStyle = '#a0a0b0';
      ctx.font = FONTS.body;
      ctx.textAlign = 'center';
      ctx.fillText('选择一个单位查看其AI行为树', this.canvas.width / 2, this.canvas.height / 2);
      return;
    }
    
    // 渲染行为树
    this.renderer.render(this.currentState.root);
  }

  /**
   * 更新节点信息
   */
  private updateNodeInfo(): void {
    const infoPanel = document.getElementById('bt-node-info');
    if (!infoPanel) return;
    
    const hoveredNodeId = this.renderer.getHoveredNodeId();
    
    if (!hoveredNodeId || !this.currentState?.root) {
      infoPanel.textContent = '悬停在节点上查看详细信息';
      return;
    }
    
    const node = this.findNode(this.currentState.root, hoveredNodeId);
    if (node) {
      infoPanel.innerHTML = this.formatNodeInfo(node);
    }
  }

  /**
   * 查找节点
   */
  private findNode(root: BTNodeDebugInfo, nodeId: string): BTNodeDebugInfo | null {
    if (root.id === nodeId) return root;
    
    if (root.children) {
      for (const child of root.children) {
        const found = this.findNode(child, nodeId);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * 格式化节点信息
   */
  private formatNodeInfo(node: BTNodeDebugInfo): string {
    const statusColors: Record<string, string> = {
      idle: '#757575',
      running: '#4CAF50',
      success: '#2196F3',
      failure: '#f44336',
    };
    
    const statusLabels: Record<string, string> = {
      idle: '空闲',
      running: '运行中',
      success: '成功',
      failure: '失败',
    };
    
    let html = `
      <div style="margin-bottom: 5px;">
        <span style="font-weight: bold; color: #e0e0e0;">${node.name}</span>
        <span style="color: #666; margin-left: 8px;">(${node.type})</span>
      </div>
      <div style="margin-bottom: 5px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColors[node.status] || '#757575'}; margin-right: 5px;"></span>
        <span style="color: ${statusColors[node.status] || '#757575'};">${statusLabels[node.status] || node.status}</span>
      </div>
    `;
    
    if (node.executionTime !== undefined) {
      html += `<div style="color: #666;">执行时间: ${node.executionTime.toFixed(2)}ms</div>`;
    }
    
    if (node.params && Object.keys(node.params).length > 0) {
      html += `<div style="margin-top: 5px; color: #666;">参数: ${JSON.stringify(node.params)}</div>`;
    }
    
    return html;
  }

  /**
   * 更新行为树状态
   */
  updateBehaviorTreeState(state: BehaviorTreeDebugState | null): void {
    // 检查是否选择了新单位
    const isNewEntity = state && (!this.currentState || state.entityId !== this.lastEntityId);
    
    this.currentState = state;
    
    if (isNewEntity) {
      this.lastEntityId = state!.entityId;
      this.needFitToContent = true; // 标记需要适应视图
    }
    
    // 更新单位信息
    const unitInfo = document.getElementById('debug-unit-info');
    if (unitInfo) {
      if (state) {
        unitInfo.textContent = `${state.unitName} (${state.aiConfigId})`;
      } else {
        unitInfo.textContent = '未选择单位';
        this.lastEntityId = null;
      }
    }
  }

  /**
   * 添加日志
   */
  addLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // 如果控制台可见，更新显示
    if (this.isExpanded && this.activeTab === 'console' && this.logContainer) {
      this.appendLogElement(entry);
      
      // 自动滚动
      const autoScrollCheckbox = this.logContainer.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (autoScrollCheckbox?.checked) {
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
      }
    }
  }

  /**
   * 追加日志元素
   */
  private appendLogElement(entry: LogEntry): void {
    if (!this.logContainer) return;
    
    const logElement = document.createElement('div');
    logElement.style.cssText = `
      padding: 3px 5px;
      border-bottom: 1px solid #2a2a3a;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    `;
    
    // 时间戳
    const timestamp = document.createElement('span');
    timestamp.style.cssText = `
      color: #555;
      min-width: 70px;
      flex-shrink: 0;
    `;
    const date = new Date(entry.timestamp);
    timestamp.textContent = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    logElement.appendChild(timestamp);
    
    // 级别
    const levelColors: Record<string, string> = {
      debug: '#757575',
      info: '#2196F3',
      warn: '#FF9800',
      error: '#f44336',
    };
    
    const level = document.createElement('span');
    level.style.cssText = `
      color: ${levelColors[entry.level] || '#757575'};
      min-width: 40px;
      font-weight: bold;
      flex-shrink: 0;
    `;
    level.textContent = entry.level.toUpperCase().slice(0, 4);
    logElement.appendChild(level);
    
    // 分类
    const category = document.createElement('span');
    category.style.cssText = `
      color: #9C27B0;
      min-width: 60px;
      flex-shrink: 0;
    `;
    category.textContent = `[${entry.category}]`;
    logElement.appendChild(category);
    
    // 消息
    const message = document.createElement('span');
    message.style.cssText = `
      color: #e0e0e0;
      word-break: break-all;
      flex: 1;
    `;
    message.textContent = entry.message;
    logElement.appendChild(message);
    
    this.logContainer.appendChild(logElement);
  }

  /**
   * 清除日志
   */
  private clearLogs(): void {
    this.logs = [];
    if (this.logContainer) {
      this.logContainer.innerHTML = '';
    }
  }

  /**
   * 获取是否展开
   */
  getIsExpanded(): boolean {
    return this.isExpanded;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.logMonitor?.destroy();
    this.logMonitor = null;
    this.container.remove();
    window.removeEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * 延迟创建日志监视器（首次切换到日志标签时）
   */
  private ensureLogMonitorCreated(): void {
    if (this.logMonitor || !this.logMonitorContent) return;
    this.logMonitor = new LogMonitor(this.logMonitorContent);
  }
}
