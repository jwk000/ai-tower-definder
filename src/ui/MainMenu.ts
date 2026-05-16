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

  __triggerForTest(action: MainMenuAction): void {
    const resolved = resolveMainMenuClick(this.state, action);
    if (typeof resolved === 'string') {
      this.handler?.(resolved);
    }
  }
}
