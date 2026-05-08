import { BehaviorTreeRenderer } from './BehaviorTreeRenderer.js';
import type { BTNodeDebugInfo, BehaviorTreeDebugState } from './types.js';
import { NodeExecutionStatus } from './types.js';

/**
 * 行为树查看器
 * 
 * 提供行为树的可视化界面，包括：
 * - 行为树结构渲染
 * - 节点状态高亮
 * - 节点详细信息面板
 * - 控制按钮
 */
export class BehaviorTreeViewer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: BehaviorTreeRenderer;
  private infoPanel: HTMLElement;
  private controlPanel: HTMLElement;
  
  // 状态
  private currentState: BehaviorTreeDebugState | null = null;
  private selectedNodeId: string | null = null;
  private isVisible: boolean = false;
  private refreshTimer: number | null = null;
  
  // 回调
  private onClose: (() => void) | null = null;
  private onEntitySelect: ((entityId: number) => void) | null = null;

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
    
    // 创建主内容区域
    const content = document.createElement('div');
    content.style.cssText = `
      display: flex;
      flex: 1;
      overflow: hidden;
    `;
    
    // 创建Canvas容器
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
      flex: 1;
      position: relative;
      overflow: hidden;
    `;
    
    // 创建Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      width: 100%;
      height: 100%;
      cursor: grab;
    `;
    canvasContainer.appendChild(this.canvas);
    content.appendChild(canvasContainer);
    
    // 创建右侧面板
    const rightPanel = document.createElement('div');
    rightPanel.style.cssText = `
      width: 300px;
      background: #252535;
      border-left: 1px solid #3a3a4a;
      display: flex;
      flex-direction: column;
    `;
    
    // 创建节点信息面板
    this.infoPanel = this.createInfoPanel();
    rightPanel.appendChild(this.infoPanel);
    
    // 创建控制面板
    this.controlPanel = this.createControlPanel();
    rightPanel.appendChild(this.controlPanel);
    
    content.appendChild(rightPanel);
    this.container.appendChild(content);
    
    // 创建渲染器
    this.renderer = new BehaviorTreeRenderer(this.canvas);
    
    // 设置Canvas大小
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
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
    title.textContent = '行为树查看器';
    titleBar.appendChild(title);
    
    // 单位信息
    const unitInfo = document.createElement('div');
    unitInfo.id = 'bt-unit-info';
    unitInfo.style.cssText = `
      color: #a0a0b0;
      font-size: 14px;
    `;
    unitInfo.textContent = '未选择单位';
    titleBar.appendChild(unitInfo);
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
    `;
    
    // 适应视图按钮
    const fitButton = this.createButton('适应视图', () => this.renderer.fitToContent());
    buttonContainer.appendChild(fitButton);
    
    // 重置视图按钮
    const resetButton = this.createButton('重置视图', () => this.renderer.resetView());
    buttonContainer.appendChild(resetButton);
    
    // 关闭按钮
    const closeButton = this.createButton('关闭', () => this.hide());
    closeButton.style.background = '#f44336';
    buttonContainer.appendChild(closeButton);
    
    titleBar.appendChild(buttonContainer);
    
    return titleBar;
  }

  /**
   * 创建信息面板
   */
  private createInfoPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      flex: 1;
      padding: 15px;
      overflow-y: auto;
    `;
    
    const title = document.createElement('div');
    title.style.cssText = `
      color: #e0e0e0;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #3a3a4a;
    `;
    title.textContent = '节点信息';
    panel.appendChild(title);
    
    const content = document.createElement('div');
    content.id = 'bt-node-info';
    content.style.cssText = `
      color: #a0a0b0;
      font-size: 12px;
      line-height: 1.6;
    `;
    content.textContent = '悬停在节点上查看详细信息';
    panel.appendChild(content);
    
    return panel;
  }

  /**
   * 创建控制面板
   */
  private createControlPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      padding: 15px;
      background: #1e1e2e;
      border-top: 1px solid #3a3a4a;
    `;
    
    const title = document.createElement('div');
    title.style.cssText = `
      color: #e0e0e0;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
    `;
    title.textContent = '控制';
    panel.appendChild(title);
    
    // 黑板数据
    const blackboardTitle = document.createElement('div');
    blackboardTitle.style.cssText = `
      color: #a0a0b0;
      font-size: 12px;
      margin-bottom: 5px;
    `;
    blackboardTitle.textContent = '黑板数据:';
    panel.appendChild(blackboardTitle);
    
    const blackboardContent = document.createElement('pre');
    blackboardContent.id = 'bt-blackboard';
    blackboardContent.style.cssText = `
      background: #2d2d3f;
      padding: 10px;
      border-radius: 4px;
      font-size: 11px;
      color: #e0e0e0;
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    `;
    blackboardContent.textContent = '{}';
    panel.appendChild(blackboardContent);
    
    return panel;
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
   * 调整Canvas大小
   */
  private resizeCanvas(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(): void {
    const render = () => {
      if (this.isVisible) {
        this.render();
        this.updateInfoPanel();
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /**
   * 渲染
   */
  private render(): void {
    if (!this.currentState?.root) {
      this.renderer.render(null);
      return;
    }
    
    this.renderer.render(this.currentState.root);
  }

  /**
   * 更新信息面板
   */
  private updateInfoPanel(): void {
    const hoveredNodeId = this.renderer.getHoveredNodeId();
    const infoContent = document.getElementById('bt-node-info');
    const blackboardContent = document.getElementById('bt-blackboard');
    const unitInfo = document.getElementById('bt-unit-info');
    
    if (!infoContent || !blackboardContent || !unitInfo) return;
    
    // 更新单位信息
    if (this.currentState) {
      unitInfo.textContent = `${this.currentState.unitName} (${this.currentState.aiConfigId})`;
    } else {
      unitInfo.textContent = '未选择单位';
    }
    
    // 更新节点信息
    if (hoveredNodeId && this.currentState?.root) {
      const node = this.findNode(this.currentState.root, hoveredNodeId);
      if (node) {
        infoContent.innerHTML = this.formatNodeInfo(node);
      } else {
        infoContent.textContent = '悬停在节点上查看详细信息';
      }
    } else {
      infoContent.textContent = '悬停在节点上查看详细信息';
    }
    
    // 更新黑板数据
    if (this.currentState?.blackboard) {
      blackboardContent.textContent = JSON.stringify(this.currentState.blackboard, null, 2);
    } else {
      blackboardContent.textContent = '{}';
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
    const statusColors: Record<NodeExecutionStatus, string> = {
      idle: '#757575',
      running: '#4CAF50',
      success: '#2196F3',
      failure: '#f44336',
    };
    
    const statusLabels: Record<NodeExecutionStatus, string> = {
      idle: '空闲',
      running: '运行中',
      success: '成功',
      failure: '失败',
    };
    
    let html = `
      <div style="margin-bottom: 10px;">
        <div style="font-weight: bold; color: #e0e0e0; font-size: 14px;">${node.name}</div>
        <div style="color: #a0a0b0; font-size: 11px;">${node.type}</div>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColors[node.status]}; margin-right: 6px;"></span>
        <span style="color: ${statusColors[node.status]};">${statusLabels[node.status]}</span>
      </div>
    `;
    
    if (node.executionTime !== undefined) {
      html += `
        <div style="margin-bottom: 8px; color: #a0a0b0;">
          执行时间: ${node.executionTime.toFixed(2)}ms
        </div>
      `;
    }
    
    if (node.params && Object.keys(node.params).length > 0) {
      html += `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #3a3a4a;">
          <div style="color: #a0a0b0; font-size: 11px; margin-bottom: 5px;">参数:</div>
          <pre style="background: #2d2d3f; padding: 8px; border-radius: 4px; font-size: 10px; color: #e0e0e0; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(node.params, null, 2)}</pre>
        </div>
      `;
    }
    
    return html;
  }

  /**
   * 更新状态
   */
  updateState(state: BehaviorTreeDebugState | null): void {
    this.currentState = state;
  }

  /**
   * 显示查看器
   */
  show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';
    this.resizeCanvas();
    this.renderer.fitToContent();
  }

  /**
   * 隐藏查看器
   */
  hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * 设置关闭回调
   */
  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  /**
   * 设置实体选择回调
   */
  setOnEntitySelect(callback: (entityId: number) => void): void {
    this.onEntitySelect = callback;
  }

  /**
   * 获取是否可见
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    window.removeEventListener('resize', () => this.resizeCanvas());
  }
}
