import { System, GamePhase, TowerType, CType, TileType } from '../types/index.js';
import { World } from '../core/World.js';
import { Position, GridOccupant } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Render } from '../components/Render.js';
import { PlayerOwned } from '../components/PlayerOwned.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import type { MapConfig } from '../types/index.js';

export class BuildSystem implements System {
  readonly name = 'BuildSystem';
  readonly requiredComponents = [] as const;

  selectedTowerType: TowerType | null = TowerType.Arrow;

  constructor(
    private world: World,
    private map: MapConfig,
    private getPhase: () => GamePhase,
    private spendGold: (amount: number) => boolean,
  ) {}

  get selectedTower(): TowerType | null {
    return this.selectedTowerType;
  }

  selectTower(type: TowerType): void {
    this.selectedTowerType = type;
  }

  /** Try to build selected tower at canvas pixel coords. Returns true if built. */
  tryBuild(px: number, py: number): boolean {
    const phase = this.getPhase();
    if (phase !== GamePhase.Deployment && phase !== GamePhase.WaveBreak) return false;
    if (!this.selectedTowerType) return false;

    const config = TOWER_CONFIGS[this.selectedTowerType];
    if (!config) return false;

    const ts = this.map.tileSize;
    const col = Math.floor(px / ts);
    const row = Math.floor(py / ts);

    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) return false;

    const tile = this.map.tiles[row]![col]!;
    if (tile !== TileType.Empty) return false;

    const occupants = this.world.query(CType.GridOccupant);
    for (const id of occupants) {
      const grid = this.world.getComponent<GridOccupant>(id, CType.GridOccupant);
      if (grid && grid.gridPos.row === row && grid.gridPos.col === col) return false;
    }

    if (!this.spendGold(config.cost)) return false;

    const x = col * ts + ts / 2;
    const y = row * ts + ts / 2;

    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(x, y));
    this.world.addComponent(id, new GridOccupant(row, col));
    this.world.addComponent(id, new Health(config.hp));
    this.world.addComponent(id, new Attack(config.atk, config.range, config.attackSpeed));
    this.world.addComponent(id, new Tower(config.type));
    this.world.addComponent(id, new Render('diamond', config.color, ts * 0.7, 1, true));
    this.world.addComponent(id, new PlayerOwned());

    return true;
  }

  update(_entities: number[], _dt: number): void {
    // Logic invoked via tryBuild() from input dispatch
  }
}
