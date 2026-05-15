import {
  addEntity as bitecsAddEntity,
  createWorld,
  removeEntity as bitecsRemoveEntity,
  type IWorld,
} from 'bitecs';

export interface WorldTime {
  dt: number;
  elapsed: number;
}

export interface TowerWorld extends IWorld {
  readonly time: WorldTime;
  addEntity(): number;
  destroyEntity(eid: number): void;
  isDestroyed(eid: number): boolean;
  flushDeferred(): number;
}

export function createTowerWorld(): TowerWorld {
  const base = createWorld() as IWorld;
  const time: WorldTime = { dt: 0, elapsed: 0 };
  const alive = new Set<number>();
  const destroyed = new Set<number>();

  return Object.assign(base, {
    time,
    addEntity(): number {
      const eid = bitecsAddEntity(base);
      alive.add(eid);
      return eid;
    },
    destroyEntity(eid: number): void {
      if (!alive.has(eid)) return;
      destroyed.add(eid);
    },
    isDestroyed(eid: number): boolean {
      return destroyed.has(eid);
    },
    flushDeferred(): number {
      let count = 0;
      for (const eid of destroyed) {
        bitecsRemoveEntity(base, eid);
        alive.delete(eid);
        count += 1;
      }
      destroyed.clear();
      return count;
    },
  });
}
