import { describe, expect, it } from 'vitest';
import type { OsmWay } from '../../routing/graph';
import { isRoutableWay, pickRoutingTags } from '../../routing/osmData';
import {
  decodeWay,
  encodeWay,
  TILE_FORMAT,
  tileKeyAt,
  tileKeysForBBox,
  type TileManifest,
} from '../../routing/tiles';
import { NotCoveredError, TileSource, type TileStorage } from '../roadTiles';

const way = (id: number, lat: number, lon: number): OsmWay => ({
  id,
  nodes: [id * 10, id * 10 + 1, id * 10 + 2],
  geometry: [
    { lat, lon },
    { lat: lat + 0.0012345, lon: lon - 0.0009876 },
    { lat: lat + 0.002, lon: lon + 0.001 },
  ],
  tags: { highway: 'residential', name: 'Herzl' },
});

describe('tile format', () => {
  it('round-trips ways to 1e-6 degree precision', () => {
    const w = way(7, 32.0753123, 34.7748456);
    const back = decodeWay(encodeWay(w));
    expect(back.id).toBe(7);
    expect(back.nodes).toEqual(w.nodes);
    expect(back.tags).toEqual(w.tags);
    back.geometry.forEach((g, i) => {
      expect(g!.lat).toBeCloseTo(w.geometry[i]!.lat, 6);
      expect(g!.lon).toBeCloseTo(w.geometry[i]!.lon, 6);
    });
  });

  it('lists every tile a box touches, including negative coordinates', () => {
    expect(tileKeyAt(32.07, 34.77, 0.05)).toBe('695_641');
    expect(tileKeysForBBox({ south: 32.04, north: 32.06, west: 34.74, east: 34.76 }, 0.05)).toEqual([
      '694_640',
      '695_640',
      '694_641',
      '695_641',
    ]);
    expect(tileKeyAt(-0.01, -0.01)).toBe('-1_-1');
  });

  it('stores real ids only for junctions, keeping closed loops connected', () => {
    const loop: OsmWay = {
      id: 5,
      nodes: [100, 101, 102, 100],
      geometry: [
        { lat: 32, lon: 34 },
        { lat: 32.001, lon: 34 },
        { lat: 32.001, lon: 34.001 },
        { lat: 32, lon: 34 },
      ],
      tags: { highway: 'residential', junction: 'roundabout' },
    };
    const uses = new Map([[100, 2], [101, 1], [102, 2]]);
    const encoded = encodeWay(loop, (id) => (uses.get(id) ?? 0) >= 2);
    const back = decodeWay(encoded);
    expect(back.nodes[0]).toBe(100);
    expect(back.nodes[3]).toBe(100);
    expect(back.nodes[2]).toBe(102);
    // The interior node gets a generated id that cannot clash with real (positive) OSM ids.
    expect(back.nodes[1]).toBeLessThan(0);
    expect(new Set(back.nodes).size).toBe(3);
  });

  it('keeps only routable ways and the tags the rules read', () => {
    expect(isRoutableWay({ highway: 'residential' })).toBe(true);
    expect(isRoutableWay({ highway: 'motorway' })).toBe(false);
    expect(isRoutableWay({ highway: 'service', service: 'parking_aisle' })).toBe(false);
    expect(isRoutableWay({ highway: 'pedestrian', area: 'yes' })).toBe(false);
    expect(pickRoutingTags({ highway: 'primary', maxspeed: '70', surface: 'asphalt', 'name:he': 'הרצל' })).toEqual({
      highway: 'primary',
      maxspeed: '70',
      'name:he': 'הרצל',
    });
  });
});

/** In-memory server and storage for exercising TileSource. */
function setup(manifest: Partial<TileManifest> = {}) {
  const m: TileManifest = {
    format: TILE_FORMAT,
    version: '1-2026-10-01T00:00:00Z',
    dataTimestamp: '2026-10-01T00:00:00Z',
    tileDeg: 0.05,
    bounds: { south: 29, north: 34, west: 34, east: 36 },
    // Way 1 sits in tile 695_641 and is also stored in its neighbour, as the pipeline does for edge-crossing ways.
    tiles: ['695_641', '696_641'],
    attribution: '© OpenStreetMap contributors',
    ...manifest,
  };
  const server: Record<string, string> = {
    'https://tiles.test/manifest.json': JSON.stringify(m),
    'https://tiles.test/tiles/695_641.json': JSON.stringify({
      format: TILE_FORMAT,
      ways: [encodeWay(way(1, 32.07, 34.77)), encodeWay(way(2, 32.08, 34.78))],
    }),
    'https://tiles.test/tiles/696_641.json': JSON.stringify({
      format: TILE_FORMAT,
      ways: [encodeWay(way(1, 32.07, 34.77)), encodeWay(way(3, 32.07, 34.81))],
    }),
  };
  const requests: string[] = [];
  let online = true;
  const fetchText = async (url: string) => {
    requests.push(url);
    if (!online || !(url in server)) throw new Error(`offline or 404: ${url}`);
    return server[url];
  };
  const files = new Map<string, string>();
  const pruned: string[] = [];
  const storage: TileStorage = {
    read: async (p) => files.get(p) ?? null,
    write: (p, t) => void files.set(p, t),
    prune: (v) => void pruned.push(v),
  };
  let time = 0;
  const source = new TileSource('https://tiles.test/', storage, fetchText, () => time);
  return {
    source,
    server,
    requests,
    files,
    pruned,
    goOffline: () => (online = false),
    advance: (ms: number) => (time += ms),
    storage,
    fetchText,
  };
}

const twoTiles = { south: 32.06, north: 32.09, west: 34.76, east: 34.82 };

describe('TileSource', () => {
  it('downloads the covering tiles and drops duplicate ways', async () => {
    const t = setup();
    const ways = await t.source.fetchWays(twoTiles);
    expect(ways.map((w) => w.id).sort()).toEqual([1, 2, 3]);
    expect(t.requests).toEqual([
      'https://tiles.test/manifest.json',
      'https://tiles.test/tiles/695_641.json',
      'https://tiles.test/tiles/696_641.json',
    ]);
  });

  it('shares one download per file between concurrent requests', async () => {
    const t = setup();
    await Promise.all([t.source.fetchWays(twoTiles), t.source.fetchWays(twoTiles)]);
    expect(t.requests).toEqual([
      'https://tiles.test/manifest.json',
      'https://tiles.test/tiles/695_641.json',
      'https://tiles.test/tiles/696_641.json',
    ]);
  });

  it('lets an aborted request go without failing another one sharing its tiles', async () => {
    const t = setup();
    const controller = new AbortController();
    const first = t.source.fetchWays(twoTiles, controller.signal);
    const second = t.source.fetchWays(twoTiles);
    controller.abort();
    await expect(first).rejects.toThrow();
    expect((await second).map((w) => w.id).sort()).toEqual([1, 2, 3]);
  });

  it('skips tiles the manifest says are empty', async () => {
    const t = setup();
    await t.source.fetchWays({ south: 32.06, north: 32.11, west: 34.76, east: 34.79 });
    expect(t.requests.filter((r) => r.includes('/tiles/'))).toEqual(['https://tiles.test/tiles/695_641.json']);
  });

  it('refuses areas outside the published region', async () => {
    const t = setup();
    await expect(t.source.fetchWays({ south: 40, north: 40.1, west: 30, east: 30.1 })).rejects.toBeInstanceOf(
      NotCoveredError,
    );
  });

  it('works offline from stored tiles in a fresh app session', async () => {
    const first = setup();
    await first.source.fetchWays(twoTiles);
    first.goOffline();

    const second = new TileSource('https://tiles.test', first.storage, first.fetchText, () => 0);
    const ways = await second.fetchWays(twoTiles);
    expect(ways).toHaveLength(3);
  });

  it('re-checks the manifest after a while and prunes old data when the version changes', async () => {
    const t = setup();
    await t.source.fetchWays(twoTiles);
    expect(t.pruned).toEqual(['1-2026-10-01T00:00:00Z']);

    t.advance(60 * 1000);
    await t.source.fetchWays(twoTiles);
    expect(t.requests.filter((r) => r.endsWith('manifest.json'))).toHaveLength(1);

    const next = JSON.parse(t.server['https://tiles.test/manifest.json']) as TileManifest;
    next.version = '1-2026-10-08T00:00:00Z';
    t.server['https://tiles.test/manifest.json'] = JSON.stringify(next);
    t.advance(7 * 60 * 60 * 1000);
    await t.source.fetchWays(twoTiles);
    expect(t.pruned).toEqual(['1-2026-10-01T00:00:00Z', '1-2026-10-08T00:00:00Z']);
    // New version: tiles are fetched again and stored under the new version.
    expect([...t.files.keys()].filter((k) => k.startsWith('1-2026-10-08'))).toHaveLength(2);
  });
});
