import type { BTNodeDebugInfo, NodeExecutionStatus } from './types.js';

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
  
  // 节点布局 - 增大尺寸
  private nodeWidth: number = 220;
  private nodeHeight: number = 80;
  private horizontalSpacing: number = 60;
  private verticalSpacing: number = 120;
  
  // 交互状态
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private hoveredNodeId: string | null = null;
  
  // 节点位置缓存
  private nodePositions: Map<string, { x: number; y: number; width: number; height: number }> = new Map();
  
  // 颜色配置 - 更鲜明的状态颜色
  private colors = {
    background: '#1a1a2e',
    nodeIdle: '#2d2d44',
    nodeRunning: '#1a5a1a',      // 更亮的绿色
    nodeSuccess: '#1a3a5a',      // 更亮的蓝色
    nodeFailure: '#5a1a1a',      // 更亮的红色
    border: '#4a4a6a',
    borderRunning: '#4CAF50',    // 绿色边框
    borderSuccess: '#2196F3',    // 蓝色边框
    borderFailure: '#f44336',    // 红色边框
    borderHover: '#9a9acc',
    text: '#ffffff',
    textSecondary: '#b0b0c0',
    connection: '#5a5a7a',
    connectionRunning: '#4CAF50',
    title: '#9a9aba',
    icon: '#ffffff',
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
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
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
    this.hoveredNodeId = this.getNodeAtPosition(e.clientX, e.clientY);
  }

  /**
   * 鼠标释放事件
   */
  private onMouseUp(): void {
    this.isDragging = false;
  }

  /**
   * 滚轮事件
   */
  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.scale = Math.max(0.3, Math.min(2.0, this.scale * delta));
  }

  /**
   * 获取指定位置的节点
   */
  private getNodeAtPosition(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    
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
      // 显示空状态
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('未选择单位或单位无AI配置', width / 2, height / 2);
      return;
    }
    
    // 应用变换
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    
    // 计算布局
    this.calculateLayout(root, 0, 0);
    
    // 绘制连接线
    this.drawConnections(root);
    
    // 绘制节点
    this.drawNodes(root);
    
    ctx.restore();
  }

  /**
   * 计算节点布局
   */
  private calculateLayout(node: BTNodeDebugInfo, x: number, y: number): { x: number; y: number; width: number; height: number } {
    if (!node.children || node.children.length === 0) {
      // 叶子节点
      const pos = { x, y, width: this.nodeWidth, height: this.nodeHeight };
      this.nodePositions.set(node.id, pos);
      return pos;
    }
    
    // 计算子节点布局
    let totalWidth = 0;
    const childPositions: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    for (const child of node.children) {
      const childPos = this.calculateLayout(child, x + totalWidth, y + this.verticalSpacing);
      childPositions.push(childPos);
      totalWidth += childPos.width + this.horizontalSpacing;
    }
    totalWidth -= this.horizontalSpacing; // 移除最后一个间距
    
    // 居中父节点
    const parentX = x + (totalWidth - this.nodeWidth) / 2;
    const parentPos = { x: parentX, y, width: this.nodeWidth, height: this.nodeHeight };
    this.nodePositions.set(node.id, parentPos);
    
    // 重新计算子节点位置（居中对齐）
    let currentX = x + (totalWidth - (childPositions.length * (this.nodeWidth + this.horizontalSpacing) - this.horizontalSpacing)) / 2;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const childWidth = childPositions[i]!.width;
      this.calculateLayout(child, currentX, y + this.verticalSpacing);
      currentX += childWidth + this.horizontalSpacing;
    }
    
    return parentPos;
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
      ctx.beginPath();
      ctx.strokeStyle = this.getConnectionColor(node, child);
      ctx.lineWidth = 2;
      
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
   * 获取连接线颜色
   */
  private getConnectionColor(parent: BTNodeDebugInfo, child: BTNodeDebugInfo): string {
    if (parent.status === 'running' && child.status === 'running') {
      return this.colors.connectionRunning;
    }
    return this.colors.connection;
  }

  /**
   * 绘制节点
   */
  private drawNodes(node: BTNodeDebugInfo): void {
    const pos = this.nodePositions.get(node.id);
    if (!pos) return;
    
    const ctx = this.ctx;
    const isHovered = this.hoveredNodeId === node.id;
    
    // 绘制节点背景 - 根据状态设置不同的背景色和边框色
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
    this.drawRoundedRect(pos.x, pos.y, pos.width, pos.height, 10);
    ctx.fill();
    ctx.stroke();
    
    // 运行状态添加发光效果
    if (node.status === 'running') {
      ctx.save();
      ctx.shadowColor = '#4CAF50';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      this.drawRoundedRect(pos.x + 2, pos.y + 2, pos.width - 4, pos.height - 4, 8);
      ctx.stroke();
      ctx.restore();
    }
    
    // 绘制节点类型图标 - 增大尺寸
    this.drawNodeIcon(node, pos.x + 12, pos.y + 15, 28, 28);
    
    // 绘制节点名称 - 增大字号
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(this.truncateText(node.name, 14), pos.x + 48, pos.y + 32);
    
    // 绘制节点类型 - 增大字号
    ctx.fillStyle = this.colors.textSecondary;
    ctx.font = '11px Arial';
    ctx.fillText(node.type, pos.x + 48, pos.y + 52);
    
    // 绘制状态指示器 - 增大尺寸
    this.drawStatusIndicator(node.status, pos.x + pos.width - 20, pos.y + 20);
    
    // 如果有执行时间，显示它
    if (node.executionTime !== undefined) {
      ctx.fillStyle = this.colors.textSecondary;
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${node.executionTime.toFixed(1)}ms`, pos.x + pos.width - 25, pos.y + pos.height - 10);
    }
    
    // 递归绘制子节点
    if (node.children) {
      for (const child of node.children) {
        this.drawNodes(child);
      }
    }
  }

  /**
   * 获取节点颜色 - 更鲜明的颜色
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
        ctx.font = `bold ${size * 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', centerX, centerY);
        break;
        
      case 'check':
        // 条件节点：菱形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size);
        ctx.lineTo(centerX - size, centerY);
        ctx.closePath();
        ctx.stroke();
        break;
        
      case 'action':
        // 动作节点：圆形
        ctx.beginPath();
        ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case 'decorator':
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
    const radius = 6;
    
    let color: string;
    switch (status) {
      case 'running':
        color = '#4CAF50';
        break;
      case 'success':
        color = '#2196F3';
        break;
      case 'failure':
        color = '#f44336';
        break;
      default:
        color = '#757575';
        break;
    }
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 如果是运行状态，添加动画效果
    if (status === 'running') {
      ctx.strokeStyle = '#66BB6A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
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
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // 计算缩放比例，留出边距
    const padding = 50;
    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    this.scale = Math.min(scaleX, scaleY, 1.5);
    
    // 居中内容
    this.offsetX = (canvasWidth - contentWidth * this.scale) / 2 - minX * this.scale;
    this.offsetY = (canvasHeight - contentHeight * this.scale) / 2 - minY * this.scale;
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
    this.hoveredNodeId = null;
  }
}
