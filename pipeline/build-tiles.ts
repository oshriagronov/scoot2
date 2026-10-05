/**
 * Builds the road-data tiles the app routes on.
 *
 *   npx tsx build-tiles.ts --input israel-and-palestine-latest.osm.pbf --out site
 *
 * Reads an OpenStreetMap .pbf extract twice: first to find which nodes the
 * kept ways use (and which of those are junctions shared by several ways),
 * then to collect those nodes' coordinates and the ways.
 * Writes site/manifest.json and site/tiles/<x>_<y>.json, ready for static hosting.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createOSMStream } from 'osm-pbf-parser-node';
import type { BBox } from '../src/routing/geo';
import { isRoutableWay, pickRoutingTags } from '../src/routing/osmData';
import { mayEverBeRidden } from '../src/routing/rules';
import {
  encodeWay,
  TILE_DEG,
  TILE_FORMAT,
  tileKeysForBBox,
  type EncodedWay,
  type TileFile,
  type TileManifest,
} from '../src/routing/tiles';

interface OsmHeader {
  bbox?: { left: number; right: number; top: number; bottom: number };
  osmosis_replication_timestamp?: number;
}
interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}
interface OsmWayItem {
  type: 'way';
  id: number;
  refs: number[];
  tags?: Record<string, string>;
}
type OsmItem = OsmHeader | OsmNode | OsmWayItem | { type: 'relation' };

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`Missing --${name}. Usage: tsx build-tiles.ts --input <file.osm.pbf> --out <dir>`);
    process.exit(1);
  }
  return v;
}

const input = arg('input');
const outDir = arg('out');
const started = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`);

function read(withTags: boolean) {
  // Only way tags are needed; skipping node and relation tags keeps parsing fast.
  return createOSMStream(input, {
    withTags: { node: false, way: withTags, relation: false },
    withInfo: false,
  }) as AsyncGenerator<OsmItem>;
}

/** Ways the app could route on, or needs to judge sidewalks (all roads). */
const keepWay = (tags: Record<string, string> | undefined) => isRoutableWay(tags) && mayEverBeRidden(tags!);

// Pass 1: how often is each node referenced by kept ways? Twice or more means a junction.
const nodeUses = new Map<number, number>();
let header: OsmHeader | null = null;
for await (const item of read(true)) {
  if (!('type' in item)) {
    header = item;
  } else if (item.type === 'way' && keepWay(item.tags)) {
    for (const ref of item.refs) nodeUses.set(ref, (nodeUses.get(ref) ?? 0) + 1);
  }
}
const isJunction = (id: number) => (nodeUses.get(id) ?? 0) >= 2;
log(`pass 1: ${nodeUses.size.toLocaleString()} nodes referenced by kept ways`);

// Pass 2: coordinates of those nodes, then the ways themselves.
const nodeIndex = new Map<number, number>();
const lats = new Float64Array(nodeUses.size);
const lons = new Float64Array(nodeUses.size);
const tiles = new Map<string, EncodedWay[]>();
let wayCount = 0;
let missingNodes = 0;

for await (const item of read(true)) {
  if (!('type' in item)) continue;
  if (item.type === 'node') {
    if (!nodeUses.has(item.id)) continue;
    const i = nodeIndex.size;
    nodeIndex.set(item.id, i);
    lats[i] = item.lat;
    lons[i] = item.lon;
  } else if (item.type === 'way' && keepWay(item.tags)) {
    const nodes: number[] = [];
    const geometry: { lat: number; lon: number }[] = [];
    for (const ref of item.refs) {
      const i = nodeIndex.get(ref);
      if (i === undefined) {
        missingNodes++;
        continue;
      }
      nodes.push(ref);
      geometry.push({ lat: lats[i], lon: lons[i] });
    }
    if (nodes.length < 2) continue;

    const encoded = encodeWay({ id: item.id, nodes, geometry, tags: pickRoutingTags(item.tags!) }, isJunction);
    // Every tile any segment passes through gets the whole way.
    const keys = new Set<string>();
    for (let s = 0; s + 1 < geometry.length; s++) {
      const a = geometry[s];
      const b = geometry[s + 1];
      const box: BBox = {
        south: Math.min(a.lat, b.lat),
        north: Math.max(a.lat, b.lat),
        west: Math.min(a.lon, b.lon),
        east: Math.max(a.lon, b.lon),
      };
      for (const k of tileKeysForBBox(box)) keys.add(k);
    }
    for (const k of keys) {
      const list = tiles.get(k);
      if (list) list.push(encoded);
      else tiles.set(k, [encoded]);
    }
    wayCount++;
  }
}
log(`pass 2: ${wayCount.toLocaleString()} ways in ${tiles.size} tiles (${missingNodes} node refs outside the extract)`);

// Bounds: from the extract header when present, else from the data.
let bounds: BBox;
if (header?.bbox) {
  const nano = 1e9;
  bounds = {
    south: header.bbox.bottom / nano,
    north: header.bbox.top / nano,
    west: header.bbox.left / nano,
    east: header.bbox.right / nano,
  };
} else {
  bounds = { south: Infinity, north: -Infinity, west: Infinity, east: -Infinity };
  for (let i = 0; i < nodeIndex.size; i++) {
    bounds.south = Math.min(bounds.south, lats[i]);
    bounds.north = Math.max(bounds.north, lats[i]);
    bounds.west = Math.min(bounds.west, lons[i]);
    bounds.east = Math.max(bounds.east, lons[i]);
  }
}

const dataTimestamp = header?.osmosis_replication_timestamp
  ? new Date(header.osmosis_replication_timestamp * 1000).toISOString()
  : new Date().toISOString();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'tiles'), { recursive: true });

let rawBytes = 0;
let gzBytes = 0;
let largest = { key: '', gz: 0 };
const keys = [...tiles.keys()].sort();
for (const key of keys) {
  const file: TileFile = { format: TILE_FORMAT, ways: tiles.get(key)! };
  const json = JSON.stringify(file);
  writeFileSync(join(outDir, 'tiles', `${key}.json`), json);
  const gz = gzipSync(json).length;
  rawBytes += json.length;
  gzBytes += gz;
  if (gz > largest.gz) largest = { key, gz };
}

const manifest: TileManifest = {
  format: TILE_FORMAT,
  version: `${TILE_FORMAT}-${dataTimestamp}`,
  dataTimestamp,
  tileDeg: TILE_DEG,
  bounds,
  tiles: keys,
  attribution: '© OpenStreetMap contributors, ODbL',
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Scoot2 road tiles</title>
<p>Road data tiles for the Scoot2 app: ${keys.length} tiles, data from ${dataTimestamp}.</p>
<p>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available under the ODbL.</p>\n`,
);

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
log(
  `wrote ${keys.length} tiles: ${mb(rawBytes)} raw, ${mb(gzBytes)} gzipped; ` +
    `largest ${largest.key} ${(largest.gz / 1e3).toFixed(0)} KB gzipped`,
);
