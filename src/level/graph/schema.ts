import { z } from 'zod';

const idRegex = /^[a-z][a-z0-9_]*$/;
const idSchema = z.string().regex(idRegex);
const nonNegInt = z.number().int().nonnegative();
const posInt = z.number().int().positive();
const nonNegNumber = z.number().nonnegative();

const roleSchema = z.enum(['spawn', 'waypoint', 'branch', 'portal', 'crystal_anchor']);

export const pathNodeSchema = z
  .object({
    id: idSchema,
    row: nonNegInt,
    col: nonNegInt,
    role: roleSchema,
    spawnId: idSchema.optional(),
    teleportTo: idSchema.optional(),
  })
  .strict()
  .superRefine((n, ctx) => {
    if (n.role === 'spawn') {
      if (!n.spawnId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spawnId'], message: 'spawn 节点必填 spawnId' });
      }
      if (n.teleportTo !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['teleportTo'], message: 'spawn 节点不应携带 teleportTo' });
      }
    } else if (n.role === 'portal') {
      if (!n.teleportTo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['teleportTo'], message: 'portal 节点必填 teleportTo' });
      } else if (n.teleportTo === n.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['teleportTo'], message: 'portal 节点不可传送到自身' });
      }
      if (n.spawnId !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spawnId'], message: 'portal 节点不应携带 spawnId' });
      }
    } else {
      if (n.spawnId !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spawnId'], message: `${n.role} 节点不应携带 spawnId` });
      }
      if (n.teleportTo !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['teleportTo'], message: `${n.role} 节点不应携带 teleportTo` });
      }
    }
  });

export const pathEdgeSchema = z
  .object({
    from: idSchema,
    to: idSchema,
    weight: nonNegInt.optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.from === e.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: '自环不允许' });
    }
  });

export const pathGraphSchema = z
  .object({
    nodes: z.array(pathNodeSchema),
    edges: z.array(pathEdgeSchema),
  })
  .strict()
  .superRefine((g, ctx) => {
    const ids = new Set<string>();
    for (const [i, n] of g.nodes.entries()) {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes', i, 'id'], message: `节点 id 重复: ${n.id}` });
      }
      ids.add(n.id);
    }
    for (const [i, e] of g.edges.entries()) {
      if (!ids.has(e.from)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', i, 'from'], message: `边 from=${e.from} 引用不存在的节点` });
      }
      if (!ids.has(e.to)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', i, 'to'], message: `边 to=${e.to} 引用不存在的节点` });
      }
    }
    for (const [i, n] of g.nodes.entries()) {
      if (n.role === 'portal' && n.teleportTo && !ids.has(n.teleportTo)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', i, 'teleportTo'],
          message: `portal teleportTo=${n.teleportTo} 引用不存在的节点`,
        });
      }
    }
  });

export const spawnPointSchema = z
  .object({
    id: idSchema,
    row: nonNegInt,
    col: nonNegInt,
    name: z.string().optional(),
  })
  .strict();

export const waveEnemyGroupSchema = z
  .object({
    enemyType: z.string().min(1),
    count: posInt,
    spawnInterval: nonNegNumber,
    spawnId: idSchema.optional(),
  })
  .strict();

const waveSchema = z
  .object({
    waveNumber: posInt,
    spawnDelay: nonNegNumber,
    enemies: z.array(waveEnemyGroupSchema).min(1),
  })
  .passthrough();

export const graphConfigSchema = z
  .object({
    spawns: z.array(spawnPointSchema).min(1),
    pathGraph: pathGraphSchema,
    waves: z.array(waveSchema),
  })
  .passthrough()
  .superRefine((cfg, ctx) => {
    const spawnIds = new Set(cfg.spawns.map((s) => s.id));
    if (!cfg.pathGraph.nodes.some((n) => n.role === 'crystal_anchor')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pathGraph', 'nodes'], message: '缺少 crystal_anchor 节点' });
    }
    for (const [i, n] of cfg.pathGraph.nodes.entries()) {
      if (n.role === 'spawn' && n.spawnId && !spawnIds.has(n.spawnId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pathGraph', 'nodes', i, 'spawnId'],
          message: `spawn 节点 ${n.id} 的 spawnId=${n.spawnId} 不存在于 spawns[]`,
        });
      }
    }
    for (const [wi, wave] of cfg.waves.entries()) {
      for (const [gi, g] of wave.enemies.entries()) {
        if (g.spawnId && !spawnIds.has(g.spawnId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['waves', wi, 'enemies', gi, 'spawnId'],
            message: `波 ${wave.waveNumber} 编组 ${gi + 1} 引用了不存在的生成口 ${g.spawnId}`,
          });
        }
      }
    }
  });

export type PathNodeInput = z.input<typeof pathNodeSchema>;
export type PathEdgeInput = z.input<typeof pathEdgeSchema>;
export type PathGraphInput = z.input<typeof pathGraphSchema>;
export type GraphConfigInput = z.input<typeof graphConfigSchema>;
