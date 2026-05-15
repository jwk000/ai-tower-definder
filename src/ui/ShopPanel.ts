export type ShopItemKind = 'unit-card' | 'sp-exchange';

export interface ShopItem {
  readonly id: string;
  readonly kind: ShopItemKind;
  readonly label: string;
  readonly costGold: number;
  readonly grantsSP?: number;
  readonly grantsCardId?: string;
  readonly stock: number;
}

export interface ShopState {
  readonly gold: number;
  readonly sp: number;
  readonly items: readonly ShopItem[];
}

export type PurchaseResult =
  | { readonly kind: 'success'; readonly newGold: number; readonly newSp: number; readonly grantsCardId?: string; readonly itemId: string }
  | { readonly kind: 'rejected'; readonly reason: 'no-such-item' | 'out-of-stock' | 'insufficient-gold' };

export function attemptPurchase(state: ShopState, itemId: string): PurchaseResult {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { kind: 'rejected', reason: 'no-such-item' };
  if (item.stock <= 0) return { kind: 'rejected', reason: 'out-of-stock' };
  if (state.gold < item.costGold) return { kind: 'rejected', reason: 'insufficient-gold' };
  return {
    kind: 'success',
    newGold: state.gold - item.costGold,
    newSp: state.sp + (item.grantsSP ?? 0),
    grantsCardId: item.grantsCardId,
    itemId,
  };
}

export function applyPurchase(state: ShopState, itemId: string): { state: ShopState; result: PurchaseResult } {
  const result = attemptPurchase(state, itemId);
  if (result.kind !== 'success') return { state, result };
  return {
    state: {
      gold: result.newGold,
      sp: result.newSp,
      items: state.items.map((i) => (i.id === itemId ? { ...i, stock: i.stock - 1 } : i)),
    },
    result,
  };
}
