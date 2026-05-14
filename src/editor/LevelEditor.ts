import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import { migrateEnemyPathToGraph } from '../level/graph/migration.js';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type EditorStatus = 'idle' | 'loading' | 'saving' | 'error';

function findMapObject(root: Record<string, unknown>): Record<string, unknown> | null {
  if (root.map && typeof root.map === 'object' && !Array.isArray(root.map)) {
    return root.map as Record<string, unknown>;
  }
  for (const v of Object.values(root)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = (v as Record<string, unknown>).map;
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
      }
    }
  }
  return null;
}

function findEnemyPath(root: Record<string, unknown>): unknown {
  const map = findMapObject(root);
  if (!map) return null;
  return map.enemyPath;
}

function hasPathGraph(root: Record<string, unknown>): boolean {
  const map = findMapObject(root);
  if (!map) return false;
  return map.pathGraph !== undefined && map.pathGraph !== null;
}

function rewriteMapInPlace(
  root: Record<string, unknown>,
  mutator: (m: Record<string, unknown>) => void,
): Record<string, unknown> | null {
  const map = findMapObject(root);
  if (!map) return null;
  mutator(map);
  return map;
}

export interface LevelListEntry {
  id: string;
  filename: string;
}

export interface LevelEditorOptions {
  fetch: typeof fetch;
  baseUrl: string;
}

export class LevelEditor extends EventTarget {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private _status: EditorStatus = 'idle';
  private _list: LevelListEntry[] = [];
  private _currentId: string | null = null;
  private _currentContent: string | null = null;
  private _currentMtime: number | null = null;
  private _loadedContentSnapshot: string | null = null;
  private _lastError: string | null = null;

  constructor(options: LevelEditorOptions) {
    super();
    this.fetchImpl = options.fetch;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  get status(): EditorStatus { return this._status; }
  get list(): readonly LevelListEntry[] { return this._list; }
  get currentId(): string | null { return this._currentId; }
  get currentContent(): string | null { return this._currentContent; }
  get currentMtime(): number | null { return this._currentMtime; }
  get lastError(): string | null { return this._lastError; }
  get isDirty(): boolean {
    return this._currentContent !== null && this._currentContent !== this._loadedContentSnapshot;
  }

  private setStatus(next: EditorStatus): void {
    if (this._status === next) return;
    this._status = next;
    if (next !== 'error') this._lastError = null;
    this.dispatchEvent(new Event('change'));
  }

  private failWith(error: string): void {
    this._lastError = error;
    this._status = 'error';
    this.dispatchEvent(new Event('change'));
  }

  private emitChange(): void {
    this.dispatchEvent(new Event('change'));
  }

  setCurrentContent(content: string): void {
    if (this._currentContent === content) return;
    this._currentContent = content;
    this.emitChange();
  }

  async refreshList(): Promise<Result<readonly LevelListEntry[]>> {
    this.setStatus('loading');
    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/levels`);
      if (!resp.ok) {
        const err = await this.readError(resp);
        this.failWith(err);
        return { ok: false, error: err };
      }
      const payload = (await resp.json()) as { levels?: LevelListEntry[] };
      this._list = Array.isArray(payload.levels) ? payload.levels : [];
      this.setStatus('idle');
      return { ok: true, value: this._list };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch_failed';
      this.failWith(msg);
      return { ok: false, error: msg };
    }
  }

  async loadLevel(id: string): Promise<Result<{ id: string; content: string; mtime: number }>> {
    this.setStatus('loading');
    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/levels/${encodeURIComponent(id)}`);
      if (!resp.ok) {
        const err = await this.readError(resp);
        this.failWith(err);
        return { ok: false, error: err };
      }
      const payload = (await resp.json()) as { id: string; content: string; mtime: number };
      this._currentId = payload.id;
      this._currentContent = payload.content;
      this._currentMtime = payload.mtime;
      this._loadedContentSnapshot = payload.content;
      this.setStatus('idle');
      this.emitChange();
      return { ok: true, value: payload };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch_failed';
      this.failWith(msg);
      return { ok: false, error: msg };
    }
  }

  async saveCurrent(): Promise<Result<{ id: string; mtime: number }>> {
    if (this._currentId === null || this._currentContent === null) {
      return { ok: false, error: 'no_current' };
    }
    this.setStatus('saving');
    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/levels/${encodeURIComponent(this._currentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this._currentContent }),
      });
      if (!resp.ok) {
        const err = await this.readError(resp);
        this.failWith(err);
        return { ok: false, error: err };
      }
      const payload = (await resp.json()) as { id: string; mtime: number };
      this._currentMtime = payload.mtime;
      this._loadedContentSnapshot = this._currentContent;
      this.setStatus('idle');
      this.emitChange();
      return { ok: true, value: payload };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch_failed';
      this.failWith(msg);
      return { ok: false, error: msg };
    }
  }

  async duplicate(sourceId: string, targetId: string): Promise<Result<{ id: string; mtime: number }>> {
    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/levels/${encodeURIComponent(sourceId)}/dup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      if (!resp.ok) {
        const err = await this.readError(resp);
        this.failWith(err);
        return { ok: false, error: err };
      }
      const payload = (await resp.json()) as { id: string; mtime: number };
      return { ok: true, value: payload };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch_failed';
      this.failWith(msg);
      return { ok: false, error: msg };
    }
  }

  async delete(id: string): Promise<Result<{ id: string }>> {
    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/levels/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const err = await this.readError(resp);
        this.failWith(err);
        return { ok: false, error: err };
      }
      const payload = (await resp.json()) as { id: string };
      if (this._currentId === id) {
        this._currentId = null;
        this._currentContent = null;
        this._currentMtime = null;
        this._loadedContentSnapshot = null;
        this.emitChange();
      }
      return { ok: true, value: payload };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch_failed';
      this.failWith(msg);
      return { ok: false, error: msg };
    }
  }

  canMigrate(): boolean {
    if (this._currentContent === null) return false;
    const parsed = this.tryParseYaml(this._currentContent);
    if (!parsed) return false;
    const enemyPath = findEnemyPath(parsed);
    if (!Array.isArray(enemyPath) || enemyPath.length < 2) return false;
    return !hasPathGraph(parsed);
  }

  migrateCurrent(): Result<{ id: string | null }> {
    if (this._currentContent === null) {
      return { ok: false, error: 'no_current' };
    }
    const parsed = this.tryParseYaml(this._currentContent);
    if (!parsed) {
      return { ok: false, error: 'invalid_yaml' };
    }
    if (hasPathGraph(parsed)) {
      return { ok: false, error: 'already_migrated' };
    }
    const enemyPath = findEnemyPath(parsed);
    if (!Array.isArray(enemyPath) || enemyPath.length < 2) {
      return { ok: false, error: 'no_enemy_path' };
    }

    try {
      const result = migrateEnemyPathToGraph({ enemyPath });
      const next = rewriteMapInPlace(parsed, (mapObj) => {
        delete mapObj.enemyPath;
        mapObj.spawns = result.spawns;
        mapObj.pathGraph = result.pathGraph;
      });
      if (!next) return { ok: false, error: 'no_map_object' };

      this._currentContent = yamlDump(parsed, { lineWidth: 120, noRefs: true });
      this.emitChange();
      return { ok: true, value: { id: this._currentId } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'migrate_failed';
      return { ok: false, error: msg };
    }
  }

  private tryParseYaml(text: string): Record<string, unknown> | null {
    try {
      const v = yamlLoad(text);
      if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
      return v as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async readError(resp: Response): Promise<string> {
    try {
      const payload = (await resp.json()) as { error?: string };
      return payload.error ?? `http_${resp.status}`;
    } catch {
      return `http_${resp.status}`;
    }
  }
}
