// ============================================================
// Tower Defender — bitecs Type Augmentation
//
// bitecs 0.4.0 的 main 导出不包含 legacy API（defineComponent,
// Types, defineQuery, IWorld）。此文件为它们提供类型声明。
// ============================================================

declare module 'bitecs' {
  // --- World types ---
  export interface IWorld { [key: string]: unknown; }
  export type World = IWorld;

  // --- Factory ---
  export function createWorld(): IWorld;

  // --- Entity management ---
  export function addEntity(world: IWorld): number;
  export function removeEntity(world: IWorld, eid: number): void;

  // --- Component management ---
  // NOTE: bitecs signature is (world, component, eid)
  export function addComponent(world: IWorld, component: object, eid: number): void;
  export function removeComponent(world: IWorld, component: object, eid: number): void;
  export function hasComponent(world: IWorld, component: object, eid: number): boolean;

  // --- Legacy types ---
  export const Types: {
    f32: number; ui8: number; ui16: number; ui32: number;
    i8: number; i16: number; i32: number; eid: number;
  };

  export function defineComponent<T extends Record<string, number>>(
    schema: T,
  ): {
    [K in keyof T]: T[K] extends typeof Types.f32 ? Float32Array
      : T[K] extends typeof Types.ui8 | typeof Types.i8 ? Uint8Array
      : T[K] extends typeof Types.ui16 | typeof Types.i16 ? Uint16Array
      : T[K] extends typeof Types.ui32 | typeof Types.i32 ? Uint32Array
      : T[K] extends typeof Types.eid ? Uint32Array
      : Array<number>;
  } & { _size: Uint32Array };

  export function defineQuery(components: object[]): (world: IWorld) => number[];
}
