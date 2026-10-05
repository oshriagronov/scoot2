import { aStar, type Terminal } from './astar';
import { travelTime, type CostOptions } from './cost';
import { bboxContains, distance, distanceLL, paddedBBox, type BBox, type LatLng } from './geo';
import { buildGraph, nearestNodes, type Graph, type OsmWay, type WayInfo } from './graph';
import type { TravelMode } from './rules';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  /** Meters from the route start. */
  dist: number;
  /** Way used from this point to the next; null for the final point and walk-on/off connectors. */
  way: WayInfo | null;
  /** Branch count at this point; 3+ is an intersection. */
  degree: number;
}

export interface RouteSegment {
  mode: TravelMode | 'connector';
  coordinates: LatLng[];
}

export interface Route {
  points: RoutePoint[];
  /** Consecutive runs of the same travel mode, for drawing. */
  segments: RouteSegment[];
  distance: number;
  /** Expected duration in seconds. */
  duration: number;
  /** Meters ridden in each mode. */
  byMode: Partial<Record<TravelMode, number>>;
  /** Meters on roads whose speed limit was assumed rather than tagged. */
  inferredSpeedMeters: number;
  from: LatLng;
  to: LatLng;
}

export interface RouteOptions extends CostOptions {
  strictUnknown: boolean;
}

export class RoutingError extends Error {
  constructor(
    public code: 'too_far' | 'no_road_near_start' | 'no_road_near_end' | 'no_route',
    message: string,
  ) {
    super(message);
  }
}

/** Longest straight-line trip we try to plan (data download grows with area). */
export const MAX_TRIP_METERS = 30000;
const SNAP_RADIUS_M = 400;
const SNAP_CANDIDATES = 6;
/** Pushing the vehicle to/from the nearest usable way, in m/s. */
const WALK_SPEED_MPS = 1.2;

export type WayFetcher = (bbox: BBox, signal?: AbortSignal) => Promise<OsmWay[]>;

interface CachedArea {
  bbox: BBox;
  ways: OsmWay[];
  graphs: Map<boolean, Graph>;
}

/**
 * Plans routes over map data fetched on demand. Keeps the last downloaded area
 * so re-routing during a ride does not need another download.
 */
export class Router {
  private cache: CachedArea | null = null;

  constructor(private fetchWays: WayFetcher) {}

  private async graphFor(from: LatLng, to: LatLng, strict: boolean, signal?: AbortSignal) {
    const c = this.cache;
    if (!c || !bboxContains(c.bbox, from, 300) || !bboxContains(c.bbox, to, 300)) {
      const trip = distanceLL(from, to);
      const bbox = paddedBBox([from, to], Math.max(1000, trip * 0.25));
      const ways = await this.fetchWays(bbox, signal);
      this.cache = { bbox, ways, graphs: new Map() };
    }
    const area = this.cache!;
    let g = area.graphs.get(strict);
    if (!g) {
      g = buildGraph(area.ways, { strictUnknown: strict });
      area.graphs.set(strict, g);
    }
    return g;
  }

  async plan(from: LatLng, to: LatLng, opts: RouteOptions, signal?: AbortSignal): Promise<Route> {
    if (distanceLL(from, to) > MAX_TRIP_METERS) {
      throw new RoutingError('too_far', `Trips are limited to ${MAX_TRIP_METERS / 1000} km`);
    }
    const g = await this.graphFor(from, to, opts.strictUnknown, signal);
    return planOnGraph(g, from, to, opts);
  }
}

export function planOnGraph(g: Graph, from: LatLng, to: LatLng, opts: RouteOptions): Route {
  const terminals = (p: LatLng): Terminal[] =>
    nearestNodes(g, p.latitude, p.longitude, SNAP_CANDIDATES, SNAP_RADIUS_M).map((c) => ({
      node: c.node,
      cost: c.distance / WALK_SPEED_MPS,
    }));

  const sources = terminals(from);
  if (!sources.length) {
    throw new RoutingError('no_road_near_start', 'No ridable street near the start point');
  }
  const targets = terminals(to);
  if (!targets.length) {
    throw new RoutingError('no_road_near_end', 'No ridable street near the destination');
  }

  const path = aStar(g, sources, targets, { lat: to.latitude, lon: to.longitude }, opts);
  if (!path) {
    throw new RoutingError('no_route', 'No legal route found between these points');
  }
  return assembleRoute(g, path.nodes, path.ways, from, to, opts);
}

function assembleRoute(
  g: Graph,
  nodes: number[],
  ways: number[],
  from: LatLng,
  to: LatLng,
  opts: RouteOptions,
): Route {
  const points: RoutePoint[] = [];
  let dist = 0;
  let duration = 0;
  let inferredSpeedMeters = 0;
  const byMode: Partial<Record<TravelMode, number>> = {};

  const push = (lat: number, lon: number, degree: number) => {
    const prev = points[points.length - 1];
    if (prev) dist += distance(prev.latitude, prev.longitude, lat, lon);
    points.push({ latitude: lat, longitude: lon, dist, way: null, degree });
  };

  push(from.latitude, from.longitude, 0);
  duration += distance(from.latitude, from.longitude, g.lat[nodes[0]], g.lon[nodes[0]]) / WALK_SPEED_MPS;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    push(g.lat[n], g.lon[n], g.degree[n]);
    if (i + 1 < nodes.length) {
      const way = g.ways[ways[i + 1]];
      points[points.length - 1].way = way;
      const len = distance(g.lat[n], g.lon[n], g.lat[nodes[i + 1]], g.lon[nodes[i + 1]]);
      duration += travelTime(way, len, opts.cruiseSpeed);
      byMode[way.mode] = (byMode[way.mode] ?? 0) + len;
      if (way.speedInferred && (way.mode === 'road' || way.mode === 'road_lane')) {
        inferredSpeedMeters += len;
      }
    }
  }

  const lastNode = nodes[nodes.length - 1];
  duration += distance(g.lat[lastNode], g.lon[lastNode], to.latitude, to.longitude) / WALK_SPEED_MPS;
  push(to.latitude, to.longitude, 0);

  return {
    points,
    segments: buildSegments(points),
    distance: dist,
    duration,
    byMode,
    inferredSpeedMeters,
    from,
    to,
  };
}

function buildSegments(points: RoutePoint[]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const mode = points[i].way?.mode ?? 'connector';
    const a = { latitude: points[i].latitude, longitude: points[i].longitude };
    const b = { latitude: points[i + 1].latitude, longitude: points[i + 1].longitude };
    const last = segments[segments.length - 1];
    if (last && last.mode === mode) last.coordinates.push(b);
    else segments.push({ mode, coordinates: [a, b] });
  }
  return segments;
}
