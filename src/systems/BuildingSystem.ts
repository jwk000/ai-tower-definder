import { TowerWorld, type System, entityExists } from '../core/World.js';
import { BuildingTower, defineQuery } from '../core/components.js';
import { warn, debug, getFrame } from '../utils/debugLog.js';

const buildingQuery = defineQuery([BuildingTower]);

export class BuildingSystem implements System {
  readonly name = 'BuildingSystem';

  update(world: TowerWorld, dt: number): void {
    const w = world.world;
    const frame = getFrame();
    const entities = buildingQuery(w);

    for (const eid of entities) {
      if (!entityExists(w, eid)) {
        warn('BuildingSystem', `[F${frame}] eid=${eid} in buildingQuery but entity does not exist — skipping`);
        continue;
      }

      BuildingTower.timer[eid]! -= dt;
      if (BuildingTower.timer[eid]! <= 0) {
        debug('BuildingSystem', `[F${frame}] eid=${eid} build complete → removing BuildingTower`);
        world.removeComponent(eid, BuildingTower);
      }
    }
  }
}
