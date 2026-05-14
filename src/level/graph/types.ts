export type PathNodeRole = 'spawn' | 'waypoint' | 'branch' | 'portal' | 'crystal_anchor';

export interface PathNode {
  id: string;
  row: number;
  col: number;
  role: PathNodeRole;
  spawnId?: string;
  teleportTo?: string;
}

export interface PathEdge {
  from: string;
  to: string;
  weight?: number;
}

export interface PathGraph {
  nodes: PathNode[];
  edges: PathEdge[];
}

export interface SpawnPoint {
  id: string;
  row: number;
  col: number;
  name?: string;
}

export interface WaveEnemyGroup {
  enemyType: string;
  count: number;
  spawnInterval: number;
  spawnId?: string;
}
