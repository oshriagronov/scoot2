import type { BBox } from '../routing/geo';
import type { OsmWay } from '../routing/graph';
import {
  decodeWay,
  TILE_FORMAT,
  tileKeysForBBox,
  type TileFile,
  type TileManifest,
} from '../routing/tiles';

/** Where downloaded tiles are kept between app launches. */
export interface TileStorage {
  read(path: string): Promise<string | null>;
  write(path: string, text: string): void;
  /** Removes stored tiles from every data version except `keepVersion`. */
  prune(keepVersion: string): void;
}

/** The requested area is outside the published tiles; use another data source. */
export class NotCoveredError extends Error {}

export type FetchText = (url: string) => Promise<string>;

/** Downloads are shared between route requests, so each has its own time limit. */
const REQUEST_TIMEOUT_MS = 20000;

const defaultFetchText: FetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Tile server returned ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};

/** Re-check the manifest for newer data at most this often. */
const MANIFEST_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Decoded tiles kept in memory (a few routes' worth). */
const MEMORY_TILES = 48;
const PARALLEL_DOWNLOADS = 6;

function contains(outer: BBox, inner: BBox) {
  return (
    inner.south >= outer.south &&
    inner.north <= outer.north &&
    inner.west >= outer.west &&
    inner.east <= outer.east
  );
}

/** File-system safe form of a data version (versions contain ISO timestamps). */
export function versionDir(version: string) {
  return version.replace(/[^A-Za-z0-9-]/g, '_');
}

/**
 * Road data from pre-built static tiles (see pipeline/). Tiles are fetched on
 * demand, stored on the device, and reused offline until the data version changes.
 */
export class TileSource {
  private manifest: TileManifest | null = null;
  private manifestTiles = new Set<string>();
  private manifestCheckedAt = 0;
  private manifestRequest: Promise<TileManifest> | null = null;
  private memory = new Map<string, OsmWay[]>();
  /** Tiles being loaded, so concurrent route requests share one download per tile. */
  private loading = new Map<string, Promise<OsmWay[]>>();

  constructor(
    private baseUrl: string,
    private storage: TileStorage,
    private fetchText: FetchText = defaultFetchText,
    private now: () => number = Date.now,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private setManifest(m: TileManifest) {
    if (this.manifest?.version !== m.version) this.memory.clear();
    this.manifest = m;
    this.manifestTiles = new Set(m.tiles);
  }

  private parseManifest(text: string): TileManifest {
    const m = JSON.parse(text) as TileManifest;
    if (m.format !== TILE_FORMAT) throw new Error(`Unsupported tile format ${m.format}`);
    return m;
  }

  getManifest(signal?: AbortSignal): Promise<TileManifest> {
    if (this.manifest && this.now() - this.manifestCheckedAt < MANIFEST_MAX_AGE_MS) {
      return Promise.resolve(this.manifest);
    }
    // Concurrent route requests share one manifest download, not tied to any one caller's signal.
    this.manifestRequest ??= this.loadManifest().finally(() => {
      this.manifestRequest = null;
    });
    return signal ? untilAborted(this.manifestRequest, signal) : this.manifestRequest;
  }

  private async loadManifest(): Promise<TileManifest> {
    try {
      const text = await this.fetchText(`${this.baseUrl}/manifest.json`);
      const m = this.parseManifest(text);
      this.storage.write('manifest.json', text);
      if (m.version !== this.manifest?.version) this.storage.prune(m.version);
      this.setManifest(m);
      this.manifestCheckedAt = this.now();
      return m;
    } catch (err) {
      // Offline or server trouble: carry on with whatever data we already have.
      if (this.manifest) return this.manifest;
      const stored = await this.storage.read('manifest.json');
      if (!stored) throw err;
      const m = this.parseManifest(stored);
      this.setManifest(m);
      return m;
    }
  }

  async fetchWays(bbox: BBox, signal?: AbortSignal): Promise<OsmWay[]> {
    const m = await this.getManifest(signal);
    if (!contains(m.bounds, bbox)) throw new NotCoveredError('Area is outside the downloaded region');

    const keys = tileKeysForBBox(bbox, m.tileDeg).filter((k) => this.manifestTiles.has(k));
    const tiles: OsmWay[][] = [];
    for (let i = 0; i < keys.length; i += PARALLEL_DOWNLOADS) {
      const batch = keys.slice(i, i + PARALLEL_DOWNLOADS);
      tiles.push(...(await Promise.all(batch.map((k) => this.loadTile(m.version, k, signal)))));
    }

    // Ways crossing tile edges appear in several tiles.
    const seen = new Set<number>();
    const ways: OsmWay[] = [];
    for (const tile of tiles) {
      for (const w of tile) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        ways.push(w);
      }
    }
    return ways;
  }

  private loadTile(version: string, key: string, signal?: AbortSignal): Promise<OsmWay[]> {
    const cached = this.memory.get(key);
    if (cached) {
      // Refresh recency.
      this.memory.delete(key);
      this.memory.set(key, cached);
      return Promise.resolve(cached);
    }
    const id = `${version}/${key}`;
    let load = this.loading.get(id);
    if (!load) {
      // Not tied to one caller's signal: another request may be waiting on the same
      // tile, and a finished download still fills the cache.
      load = this.readOrDownload(version, key).finally(() => this.loading.delete(id));
      this.loading.set(id, load);
    }
    return signal ? untilAborted(load, signal) : load;
  }

  private async readOrDownload(version: string, key: string): Promise<OsmWay[]> {
    const path = `${versionDir(version)}/${key}.json`;
    let text = await this.storage.read(path);
    if (text === null) {
      text = await this.fetchText(`${this.baseUrl}/tiles/${key}.json`);
      this.storage.write(path, text);
    }
    const file = JSON.parse(text) as TileFile;
    const ways = file.ways.map(decodeWay);
    this.memory.set(key, ways);
    if (this.memory.size > MEMORY_TILES) {
      this.memory.delete(this.memory.keys().next().value!);
    }
    return ways;
  }
}

/** Resolves like `promise`, but rejects as soon as `signal` aborts. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('Aborted'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('Aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
