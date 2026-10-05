/**
 * Road-data tiles: the pipeline cuts OpenStreetMap ways into a fixed grid of
 * small JSON files, and the app downloads only the tiles a route passes through.
 * A way that crosses tile edges is stored whole in every tile it touches, so any
 * set of tiles builds a connected graph once duplicates are dropped by way id.
 */
import type { BBox } from './geo';
import type { OsmWay } from './graph';

export const TILE_FORMAT = 2;
/** Tile edge in degrees: about 2.8 km north-south. */
export const TILE_DEG = 0.025;

/**
 * [way id, tags, junctions, coordinates]
 * - junctions: (position, node id) pairs for nodes shared with other ways, both delta coded.
 *   Only these need real ids for the graph to connect; other nodes get generated ids.
 * - coordinates: lat/lon in 1e-6 degrees, delta coded and interleaved.
 */
export type EncodedWay = [number, Record<string, string>, number[], number[]];

export interface TileFile {
  format: number;
  ways: EncodedWay[];
}

export interface TileManifest {
  format: number;
  /** Changes whenever the data changes; used to invalidate cached tiles. */
  version: string;
  /** When the OpenStreetMap data was extracted. */
  dataTimestamp: string;
  tileDeg: number;
  /** Area the tiles cover. Routes reaching outside it fall back to live data. */
  bounds: BBox;
  /** Keys of tiles that exist; tiles with no roads are omitted. */
  tiles: string[];
  attribution: string;
}

export function tileKeyAt(lat: number, lon: number, deg = TILE_DEG): string {
  return `${Math.floor(lon / deg)}_${Math.floor(lat / deg)}`;
}

export function tileKeysForBBox(b: BBox, deg = TILE_DEG): string[] {
  const keys: string[] = [];
  const x0 = Math.floor(b.west / deg);
  const x1 = Math.floor(b.east / deg);
  const y0 = Math.floor(b.south / deg);
  const y1 = Math.floor(b.north / deg);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) keys.push(`${x}_${y}`);
  return keys;
}

const SCALE = 1e6;

/** OSM ways have at most 2000 nodes, so this keeps generated node ids unique per way. */
const MAX_WAY_NODES = 4096;

/** Id for a node that only one way uses. Negative, so it never collides with real OSM ids. */
function generatedNodeId(wayId: number, index: number) {
  return -(wayId * MAX_WAY_NODES + index);
}

/**
 * `isJunction` says whether a node is shared with another way (or appears twice
 * in this one, as in closed loops). Defaults to keeping every node id.
 */
export function encodeWay(way: OsmWay, isJunction: (nodeId: number) => boolean = () => true): EncodedWay {
  const junctions: number[] = [];
  const coords: number[] = [];
  let prevIndex = 0;
  let prevId = 0;
  let prevLat = 0;
  let prevLon = 0;
  let index = 0;
  way.nodes.forEach((id, i) => {
    const g = way.geometry[i];
    if (!g) return;
    if (isJunction(id)) {
      junctions.push(index - prevIndex, id - prevId);
      prevIndex = index;
      prevId = id;
    }
    const lat = Math.round(g.lat * SCALE);
    const lon = Math.round(g.lon * SCALE);
    coords.push(lat - prevLat, lon - prevLon);
    prevLat = lat;
    prevLon = lon;
    index++;
  });
  return [way.id, way.tags ?? {}, junctions, coords];
}

export function decodeWay([id, tags, junctions, coords]: EncodedWay): OsmWay {
  const count = coords.length / 2;
  const nodes: number[] = [];
  const geometry: { lat: number; lon: number }[] = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < count; i++) {
    lat += coords[2 * i];
    lon += coords[2 * i + 1];
    nodes.push(generatedNodeId(id, i));
    geometry.push({ lat: lat / SCALE, lon: lon / SCALE });
  }
  let index = 0;
  let nodeId = 0;
  for (let j = 0; j < junctions.length; j += 2) {
    index += junctions[j];
    nodeId += junctions[j + 1];
    nodes[index] = nodeId;
  }
  return { id, nodes, geometry, tags };
}
