import { BehaviorTreeRenderer } from './BehaviorTreeRenderer.js';
import type { BTNodeDebugInfo, BehaviorTreeDebugState } from './types.js';
import { FONTS } from '../config/fonts.js';

export class BehaviorTreeWindow {
  private overlay: HTMLElement;
  private titleText: HTMLElement;
  private canvas: HTMLCanvasElement;
  private canvasContainer: HTMLElement;
  private infoPanel: HTMLElement;
  private renderer: BehaviorTreeRenderer;

  private isOpen: boolean = false;
  private currentState: BehaviorTreeDebugState | null = null;
  private lastEntityId: number | null = null;
  private needFitToContent: boolean = false;
  private rafHandle: number | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'debug-bt-window';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 10000;
      display: none;
      flex-direction: column;
      pointer-events: auto;
    `;

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #1e1e2e;
      border-bottom: 1px solid #3a3a4a;
      flex-shrink: 0;
    `;

    this.titleText = document.createElement('div');
    this.titleText.style.cssText = 'color: #e0e0e0; font-size: 14px; font-weight: bold;';
    this.titleText.textContent = '行为树查看器';
    titleBar.appendChild(this.titleText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭 (Esc)';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #a0a0b0;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 4px;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#3a3a4a';
      closeBtn.style.color = '#e0e0e0';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'none';
      closeBtn.style.color = '#a0a0b0';
    });
    closeBtn.addEventListener('click', () => this.hide());
    titleBar.appendChild(closeBtn);

    this.overlay.appendChild(titleBar);

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.style.cssText = `
      flex: 1;
      position: relative;
      background: #1a1a2e;
      overflow: hidden;
    `;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display: block;';
    this.canvasContainer.appendChild(this.canvas);
    this.overlay.appendChild(this.canvasContainer);

    this.infoPanel = document.createElement('div');
    this.infoPanel.style.cssText = `
      padding: 10px 20px;
      background: #1e1e2e;
      border-top: 1px solid #3a3a4a;
      max-height: 120px;
      overflow-y: auto;
      font-size: 11px;
      color: #a0a0b0;
      flex-shrink: 0;
    `;
    this.infoPanel.textContent = '悬停在节点上查看详细信息';
    this.overlay.appendChild(this.infoPanel);

    document.body.appendChild(this.overlay);

    this.renderer = new BehaviorTreeRenderer(this.canvas);
  }

  show(state: BehaviorTreeDebugState | null): void {
    this.updateState(state);
    if (this.isOpen) return;
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.resizeCanvas();
      this.needFitToContent = true;
      this.startRenderLoop();
    });
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.stopRenderLoop();
  }

  toggle(state: BehaviorTreeDebugState | null): void {
    if (this.isOpen) this.hide();
    else this.show(state);
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }

  updateState(state: BehaviorTreeDebugState | null): void {
    const isNewEntity = state && (!this.currentState || state.entityId !== this.lastEntityId);
    this.currentState = state;
    if (isNewEntity) {
      this.lastEntityId = state!.entityId;
      this.needFitToContent = true;
    } else if (!state) {
      this.lastEntityId = null;
    }

    if (state) {
      this.titleText.textContent = `行为树查看器 · ${state.unitName} (${state.aiConfigId})`;
    } else {
      this.titleText.textContent = '行为树查看器 · 未选中单位';
    }
  }

  private resizeCanvas(): void {
    const rect = this.canvasContainer.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  private startRenderLoop(): void {
    if (this.rafHandle !== null) return;
    const loop = () => {
      if (!this.isOpen) {
        this.rafHandle = null;
        return;
      }
      this.renderFrame();
      this.updateNodeInfo();
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  private stopRenderLoop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private renderFrame(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    if (this.needFitToContent && this.currentState?.root) {
      this.needFitToContent = false;
      this.resizeCanvas();
      this.renderer.fitToContent();
    }

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.currentState?.root) {
      ctx.fillStyle = '#a0a0b0';
      ctx.font = FONTS.body;
      ctx.textAlign = 'center';
      ctx.fillText('请在战斗中点击一个单位以查看其行为树', this.canvas.width / 2, this.canvas.height / 2);
      return;
    }

    this.renderer.render(this.currentState.root);
  }

  private updateNodeInfo(): void {
    const hoveredNodeId = this.renderer.getHoveredNodeId();
    if (!hoveredNodeId || !this.currentState?.root) {
      this.infoPanel.textContent = '悬停在节点上查看详细信息';
      return;
    }
    const node = this.findNode(this.currentState.root, hoveredNodeId);
    if (node) {
      this.infoPanel.innerHTML = this.formatNodeInfo(node);
    }
  }

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
    const dot = statusColors[node.status] || '#757575';
    const label = statusLabels[node.status] || node.status;

    let html = `
      <div style="margin-bottom: 5px;">
        <span style="font-weight: bold; color: #e0e0e0;">${node.name}</span>
        <span style="color: #666; margin-left: 8px;">(${node.type})</span>
      </div>
      <div style="margin-bottom: 5px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dot}; margin-right: 5px;"></span>
        <span style="color: ${dot};">${label}</span>
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

  destroy(): void {
    this.stopRenderLoop();
    this.overlay.remove();
  }
}
