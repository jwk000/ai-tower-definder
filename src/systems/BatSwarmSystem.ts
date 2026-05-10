import { System, CType, UnitCategory, UnitLayer } from '../types/index.js';
import { World } from '../core/World.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Attack } from '../components/Attack.js';
import { Render } from '../components/Render.js';
import { BatSwarmMember } from '../components/BatSwarmMember.js';
import { BatTower } from '../components/BatTower.js';
import { PlayerOwned } from '../components/PlayerOwned.js';
import { UnitTag } from '../components/UnitTag.js';
import type { WeatherSystem } from './WeatherSystem.js';

const BAT_SPEED = 120;
const SEPARATION_RADIUS = 50;
const ALIGNMENT_RADIUS = 100;
const COHESION_RADIUS = 130;
const WANDER_RADIUS = 160;
const MAX_FORCE = 600;
const WANDER_STRENGTH = 200;

let frameCounter = 0;

export class BatSwarmSystem implements System {
  readonly name = 'BatSwarmSystem';
  readonly requiredComponents = [
    CType.BatSwarmMember, CType.Position, CType.Attack, CType.Health, CType.PlayerOwned,
  ] as const;

  constructor(
    private world: World,
    private weatherSystem?: WeatherSystem,
  ) {}

  update(entities: number[], dt: number): void {
    frameCounter++;

    const towers = this.world.query(CType.BatTower, CType.Tower, CType.Position);

    // Process bat towers — handle replenishment and initial spawn
    for (const towerId of towers) {
      const bt = this.world.getComponent<BatTower>(towerId, CType.BatTower);
      if (!bt) continue;

      // Initial spawn: tower has 0 bats, spawn initial batch
      if (bt.batIds.size === 0 && bt.replenishTimer <= 0) {
        for (let i = 0; i < bt.maxBats; i++) {
          this.spawnBat(towerId, bt);
        }
        continue;
      }

      // Clean up dead bat references
      const deadBats: number[] = [];
      for (const batId of bt.batIds) {
        const health = this.world.getComponent<Health>(batId, CType.Health);
        if (!health || !health.alive) {
          deadBats.push(batId);
        }
      }
      for (const batId of deadBats) {
        bt.batIds.delete(batId);
        bt.startReplenish();
      }

      // Tick replenish timer
      if (bt.replenishTimer > 0) {
        bt.replenishTimer -= dt;
        if (bt.replenishTimer <= 0 && bt.batIds.size < bt.maxBats) {
          this.spawnBat(towerId, bt);
        }
      }
    }

    // Process individual bats — movement and attack
    for (const batId of entities) {
      const bat = this.world.getComponent<BatSwarmMember>(batId, CType.BatSwarmMember);
      const pos = this.world.getComponent<Position>(batId, CType.Position);
      const atk = this.world.getComponent<Attack>(batId, CType.Attack);
      const health = this.world.getComponent<Health>(batId, CType.Health);
      if (!bat || !pos || !atk || !health?.alive) continue;

      // Apply boid forces
      this.applyBoidForces(batId, bat, pos, entities, dt);

      // Attack
      atk.tickCooldown(dt);
      if (atk.canAttack && this.canBatAttack()) {
        this.tryAttack(batId, pos, atk);
      }
    }
  }

  private canBatAttack(): boolean {
    if (!this.weatherSystem) return true;
    return this.weatherSystem.canAttackBat();
  }

  private applyBoidForces(
    batId: number,
    bat: BatSwarmMember,
    pos: Position,
    allBats: number[],
    dt: number,
  ): void {
    let sepX = 0, sepY = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohCount = 0;

    for (const otherId of allBats) {
      if (otherId === batId) continue;
      const otherPos = this.world.getComponent<Position>(otherId, CType.Position);
      const otherBat = this.world.getComponent<BatSwarmMember>(otherId, CType.BatSwarmMember);
      if (!otherPos || !otherBat) continue;

      const dx = pos.x - otherPos.x;
      const dy = pos.y - otherPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.01) continue;

      const invDist = 1 / dist;

      if (dist < SEPARATION_RADIUS) {
        sepX += dx * invDist;
        sepY += dy * invDist;
        sepCount++;
      }
      if (dist < ALIGNMENT_RADIUS) {
        aliX += otherBat.vx;
        aliY += otherBat.vy;
        aliCount++;
      }
      if (dist < COHESION_RADIUS) {
        cohX += otherPos.x;
        cohY += otherPos.y;
        cohCount++;
      }
    }

    // Home attraction
    const bt = this.getParentBatTower(bat.homeTowerId);
    let homeX = 0, homeY = 0;
    if (bt) {
      const towerPos = this.world.getComponent<Position>(bat.homeTowerId, CType.Position);
      if (towerPos) {
        homeX = towerPos.x - pos.x;
        homeY = towerPos.y - pos.y;
      }
    }

    // Combine forces
    let fx = 0, fy = 0;
    const sepWeight = 3.0;
    const aliWeight = 1.5;
    const cohWeight = 1.0;
    const homeWeight = 2.0;

    if (sepCount > 0) { fx += (sepX / sepCount) * BAT_SPEED * sepWeight; fy += (sepY / sepCount) * BAT_SPEED * sepWeight; }
    if (aliCount > 0) { fx += (aliX / aliCount) * aliWeight; fy += (aliY / aliCount) * aliWeight; }
    if (cohCount > 0) {
      cohX = cohX / cohCount - pos.x;
      cohY = cohY / cohCount - pos.y;
      const cohLen = Math.sqrt(cohX * cohX + cohY * cohY);
      if (cohLen > 0.01) { fx += (cohX / cohLen) * BAT_SPEED * cohWeight; fy += (cohY / cohLen) * BAT_SPEED * cohWeight; }
    }

    // Home attraction
    const homeLen = Math.sqrt(homeX * homeX + homeY * homeY);
    if (homeLen > 0.01) {
      const pull = homeLen > WANDER_RADIUS ? homeWeight * 2 : homeWeight;
      fx += (homeX / homeLen) * BAT_SPEED * pull;
      fy += (homeY / homeLen) * BAT_SPEED * pull;
    }

    // Wander
    const wanderAngle = (batId * 7.1317 + frameCounter * 0.03) % (Math.PI * 2);
    fx += Math.cos(wanderAngle) * WANDER_STRENGTH;
    fy += Math.sin(wanderAngle * 1.3 + 1.7) * WANDER_STRENGTH;

    // Limit force
    const fLen = Math.sqrt(fx * fx + fy * fy);
    if (fLen > MAX_FORCE) {
      fx = (fx / fLen) * MAX_FORCE;
      fy = (fy / fLen) * MAX_FORCE;
    }

    // Apply to velocity
    const speed = bt?.batSpeed ?? BAT_SPEED;
    bat.vx += fx * dt;
    bat.vy += fy * dt;

    // Limit speed
    const vLen = Math.sqrt(bat.vx * bat.vx + bat.vy * bat.vy);
    if (vLen > speed) {
      bat.vx = (bat.vx / vLen) * speed;
      bat.vy = (bat.vy / vLen) * speed;
    }

    pos.x += bat.vx * dt;
    pos.y += bat.vy * dt;

    // Clamp to home area
    this.clampToHome(pos, bat.homeTowerId);
  }

  private clampToHome(pos: Position, towerId: number): void {
    const towerPos = this.world.getComponent<Position>(towerId, CType.Position);
    if (!towerPos) return;
    const dx = pos.x - towerPos.x;
    const dy = pos.y - towerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > WANDER_RADIUS + 40) {
      pos.x = towerPos.x + (dx / dist) * (WANDER_RADIUS + 40);
      pos.y = towerPos.y + (dy / dist) * (WANDER_RADIUS + 40);
    }
  }

  private tryAttack(batId: number, pos: Position, atk: Attack): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
    let nearestId: number | null = null;
    let nearestDist = Infinity;

    for (const enemyId of enemies) {
      const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
      const eHealth = this.world.getComponent<Health>(enemyId, CType.Health);
      if (!ePos || !eHealth?.alive) continue;
      const dx = ePos.x - pos.x;
      const dy = ePos.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= atk.range && dist < nearestDist) {
        nearestDist = dist;
        nearestId = enemyId;
      }
    }

    if (nearestId !== null) {
      atk.resetCooldown();
      const eHealth = this.world.getComponent<Health>(nearestId, CType.Health);
      if (eHealth && this.world.isAlive(nearestId)) {
        eHealth.takeDamage(atk.atk);
      }
      const eRender = this.world.getComponent<Render>(nearestId, CType.Render);
      if (eRender) eRender.hitFlashTimer = 0.12;
    }
  }

  private getParentBatTower(towerId: number): BatTower | null {
    return this.world.getComponent<BatTower>(towerId, CType.BatTower) ?? null;
  }

  spawnBat(towerId: number, bt: BatTower): number {
    const towerPos = this.world.getComponent<Position>(towerId, CType.Position);
    if (!towerPos) return -1;

    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 80;
    const x = towerPos.x + Math.cos(angle) * dist;
    const y = towerPos.y + Math.sin(angle) * dist;

    const batId = this.world.createEntity();
    this.world.addComponent(batId, new Position(x, y));
    this.world.addComponent(batId, new Health(bt.batHp));
    this.world.addComponent(batId, new Attack(bt.batDamage, bt.batAttackRange, bt.batAttackSpeed));
    this.world.addComponent(batId, new BatSwarmMember(towerId));

    const render = new Render('circle', '#2d2d2d', bt.batSize);
    render.alpha = 0.9;
    this.world.addComponent(batId, render);

    this.world.addComponent(batId, new PlayerOwned());

    this.world.addComponent(batId, new UnitTag(
      'bat_swarm',
      UnitCategory.Soldier,
      1,
      1,
      UnitLayer.LowAir,
    ));

    bt.batIds.add(batId);
    return batId;
  }

  onBatDied(batId: number): void {
    const bat = this.world.getComponent<BatSwarmMember>(batId, CType.BatSwarmMember);
    if (!bat) return;
    const bt = this.world.getComponent<BatTower>(bat.homeTowerId, CType.BatTower);
    if (bt) {
      bt.batIds.delete(batId);
      bt.startReplenish();
    }
  }

  upgradeBatTowerStats(towerId: number, towerLevel: number): void {
    const bt = this.world.getComponent<BatTower>(towerId, CType.BatTower);
    if (!bt) return;

    const baseBats = 4;
    let extraBats = 0;
    if (towerLevel >= 2) extraBats++;
    if (towerLevel >= 4) extraBats++;
    bt.maxBats = baseBats + extraBats;

    const levelBonus = (towerLevel - 1) * 0.15;
    bt.batDamage = Math.floor(10 * (1 + levelBonus));

    bt.batHp = 30 + (towerLevel - 1) * 10;

    for (const batId of bt.batIds) {
      const atk = this.world.getComponent<Attack>(batId, CType.Attack);
      const health = this.world.getComponent<Health>(batId, CType.Health);
      if (atk) atk.atk = bt.batDamage;
      if (health) {
        const ratio = health.ratio;
        health.max = bt.batHp;
        health.current = Math.ceil(health.max * ratio);
      }
    }
  }
}
