export type DebugActionId = 'complete_all_levels' | 'add_gold' | 'view_behavior_tree' | 'open_inspector' | 'open_level_editor';

export interface DebugAction {
  id: DebugActionId;
  label: string;
  icon: string;
  isEnabled: () => boolean;
  disabledHint?: string;
  onClick: () => void;
}

interface RenderedButton {
  action: DebugAction;
  element: HTMLButtonElement;
  hintElement: HTMLElement;
  originalLabel: string;
}

export class DebugPanel {
  private container: HTMLElement;
  private panel: HTMLElement;
  private listContainer: HTMLElement;
  private buttons: RenderedButton[] = [];
  private isExpanded: boolean = false;

  constructor(private actions: DebugAction[]) {
    this.container = document.createElement('div');
    this.container.id = 'debug-panel';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 360px;
      height: 100vh;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      pointer-events: none;
    `;

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

    this.panel.appendChild(this.createTitleBar());

    this.listContainer = document.createElement('div');
    this.listContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    this.panel.appendChild(this.listContainer);

    this.renderActionButtons();

    this.container.appendChild(this.panel);
    this.container.appendChild(this.createExpandButton());

    document.body.appendChild(this.container);
  }

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

    const title = document.createElement('div');
    title.style.cssText = 'color: #e0e0e0; font-size: 14px; font-weight: bold;';
    title.textContent = '调试面板';
    titleBar.appendChild(title);

    const collapseButton = document.createElement('button');
    collapseButton.innerHTML = '✕';
    collapseButton.title = '收起面板 (Esc)';
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

  setActions(actions: DebugAction[]): void {
    this.actions = actions;
    this.renderActionButtons();
  }

  private renderActionButtons(): void {
    this.listContainer.innerHTML = '';
    this.buttons = [];

    for (const action of this.actions) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

      const button = document.createElement('button');
      const label = `${action.icon}  ${action.label}`;
      button.textContent = label;
      button.style.cssText = `
        padding: 12px 14px;
        background: #2a2a3a;
        border: 1px solid #3a3a4a;
        border-radius: 6px;
        color: #e0e0e0;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        transition: background 0.15s ease, opacity 0.15s ease;
      `;
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) button.style.background = '#3a3a4a';
      });
      button.addEventListener('mouseleave', () => {
        if (!button.disabled) button.style.background = '#2a2a3a';
      });
      button.addEventListener('click', () => {
        if (button.disabled) return;
        action.onClick();
      });
      wrapper.appendChild(button);

      const hint = document.createElement('div');
      hint.style.cssText = `
        font-size: 11px;
        color: #ff9800;
        min-height: 14px;
        padding-left: 4px;
        display: none;
      `;
      wrapper.appendChild(hint);

      this.listContainer.appendChild(wrapper);
      this.buttons.push({ action, element: button, hintElement: hint, originalLabel: label });
    }

    this.refresh();
  }

  refresh(): void {
    for (const rb of this.buttons) {
      const enabled = rb.action.isEnabled();
      rb.element.disabled = !enabled;
      rb.element.style.opacity = enabled ? '1' : '0.4';
      rb.element.style.cursor = enabled ? 'pointer' : 'not-allowed';
      if (!enabled && rb.action.disabledHint) {
        rb.element.title = rb.action.disabledHint;
        rb.hintElement.textContent = rb.action.disabledHint;
        rb.hintElement.style.display = 'block';
      } else {
        rb.element.title = '';
        rb.hintElement.textContent = '';
        rb.hintElement.style.display = 'none';
      }
    }
  }

  flashButton(id: DebugActionId, text: string, durationMs: number = 1500): void {
    const rb = this.buttons.find((b) => b.action.id === id);
    if (!rb) return;
    rb.element.textContent = text;
    rb.element.style.background = '#2e7d32';
    setTimeout(() => {
      rb.element.textContent = rb.originalLabel;
      if (!rb.element.disabled) rb.element.style.background = '#2a2a3a';
    }, durationMs);
  }

  private createExpandButton(): HTMLElement {
    const button = document.createElement('button');
    button.id = 'debug-expand-button';
    button.innerHTML = '🔧';
    button.title = '打开调试面板 (`)';
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

  expand(): void {
    this.isExpanded = true;
    this.panel.style.transform = 'translateX(0)';
    const expandButton = document.getElementById('debug-expand-button');
    if (expandButton) expandButton.style.display = 'none';
    this.refresh();
  }

  collapse(): void {
    this.isExpanded = false;
    this.panel.style.transform = 'translateX(100%)';
    const expandButton = document.getElementById('debug-expand-button');
    if (expandButton) expandButton.style.display = 'flex';
  }

  toggle(): void {
    if (this.isExpanded) this.collapse();
    else this.expand();
  }

  getIsExpanded(): boolean {
    return this.isExpanded;
  }

  destroy(): void {
    this.container.remove();
  }
}
