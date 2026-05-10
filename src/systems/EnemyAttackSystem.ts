import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { Enemy } from '../components/Enemy.js';
import { EnemyAttacker } from '../components/EnemyAttacker.js';
import { Health } from '../components/Health.js';
import { Projectile } from '../components/Projectile.js';
import { Render } from '../components/Render.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';

// 敌人子弹配置
const ENEMY_PROJECTILE_SPEED = 200; // 像素/秒

export class EnemyAttackSystem implements System {
  readonly name = 'EnemyAttackSystem';
  readonly requiredComponents = [CType.EnemyAttacker, CType.Enemy, CType.Position, CType.Movement] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const pos = this.world.getComponent<Position>(id, CType.Position)!;
      const mov = this.world.getComponent<Movement>(id, CType.Movement)!;
      const attacker = this.world.getComponent<EnemyAttacker>(id, CType.EnemyAttacker)!;
      const enemy = this.world.getComponent<Enemy>(id, CType.Enemy)!;

      // 获取敌人配置，判断是否可以攻击建筑
      const config = ENEMY_CONFIGS[enemy.enemyType];
      const canAttackBuildings = config?.canAttackBuildings ?? false;

      if (attacker.cooldown > 0) {
        attacker.cooldown -= dt;
      }

      // Check if current target is still valid
      if (attacker.targetId !== null) {
        const targetHealth = this.world.getComponent<Health>(attacker.targetId, CType.Health);
        const targetPos = this.world.getComponent<Position>(attacker.targetId, CType.Position);

        if (!targetHealth?.alive || !targetPos) {
          attacker.targetId = null;
          enemy.movementPaused = false;
          mov.speed = enemy.originalSpeed;
        } else {
          const dx = targetPos.x - pos.x;
          const dy = targetPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > attacker.attackRange) {
            attacker.targetId = null;
            enemy.movementPaused = false;
            mov.speed = enemy.originalSpeed;
          } else if (attacker.cooldown <= 0) {
            // 远程敌人攻击建筑或蝙蝠时发射子弹
            if (canAttackBuildings && (this.world.hasComponent(attacker.targetId, CType.Tower) || this.world.hasComponent(attacker.targetId, CType.BatSwarmMember))) {
              this.spawnEnemyProjectile(id, pos, attacker.targetId, attacker.attackDamage);
            } else {
              // 近战攻击（对单位）直接造成伤害
              targetHealth.takeDamage(attacker.attackDamage);
            }
            attacker.cooldown = 1 / attacker.attackSpeed;
          }
        }
      }

      // Search for new target
      if (attacker.targetId === null) {
        let closestId: number | null = null;
        let closestDist = Infinity;

        // 远程敌人优先攻击建筑和蝙蝠
        if (canAttackBuildings) {
          const towers = this.world.query(CType.Health, CType.Position, CType.Tower);
          for (const cid of towers) {
            if (cid === id) continue;
            const cpos = this.world.getComponent<Position>(cid, CType.Position);
            const chealth = this.world.getComponent<Health>(cid, CType.Health);
            if (!cpos || !chealth?.alive) continue;

            const dx = cpos.x - pos.x;
            const dy = cpos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= attacker.attackRange && dist < closestDist) {
              closestDist = dist;
              closestId = cid;
            }
          }

          // Also target bats (low-air friendly units)
          const bats = this.world.query(CType.Health, CType.Position, CType.BatSwarmMember);
          for (const cid of bats) {
            if (cid === id) continue;
            const cpos = this.world.getComponent<Position>(cid, CType.Position);
            const chealth = this.world.getComponent<Health>(cid, CType.Health);
            if (!cpos || !chealth?.alive) continue;

            const dx = cpos.x - pos.x;
            const dy = cpos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= attacker.attackRange && dist < closestDist) {
              closestDist = dist;
              closestId = cid;
            }
          }
        }

        // 近战敌人攻击我方移动单位（Unit）
        if (!canAttackBuildings) {
          const units = this.world.query(CType.Health, CType.Position, CType.Unit);
          for (const cid of units) {
            if (cid === id) continue;
            const cpos = this.world.getComponent<Position>(cid, CType.Position);
            const chealth = this.world.getComponent<Health>(cid, CType.Health);
            if (!cpos || !chealth?.alive) continue;

            const dx = cpos.x - pos.x;
            const dy = cpos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= attacker.attackRange && dist < closestDist) {
              closestDist = dist;
              closestId = cid;
            }
          }
        }

        if (closestId !== null) {
          attacker.targetId = closestId;
          enemy.movementPaused = true;
          enemy.originalSpeed = mov.speed;
          mov.speed = 0;

          if (attacker.cooldown <= 0) {
            const targetHealth = this.world.getComponent<Health>(closestId, CType.Health);
            if (targetHealth) {
              // 远程敌人攻击建筑或蝙蝠时发射子弹
              if (canAttackBuildings && (this.world.hasComponent(closestId, CType.Tower) || this.world.hasComponent(closestId, CType.BatSwarmMember))) {
                this.spawnEnemyProjectile(id, pos, closestId, attacker.attackDamage);
              } else {
                // 近战攻击直接造成伤害
                targetHealth.takeDamage(attacker.attackDamage);
              }
              attacker.cooldown = 1 / attacker.attackSpeed;
            }
          }
        }
      }
    }
  }

  private spawnEnemyProjectile(fromId: number, fromPos: Position, targetId: number, damage: number): void {
    const pid = this.world.createEntity();
    this.world.addComponent(pid, new Position(fromPos.x, fromPos.y));

    const proj = new Projectile(targetId, ENEMY_PROJECTILE_SPEED, damage, fromPos.x, fromPos.y);
    proj.sourceTowerId = fromId;
    proj.sourceTowerType = 'enemy'; // 标记为敌人子弹
    this.world.addComponent(pid, proj);

    // 添加渲染组件，使用红色圆形子弹
    const render = new Render('circle', '#ff5252', 10);
    render.targetEntityId = targetId;
    this.world.addComponent(pid, render);
  }
}
