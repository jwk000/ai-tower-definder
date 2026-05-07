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
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';

export interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'production' | 'trap';
  towerType?: TowerType;
  unitType?: UnitType;
  productionType?: ProductionType;
  trap?: boolean;
}

export class BuildSystem implements System {
  readonly name = 'BuildSystem';
  readonly requiredComponents = [] as const;

  selectedTowerType: TowerType | null = TowerType.Arrow;
  dragState: DragState | null = null;

  constructor(
    private world: World,
    private map: MapConfig,
    private getPhase: () => GamePhase,
    private spendGold: (amount: number) => boolean,
    private spendPopAndGold?: (popCost: number, goldCost: number) => boolean,
  ) {}

  get selectedTower(): TowerType | null {
    return this.selectedTowerType;
  }

  selectTower(type: TowerType): void {
    this.selectedTowerType = type;
  }

  startDrag(entityType: 'tower' | 'unit' | 'production' | 'trap', opts?: {
    towerType?: TowerType;
    unitType?: UnitType;
    productionType?: ProductionType;
  }): void {
    this.dragState = {
      active: true,
      entityType,
      towerType: opts?.towerType,
      unitType: opts?.unitType,
      productionType: opts?.productionType,
      trap: entityType === 'trap',
    };
  }

  cancelDrag(): void {
    this.dragState = null;
  }

  /** Drop at canvas pixel coords. Returns entity ID if placed, false otherwise, null if invalid but no cancel. */
  tryDrop(px: number, py: number): number | false {
    if (!this.dragState) return false;

    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) {
      this.cancelDrag();
      return false;
    }

    const ts = this.map.tileSize;
    const col = Math.floor((px - RenderSystem.sceneOffsetX) / ts);
    const row = Math.floor((py - RenderSystem.sceneOffsetY) / ts);

    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) {
      this.cancelDrag();
      return false;
    }

    const tile = this.map.tiles[row]![col]!;
    if (tile !== TileType.Empty) {
      this.cancelDrag();
      return false;
    }

    if (!isAdjacentToPath(row, col, this.map)) {
      this.cancelDrag();
      return false;
    }

    const occupants = this.world.query(CType.GridOccupant);
    for (const id of occupants) {
      const grid = this.world.getComponent<GridOccupant>(id, CType.GridOccupant);
      if (grid && grid.gridPos.row === row && grid.gridPos.col === col) {
        this.cancelDrag();
        return false;
      }
    }

    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    switch (this.dragState.entityType) {
      case 'tower': return this.placeTower(x, y, row, col);
      case 'unit': return this.placeUnit(x, y, row, col);
      case 'production': return this.placeProduction(x, y, row, col);
      case 'trap': return this.placeTrap(x, y, row, col);
      default: { this.cancelDrag(); return false; }
    }
  }

  /** Try to build selected tower at canvas pixel coords. Returns entity ID if built, false otherwise. */
  tryBuild(px: number, py: number): number | false {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return false;
    if (!this.selectedTowerType) return false;

    const config = TOWER_CONFIGS[this.selectedTowerType];
    if (!config) return false;

    const ts = this.map.tileSize;
    const col = Math.floor((px - RenderSystem.sceneOffsetX) / ts);
    const row = Math.floor((py - RenderSystem.sceneOffsetY) / ts);

    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) return false;

    const tile = this.map.tiles[row]![col]!;
    if (tile !== TileType.Empty) return false;

    if (!isAdjacentToPath(row, col, this.map)) return false;

    const occupants = this.world.query(CType.GridOccupant);
    for (const id of occupants) {
      const grid = this.world.getComponent<GridOccupant>(id, CType.GridOccupant);
      if (grid && grid.gridPos.row === row && grid.gridPos.col === col) return false;
    }

    if (!this.spendGold(config.cost)) return false;

    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    return this.createTowerEntity(x, y, row, col, config.type);
  }

  update(_entities: number[], _dt: number): void {
    // Logic invoked via tryBuild() / tryDrop() from input dispatch
  }

  /** Try to build a trap at canvas pixel coords. Returns entity ID if built, false otherwise. */
  tryBuildTrap(px: number, py: number): number | false {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return false;

    const ts = this.map.tileSize;
    const col = Math.floor((px - RenderSystem.sceneOffsetX) / ts);
    const row = Math.floor((py - RenderSystem.sceneOffsetY) / ts);

    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) return false;

    const tile = this.map.tiles[row]![col]!;
    if (tile !== TileType.Empty) return false;

    if (!isAdjacentToPath(row, col, this.map)) return false;

    const occupants = this.world.query(CType.GridOccupant);
    for (const id of occupants) {
      const grid = this.world.getComponent<GridOccupant>(id, CType.GridOccupant);
      if (grid && grid.gridPos.row === row && grid.gridPos.col === col) return false;
    }

    const TRAP_COST = 40;
    if (!this.spendGold(TRAP_COST)) return false;

    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    return this.createTrapEntity(x, y, row, col);
  }

  /** Try to build production building at canvas pixel coords. Returns entity ID if built, false otherwise. */
  tryBuildProduction(px: number, py: number): number | false {
    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) return false;

    const ts = this.map.tileSize;
    const col = Math.floor((px - RenderSystem.sceneOffsetX) / ts);
    const row = Math.floor((py - RenderSystem.sceneOffsetY) / ts);

    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) return false;

    const tile = this.map.tiles[row]![col]!;
    if (tile !== TileType.Empty) return false;

    if (!isAdjacentToPath(row, col, this.map)) return false;

    const occupants = this.world.query(CType.GridOccupant);
    for (const id of occupants) {
      const grid = this.world.getComponent<GridOccupant>(id, CType.GridOccupant);
      if (grid && grid.gridPos.row === row && grid.gridPos.col === col) return false;
    }

    const pt = this.dragState?.productionType;
    if (!pt) return false;
    const config = PRODUCTION_CONFIGS[pt];
    if (!config) return false;
    if (!this.spendGold(config.cost)) return false;

    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    return this.createProductionEntity(x, y, row, col, config.type);
  }

    const pt = this.dragState?.productionType;
    if (!pt) return false;
    const config = PRODUCTION_CONFIGS[pt];
    if (!config) return false;
    if (!this.spendGold(config.cost)) return false;

    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    return this.createTowerEntity(x, y, row, col, config.type);
  }

  // ---- Placement helpers (used by both tryBuild and tryDrop) ----

  private placeTower(x: number, y: number, row: number, col: number): number | false {
    const tt = this.dragState?.towerType ?? this.selectedTowerType;
    if (!tt) { this.cancelDrag(); return false; }
    const config = TOWER_CONFIGS[tt];
    if (!config) { this.cancelDrag(); return false; }
    if (!this.spendGold(config.cost)) { this.cancelDrag(); return false; }
    const id = this.createTowerEntity(x, y, row, col, tt);
    this.cancelDrag();
    return id;
  }

  private placeTrap(x: number, y: number, row: number, col: number): number | false {
    const TRAP_COST = 40;
    if (!this.spendGold(TRAP_COST)) { this.cancelDrag(); return false; }
    const id = this.createTrapEntity(x, y, row, col);
    this.cancelDrag();
    return id;
  }

  private placeProduction(x: number, y: number, row: number, col: number): number | false {
    const pt = this.dragState?.productionType;
    if (!pt) { this.cancelDrag(); return false; }
    const config = PRODUCTION_CONFIGS[pt];
    if (!config) { this.cancelDrag(); return false; }
    if (!this.spendGold(config.cost)) { this.cancelDrag(); return false; }
    const id = this.createProductionEntity(x, y, row, col, pt);
    this.cancelDrag();
    return id;
  }

  private placeUnit(_x: number, _y: number, _row: number, _col: number): number | false {
    // Unit placement is handled by main.ts spawnUnitAt
    // Here we just cancel drag and return false — main.ts handles via tryDrop callback
    this.cancelDrag();
    return false;
  }

  // ---- Entity creation helpers ----

  private createTowerEntity(x: number, y: number, row: number, col: number, tt: TowerType): number {
    const config = TOWER_CONFIGS[tt]!;
    const id = this.world.createEntity();
    this.world.addComponent(id, new Position(x, y));
    this.world.addComponent(id, new GridOccupant(row, col));
    this.world.addComponent(id, new Health(config.hp));
    this.world.addComponent(id, new Attack(config.atk, config.range, config.attackSpeed));
    this.world.addComponent(id, new Tower(config.type, config.cost));
    const render = new Render('circle', config.color, this.map.tileSize * 0.65);
    render.outline = true;
    render.label = config.name;
    render.labelColor = '#ffffff';
    render.labelSize = 16;
    this.world.addComponent(id, render);
    this.world.addComponent(id, new PlayerOwned());
    return id;
  }

  private createTrapEntity(x: number, y: number, row: number, col: number): number {
    const ts = this.map.tileSize;
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
    return id;
  }

  private createProductionEntity(x: number, y: number, row: number, col: number, pt: ProductionType): number {
    const config = PRODUCTION_CONFIGS[pt]!;
    const ts = this.map.tileSize;
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
    return id;
  }
}

/** Returns true if any of the 8 neighboring tiles of (row, col) is a Path tile. */
export function isAdjacentToPath(row: number, col: number, map: MapConfig): boolean {
  const { rows, cols, tiles } = map;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (tiles[nr]![nc] === TileType.Path) return true;
    }
  }
  return false;
}
