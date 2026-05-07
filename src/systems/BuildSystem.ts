import { System, GamePhase, TowerType, UnitType, ProductionType, CType, TileType } from '../types/index.js';
import { World } from '../core/World.js';
import { Position, GridOccupant } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Render } from '../components/Render.js';
import { PlayerOwned } from '../components/PlayerOwned.js';
import { Production } from '../components/Production.js';
import { Trap } from '../components/Trap.js';
import { TOWER_CONFIGS, PRODUCTION_CONFIGS } from '../data/gameData.js';
import type { MapConfig } from '../types/index.js';

export class BuildSystem implements System {
  readonly name = 'BuildSystem';
  readonly requiredComponents = [] as const;

  selectedTowerType: TowerType | null = TowerType.Arrow;
  placementMode: 'tower' | 'unit' | 'production' | 'trap' | null = null;
  pendingUnitType: UnitType | null = null;
  pendingProductionType: ProductionType | null = null;

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

  /** Try to build selected tower at canvas pixel coords. Returns entity ID if built, false otherwise. */
  tryBuild(px: number, py: number): number | false {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return false;
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

    const render = new Render('circle', config.color, ts * 0.65);
    render.outline = true;
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 16;
    this.world.addComponent(id, render);

    this.world.addComponent(id, new PlayerOwned());

    return id;
  }

  update(_entities: number[], _dt: number): void {
    // Logic invoked via tryBuild() from input dispatch
  }

  /** Try to build a trap at canvas pixel coords. Returns entity ID if built, false otherwise. */
  tryBuildTrap(px: number, py: number): number | false {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return false;

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

    const TRAP_COST = 40;
    if (!this.spendGold(TRAP_COST)) return false;

    const x = col * ts + ts / 2;
    const y = row * ts + ts / 2;

    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(x, y));
    this.world.addComponent(id, new GridOccupant(row, col));
    this.world.addComponent(id, new Trap(30, 2.0, 32));

    const render = new Render('triangle', '#e53935', ts * 0.5);
    render.outline = true;
    render.label = '陷阱';
    render.labelColor = '#ffffff';
    render.labelSize = 14;
    this.world.addComponent(id, render);

    this.world.addComponent(id, new PlayerOwned());

    this.placementMode = null;
    return id;
  }

  /** Try to build production building at canvas pixel coords. Returns entity ID if built, false otherwise. */
  tryBuildProduction(px: number, py: number): number | false {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return false;
    if (!this.pendingProductionType) return false;

    const config = PRODUCTION_CONFIGS[this.pendingProductionType];
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
    this.world.addComponent(id, new Production(config.type, config.resourceType, config.baseRate, config.maxLevel));

    const render = new Render('circle', config.color, ts * 0.6);
    render.outline = true;
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 16;
    this.world.addComponent(id, render);

    this.world.addComponent(id, new PlayerOwned());

    this.placementMode = null;
    this.pendingProductionType = null;
    return id;
  }
}
