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
