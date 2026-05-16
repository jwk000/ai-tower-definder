export type MainMenuAction = 'start-run' | 'continue-run' | 'open-cards' | 'open-settings' | 'quit';

export interface MainMenuState {
  readonly hasSavedRun: boolean;
}

export interface MainMenuButton {
  readonly action: MainMenuAction;
  readonly label: string;
  readonly enabled: boolean;
}

export function buildMainMenu(state: MainMenuState): readonly MainMenuButton[] {
  return [
    { action: 'start-run', label: 'New Run', enabled: true },
    { action: 'continue-run', label: 'Continue', enabled: state.hasSavedRun },
    { action: 'open-cards', label: 'Card Pool', enabled: true },
    { action: 'open-settings', label: 'Settings', enabled: true },
    { action: 'quit', label: 'Quit', enabled: true },
  ];
}

export function resolveMainMenuClick(state: MainMenuState, action: MainMenuAction): MainMenuAction | { readonly kind: 'rejected'; readonly reason: 'disabled' } {
  const button = buildMainMenu(state).find((b) => b.action === action);
  if (!button || !button.enabled) return { kind: 'rejected', reason: 'disabled' };
  return action;
}

export interface MainMenuButtonRect extends MainMenuButton {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MainMenuLayout {
  readonly titleLabel: string;
  readonly titleX: number;
  readonly titleY: number;
  readonly buttons: readonly MainMenuButtonRect[];
}

const MENU_BUTTON_WIDTH = 320;
const MENU_BUTTON_HEIGHT = 56;
const MENU_BUTTON_GAP = 16;
const MENU_TITLE_GAP = 64;

export function layoutMainMenu(state: MainMenuState, viewportWidth: number, viewportHeight: number): MainMenuLayout {
  const buttons = buildMainMenu(state);
  const totalH = buttons.length * MENU_BUTTON_HEIGHT + (buttons.length - 1) * MENU_BUTTON_GAP;
  const startY = (viewportHeight - totalH) / 2;
  const x = (viewportWidth - MENU_BUTTON_WIDTH) / 2;
  return {
    titleLabel: 'AI Tower Defender',
    titleX: viewportWidth / 2,
    titleY: startY - MENU_TITLE_GAP,
    buttons: buttons.map((b, i) => ({
      ...b,
      x,
      y: startY + i * (MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP),
      width: MENU_BUTTON_WIDTH,
      height: MENU_BUTTON_HEIGHT,
    })),
  };
}

export function hitTestMainMenu(layout: MainMenuLayout, px: number, py: number): MainMenuAction | null {
  for (const btn of layout.buttons) {
    if (!btn.enabled) continue;
    if (px >= btn.x && px <= btn.x + btn.width && py >= btn.y && py <= btn.y + btn.height) {
      return btn.action;
    }
  }
  return null;
}

export type MainMenuHandler = (action: MainMenuAction) => void;

export class MainMenu {
  private state: MainMenuState;
  private handler: MainMenuHandler | null = null;
  private buttons: readonly MainMenuButton[];

  constructor(initial: MainMenuState = { hasSavedRun: false }) {
    this.state = initial;
    this.buttons = buildMainMenu(initial);
  }

  setHandler(handler: MainMenuHandler): void {
    this.handler = handler;
  }

  refresh(state: MainMenuState): void {
    this.state = state;
    this.buttons = buildMainMenu(state);
  }

  getButtons(): readonly MainMenuButton[] {
    return this.buttons;
  }

  trigger(action: MainMenuAction): void {
    const resolved = resolveMainMenuClick(this.state, action);
    if (typeof resolved === 'string') {
      this.handler?.(resolved);
    }
  }
}
