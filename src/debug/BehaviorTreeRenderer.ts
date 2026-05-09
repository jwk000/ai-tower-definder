import type { BTNodeDebugInfo, NodeExecutionStatus } from './types.js';
import { FONTS, FONT_FAMILY } from '../config/fonts.js';

/**
 * 行为树可视化渲染器
 * 
 * 负责将行为树结构渲染到Canvas上，支持节点状态高亮和交互。
 */
export class BehaviorTreeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // 视图状态
  private offsetX: number = 0;
  private offsetY: number = 0;
  private scale: number = 1.0;
  
  // 节点布局配置
  private nodeWidth: number = 200;
  private nodeHeight: number = 70;
  private horizontalGap: number = 30;  // 节点间水平间距
  private verticalGap: number = 80;    // 节点间垂直间距
  private levelHeight: number = 120;   // 层级高度
  
  // 交互状态
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private hoveredNodeId: string | null = null;
  
  // 节点位置缓存
  private nodePositions: Map<string, { x: number; y: number; width: number; height: number }> = new Map();
  
  // 子树宽度缓存
  private subtreeWidths: Map<string, number> = new Map();
  
  // 颜色配置
  private colors = {
    background: '#1a1a2e',
    nodeIdle: '#2d2d44',
    nodeRunning: '#1a5a1a',
    nodeSuccess: '#1a3a5a',
    nodeFailure: '#5a1a1a',
    border: '#4a4a6a',
    borderRunning: '#4CAF50',
    borderSuccess: '#2196F3',
    borderFailure: '#f44336',
    borderHover: '#9a9acc',
    text: '#ffffff',
    textSecondary: '#b0b0c0',
    connection: '#5a5a7a',
    connectionRunning: '#4CAF50',
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;
      this.offsetX += deltaX;
      this.offsetY += deltaY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
    
    // 检测悬停节点
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.offsetX) / this.scale;
    const y = (e.clientY - rect.top - this.offsetY) / this.scale;
    this.hoveredNodeId = this.getNodeAtPosition(x, y);
  }

  /**
   * 鼠标释放事件
   */
  private onMouseUp(): void {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }

  /**
   * 滚轮事件
   */
  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    
    // 获取鼠标位置
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算缩放
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(2.0, this.scale * delta));
    
    // 调整偏移以保持鼠标位置不变
    const scaleRatio = newScale / this.scale;
    this.offsetX = mouseX - (mouseX - this.offsetX) * scaleRatio;
    this.offsetY = mouseY - (mouseY - this.offsetY) * scaleRatio;
    
    this.scale = newScale;
  }

  /**
   * 获取指定位置的节点
   */
  private getNodeAtPosition(x: number, y: number): string | null {
    for (const [nodeId, pos] of this.nodePositions) {
      if (x >= pos.x && x <= pos.x + pos.width &&
          y >= pos.y && y <= pos.y + pos.height) {
        return nodeId;
      }
    }
    return null;
  }

  /**
   * 渲染行为树
   */
  render(root: BTNodeDebugInfo | null): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    
    // 清空画布
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);
    
    if (!root) {
      return;
    }
    
    // 计算布局
    this.nodePositions.clear();
    this.subtreeWidths.clear();
    this.calculateSubtreeWidths(root);
    this.calculateLayout(root, 0, 0);
    
    // 应用变换
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    
    // 绘制连接线（先绘制，确保在节点下方）
    this.drawConnections(root);
    
    // 绘制节点
    this.drawNodes(root);
    
    ctx.restore();
  }

  /**
   * 计算子树宽度（自底向上）
   */
  private calculateSubtreeWidths(node: BTNodeDebugInfo): number {
    if (!node.children || node.children.length === 0) {
      // 叶子节点宽度就是节点本身宽度
      this.subtreeWidths.set(node.id, this.nodeWidth);
      return this.nodeWidth;
    }
    
    // 计算所有子树的总宽度
    let totalChildrenWidth = 0;
    for (const child of node.children) {
      totalChildrenWidth += this.calculateSubtreeWidths(child);
    }
    
    // 加上子节点间的间距
    totalChildrenWidth += (node.children.length - 1) * this.horizontalGap;
    
    // 子树宽度取子节点总宽度和节点本身宽度的较大值
    const subtreeWidth = Math.max(this.nodeWidth, totalChildrenWidth);
    this.subtreeWidths.set(node.id, subtreeWidth);
    
    return subtreeWidth;
  }

  /**
   * 计算节点布局（自顶向下）
   */
  private calculateLayout(node: BTNodeDebugInfo, centerX: number, y: number): void {
    const subtreeWidth = this.subtreeWidths.get(node.id) || this.nodeWidth;
    
    // 当前节点居中放置
    const nodeX = centerX - this.nodeWidth / 2;
    const pos = { x: nodeX, y, width: this.nodeWidth, height: this.nodeHeight };
    this.nodePositions.set(node.id, pos);
    
    if (!node.children || node.children.length === 0) {
      return;
    }
    
    // 计算子节点的总宽度
    let totalChildrenWidth = 0;
    for (const child of node.children) {
      totalChildrenWidth += this.subtreeWidths.get(child.id) || this.nodeWidth;
    }
    totalChildrenWidth += (node.children.length - 1) * this.horizontalGap;
    
    // 子节点起始X位置（居中对齐）
    let childX = centerX - totalChildrenWidth / 2;
    const childY = y + this.levelHeight;
    
    // 递归布局子节点
    for (const child of node.children) {
      const childSubtreeWidth = this.subtreeWidths.get(child.id) || this.nodeWidth;
      const childCenterX = childX + childSubtreeWidth / 2;
      
      this.calculateLayout(child, childCenterX, childY);
      
      childX += childSubtreeWidth + this.horizontalGap;
    }
  }

  /**
   * 绘制连接线
   */
  private drawConnections(node: BTNodeDebugInfo): void {
    if (!node.children || node.children.length === 0) return;
    
    const ctx = this.ctx;
    const parentPos = this.nodePositions.get(node.id);
    if (!parentPos) return;
    
    const parentCenterX = parentPos.x + parentPos.width / 2;
    const parentBottomY = parentPos.y + parentPos.height;
    
    for (const child of node.children) {
      const childPos = this.nodePositions.get(child.id);
      if (!childPos) continue;
      
      const childCenterX = childPos.x + childPos.width / 2;
      const childTopY = childPos.y;
      
      // 绘制曲线连接
      const isRunningPath = node.status === 'running' && child.status === 'running';
      ctx.beginPath();
      ctx.strokeStyle = isRunningPath ? this.colors.connectionRunning : this.colors.connection;
      ctx.lineWidth = isRunningPath ? 3 : 2;
      
      const midY = (parentBottomY + childTopY) / 2;
      ctx.moveTo(parentCenterX, parentBottomY);
      ctx.bezierCurveTo(
        parentCenterX, midY,
        childCenterX, midY,
        childCenterX, childTopY
      );
      ctx.stroke();
      
      // 递归绘制子节点连接
      this.drawConnections(child);
    }
  }

  /**
   * 绘制节点
   */
  private drawNodes(node: BTNodeDebugInfo): void {
    const pos = this.nodePositions.get(node.id);
    if (!pos) return;
    
    const ctx = this.ctx;
    const isHovered = this.hoveredNodeId === node.id;
    
    // 绘制节点背景
    ctx.fillStyle = this.getNodeColor(node.status);
    
    // 根据状态设置边框颜色
    let borderColor = this.colors.border;
    let borderWidth = 2;
    if (isHovered) {
      borderColor = this.colors.borderHover;
      borderWidth = 3;
    } else if (node.status === 'running') {
      borderColor = this.colors.borderRunning;
      borderWidth = 3;
    } else if (node.status === 'success') {
      borderColor = this.colors.borderSuccess;
      borderWidth = 2;
    } else if (node.status === 'failure') {
      borderColor = this.colors.borderFailure;
      borderWidth = 2;
    }
    
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    
    // 绘制圆角矩形
    this.drawRoundedRect(pos.x, pos.y, pos.width, pos.height, 8);
    ctx.fill();
    ctx.stroke();
    
    // 运行状态添加发光效果
    if (node.status === 'running') {
      ctx.save();
      ctx.shadowColor = '#4CAF50';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 1;
      this.drawRoundedRect(pos.x + 2, pos.y + 2, pos.width - 4, pos.height - 4, 6);
      ctx.stroke();
      ctx.restore();
    }
    
    // 绘制节点类型图标
    this.drawNodeIcon(node, pos.x + 10, pos.y + 12, 24, 24);
    
    // 绘制节点名称
    ctx.fillStyle = this.colors.text;
    ctx.font = FONTS.debug;
    ctx.textAlign = 'left';
    ctx.fillText(this.truncateText(node.name, 16), pos.x + 42, pos.y + 28);
    
    // 绘制节点类型
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = FONTS.debugTiny;
    ctx.fillText(node.type, pos.x + 42, pos.y + 48);
    
    // 绘制状态指示器
    this.drawStatusIndicator(node.status, pos.x + pos.width - 18, pos.y + 18);
    
    // 递归绘制子节点
    if (node.children) {
      for (const child of node.children) {
        this.drawNodes(child);
      }
    }
  }

  /**
   * 获取节点颜色
   */
  private getNodeColor(status: NodeExecutionStatus): string {
    switch (status) {
      case 'running':
        return this.colors.nodeRunning;
      case 'success':
        return this.colors.nodeSuccess;
      case 'failure':
        return this.colors.nodeFailure;
      default:
        return this.colors.nodeIdle;
    }
  }

  /**
   * 绘制节点图标
   */
  private drawNodeIcon(node: BTNodeDebugInfo, x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const size = Math.min(width, height) / 2 - 2;
    
    ctx.fillStyle = this.colors.text;
    ctx.strokeStyle = this.colors.text;
    ctx.lineWidth = 2;
    
    switch (node.type) {
      case 'sequence':
        // 顺序节点：箭头向右
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size / 2);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX - size, centerY + size / 2);
        ctx.closePath();
        ctx.stroke();
        break;
        
      case 'selector':
        // 选择节点：问号
        ctx.font = `bold ${size * 1.8}px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', centerX, centerY);
        break;
        
      case 'check_hp':
      case 'check_enemy_in_range':
      case 'check_ally_in_range':
      case 'check_buff':
      case 'check_cooldown':
      case 'check_phase':
      case 'check_target_alive':
      case 'check_distance_to_target':
      case 'check_moving':
      case 'check_stunned':
      case 'check_player_control':
        // 条件节点：菱形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size);
        ctx.lineTo(centerX - size, centerY);
        ctx.closePath();
        ctx.stroke();
        break;
        
      case 'attack':
      case 'move_to':
      case 'move_towards':
      case 'flee':
      case 'use_skill':
      case 'wait':
      case 'spawn':
      case 'patrol':
      case 'set_target':
      case 'clear_target':
      case 'play_animation':
        // 动作节点：圆形
        ctx.beginPath();
        ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case 'inverter':
      case 'repeater':
      case 'until_fail':
      case 'always_succeed':
      case 'cooldown':
        // 装饰节点：六边形
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 2;
          const px = centerX + size * Math.cos(angle);
          const py = centerY + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
        
      default:
        // 默认：方形
        ctx.strokeRect(centerX - size, centerY - size, size * 2, size * 2);
        break;
    }
  }

  /**
   * 绘制状态指示器
   */
  private drawStatusIndicator(status: NodeExecutionStatus, x: number, y: number): void {
    const ctx = this.ctx;
    const radius = 8;
    
    let color: string;
    let glowColor: string;
    switch (status) {
      case 'running':
        color = '#4CAF50';
        glowColor = '#81C784';
        break;
      case 'success':
        color = '#2196F3';
        glowColor = '#64B5F6';
        break;
      case 'failure':
        color = '#f44336';
        glowColor = '#EF5350';
        break;
      default:
        color = '#616161';
        glowColor = '#9E9E9E';
        break;
    }
    
    // 绘制发光效果
    if (status === 'running' || status === 'success' || status === 'failure') {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 运行状态添加脉冲动画
    if (status === 'running') {
      const time = Date.now() / 1000;
      const pulseRadius = radius + 4 + Math.sin(time * 4) * 2;
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(time * 4) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * 绘制圆角矩形
   */
  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '..';
  }

  /**
   * 重置视图
   */
  resetView(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1.0;
  }

  /**
   * 适应视图到内容
   */
  fitToContent(): void {
    if (this.nodePositions.size === 0) return;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const pos of this.nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    }
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const canvasWidth = this.canvas.width / window.devicePixelRatio;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    
    // 计算缩放比例，留出边距
    const padding = 60;
    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    this.scale = Math.min(scaleX, scaleY, 1.2);
    
    // 居中内容
    this.offsetX = (canvasWidth - contentWidth * this.scale) / 2 - minX * this.scale;
    this.offsetY = padding - minY * this.scale;
  }

  /**
   * 获取悬停的节点ID
   */
  getHoveredNodeId(): string | null {
    return this.hoveredNodeId;
  }

  /**
   * 清除状态
   */
  clear(): void {
    this.nodePositions.clear();
    this.subtreeWidths.clear();
    this.hoveredNodeId = null;
  }
}
