import { angleDiff, bearing, distance, projectOnSegment } from './geo';
import { classifyWay, needsAdjacentRoad, ROAD_CLASSES, type WayClass } from './rules';
import { roadSpeed } from './speed';

export interface OsmWay {
  id: number;
  nodes: number[];
  geometry: ({ lat: number; lon: number } | null)[];
  tags?: Record<string, string>;
}

export interface StreetNames {
  name?: string;
  nameEn?: string;
  nameHe?: string;
  ref?: string;
}

export interface WayInfo extends WayClass, StreetNames {
  osmId: number;
  highway: string;
  roundabout: boolean;
  /** For unnamed paths and sidewalks: the road they run beside. */
  along?: StreetNames;
}

function namesOf(tags: Record<string, string>): StreetNames {
  return { name: tags.name, nameEn: tags['name:en'], nameHe: tags['name:he'], ref: tags.ref };
}

export interface Edge {
  to: number;
  way: number;
  length: number;
}

export interface Graph {
  lat: number[];
  lon: number[];
  adj: Edge[][];
  ways: WayInfo[];
  /** Branches leaving each node across all ways, ridable or not; 3+ means an intersection. */
  degree: number[];
  /** Spatial index over nodes that have at least one usable edge. */
  index: GridIndex;
}

const CELL_DEG = 0.002; // ~200 m

export class GridIndex {
  private cells = new Map<string, number[]>();

  add(id: number, lat: number, lon: number) {
    const key = cellKey(lat, lon);
    const list = this.cells.get(key);
    if (list) list.push(id);
    else this.cells.set(key, [id]);
  }

  /** Ids in cells within `rings` cells of the point. */
  near(lat: number, lon: number, rings = 1): number[] {
    const cy = Math.floor(lat / CELL_DEG);
    const cx = Math.floor(lon / CELL_DEG);
    const out: number[] = [];
    for (let dy = -rings; dy <= rings; dy++) {
      for (let dx = -rings; dx <= rings; dx++) {
        const list = this.cells.get(`${cy + dy}:${cx + dx}`);
        if (list) out.push(...list);
      }
    }
    return out;
  }
}

function cellKey(lat: number, lon: number) {
  return `${Math.floor(lat / CELL_DEG)}:${Math.floor(lon / CELL_DEG)}`;
}

interface RoadSegment {
  aLat: number;
  aLon: number;
  bLat: number;
  bLon: number;
  bearing: number;
  road: number;
}

interface Road {
  speed: number;
  names: StreetNames;
}

/** How far a separately mapped sidewalk may be from its road. */
const SIDEWALK_MAX_OFFSET_M = 30;
/** Max bearing difference (either direction) for a road to count as running alongside. */
const PARALLEL_TOLERANCE_DEG = 30;

/** Index of road segments so separately mapped sidewalks can find the road they belong to. */
function buildRoadIndex(ways: OsmWay[], strictUnknown: boolean) {
  const segments: RoadSegment[] = [];
  const roads: Road[] = [];
  const index = new GridIndex();
  for (const w of ways) {
    const tags = w.tags ?? {};
    if (!ROAD_CLASSES.has(tags.highway)) continue;
    const road = roads.length;
    roads.push({ speed: roadSpeed(tags, strictUnknown).limit, names: namesOf(tags) });
    for (let i = 0; i + 1 < w.geometry.length; i++) {
      const a = w.geometry[i];
      const b = w.geometry[i + 1];
      if (!a || !b) continue;
      const id = segments.length;
      segments.push({
        aLat: a.lat,
        aLon: a.lon,
        bLat: b.lat,
        bLon: b.lon,
        bearing: bearing(a.lat, a.lon, b.lat, b.lon),
        road,
      });
      index.add(id, (a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
    }
  }
  return { segments, roads, index };
}

/**
 * Finds the road a sidewalk or path runs beside. Each of its segments votes,
 * weighted by length, for the nearest roughly parallel road segment.
 */
function adjacentRoad(way: OsmWay, roads: ReturnType<typeof buildRoadIndex>): Road | null {
  const votes = new Map<number, number>();
  for (let i = 0; i + 1 < way.geometry.length; i++) {
    const a = way.geometry[i];
    const b = way.geometry[i + 1];
    if (!a || !b) continue;
    const mLat = (a.lat + b.lat) / 2;
    const mLon = (a.lon + b.lon) / 2;
    const swBearing = bearing(a.lat, a.lon, b.lat, b.lon);
    let best: RoadSegment | null = null;
    let bestDist = SIDEWALK_MAX_OFFSET_M;
    for (const id of roads.index.near(mLat, mLon)) {
      const s = roads.segments[id];
      const diff = Math.abs(angleDiff(swBearing, s.bearing));
      if (Math.min(diff, 180 - diff) > PARALLEL_TOLERANCE_DEG) continue;
      const p = projectOnSegment(mLat, mLon, s.aLat, s.aLon, s.bLat, s.bLon);
      if (p.distance < bestDist) {
        bestDist = p.distance;
        best = s;
      }
    }
    if (best) {
      const len = distance(a.lat, a.lon, b.lat, b.lon);
      votes.set(best.road, (votes.get(best.road) ?? 0) + len);
    }
  }
  let result: Road | null = null;
  let resultVotes = 0;
  for (const [road, v] of votes) {
    const r = roads.roads[road];
    // Ties go to the faster road so a sidewalk is never wrongly judged to be beside a slow one.
    if (v > resultVotes || (v === resultVotes && result && r.speed > result.speed)) {
      result = r;
      resultVotes = v;
    }
  }
  return result;
}

export interface BuildOptions {
  strictUnknown: boolean;
}

export function buildGraph(osmWays: OsmWay[], opts: BuildOptions): Graph {
  const roads = buildRoadIndex(osmWays, opts.strictUnknown);
  const nodeIndex = new Map<number, number>();
  const lat: number[] = [];
  const lon: number[] = [];
  const adj: Edge[][] = [];
  const degree: number[] = [];
  const ways: WayInfo[] = [];
  const index = new GridIndex();

  const nodeFor = (osmId: number, la: number, lo: number) => {
    let idx = nodeIndex.get(osmId);
    if (idx === undefined) {
      idx = lat.length;
      nodeIndex.set(osmId, idx);
      lat.push(la);
      lon.push(lo);
      adj.push([]);
      degree.push(0);
    }
    return idx;
  };

  for (const w of osmWays) {
    const tags = w.tags ?? {};
    if (!tags.highway) continue;

    // Count branches leaving each node across every way, ridable or not, so
    // intersections are detected: an interior node adds 2, an endpoint adds 1.
    const last = w.nodes.length - 1;
    w.nodes.forEach((id, i) => {
      const g = w.geometry[i];
      if (!g) return;
      degree[nodeFor(id, g.lat, g.lon)] += i === 0 || i === last ? 1 : 2;
    });

    const unnamedPath = !ROAD_CLASSES.has(tags.highway) && !tags.name && !tags.ref;
    const beside = needsAdjacentRoad(tags) || unnamedPath ? adjacentRoad(w, roads) : null;
    const cls = classifyWay(tags, {
      strictUnknown: opts.strictUnknown,
      adjacentRoadSpeed: needsAdjacentRoad(tags) ? (beside?.speed ?? null) : undefined,
    });
    if (!cls) continue;

    const wayIdx = ways.length;
    ways.push({
      ...cls,
      ...namesOf(tags),
      osmId: w.id,
      highway: tags.highway,
      roundabout: tags.junction === 'roundabout' || tags.junction === 'circular',
      along: unnamedPath && beside && (beside.names.name || beside.names.ref) ? beside.names : undefined,
    });

    for (let i = 0; i + 1 < w.nodes.length; i++) {
      const ga = w.geometry[i];
      const gb = w.geometry[i + 1];
      if (!ga || !gb) continue;
      const a = nodeFor(w.nodes[i], ga.lat, ga.lon);
      const b = nodeFor(w.nodes[i + 1], gb.lat, gb.lon);
      if (a === b) continue;
      const length = distance(ga.lat, ga.lon, gb.lat, gb.lon);
      if (cls.oneway !== -1) adj[a].push({ to: b, way: wayIdx, length });
      if (cls.oneway !== 1) adj[b].push({ to: a, way: wayIdx, length });
    }
  }

  for (let i = 0; i < lat.length; i++) {
    if (adj[i].length > 0) index.add(i, lat[i], lon[i]);
  }
  return { lat, lon, adj, ways, degree, index };
}

/** Nearest `k` usable nodes to a point within `maxMeters`, closest first. */
export function nearestNodes(
  g: Graph,
  la: number,
  lo: number,
  k: number,
  maxMeters: number,
): { node: number; distance: number }[] {
  const rings = Math.ceil(maxMeters / 200) + 1;
  const found: { node: number; distance: number }[] = [];
  for (const id of g.index.near(la, lo, rings)) {
    const d = distance(la, lo, g.lat[id], g.lon[id]);
    if (d <= maxMeters) found.push({ node: id, distance: d });
  }
  found.sort((x, y) => x.distance - y.distance);
  return found.slice(0, k);
}
