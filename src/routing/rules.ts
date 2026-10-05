import { roadSpeed } from './speed';

/**
 * How the rider travels along a way.
 * - bike_lane:   dedicated lane/track/cycleway, including sidewalks with a marked lane
 * - road_lane:   painted bike lane on a road with a limit of 50 km/h or less
 * - road:        the carriageway of a road with a limit of 50 km/h or less
 * - sidewalk:    a sidewalk beside a road whose limit is above 50 km/h
 * - shared_path: multi-use path where bikes are permitted (not a sidewalk)
 * - crossing:    a marked crossing linking sidewalks/paths across a road
 */
export type TravelMode =
  | 'bike_lane'
  | 'road_lane'
  | 'road'
  | 'sidewalk'
  | 'shared_path'
  | 'crossing';

/** The legal speed limit for riding on roads. */
export const MAX_ROAD_SPEED = 50;

export interface WayClass {
  mode: TravelMode;
  /** Speed limit of the road the way belongs to or runs beside, if known. */
  speedLimit: number | null;
  speedInferred: boolean;
  /** 1: only forward along node order, -1: only backward, 0: both. */
  oneway: 0 | 1 | -1;
}

export interface ClassifyContext {
  /** For separately mapped sidewalks: limit of the road running alongside, if one was found. */
  adjacentRoadSpeed?: number | null;
  /** Treat main roads without speed tags as being above 50 km/h. */
  strictUnknown: boolean;
}

export const ROAD_CLASSES = new Set([
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'road',
  'track',
]);

const NEVER_RIDABLE = new Set([
  'motorway',
  'motorway_link',
  'steps',
  'construction',
  'proposed',
  'abandoned',
  'bus_guideway',
  'busway',
  'raceway',
  'corridor',
  'elevator',
  'platform',
  'bridleway',
  'escape',
]);

const YES = new Set(['yes', 'designated', 'permissive']);
const DENIED = new Set(['no', 'private', 'agricultural', 'forestry', 'delivery']);

/** Explicit bicycle/scooter permission, prohibition, or no statement. */
function bikeAccess(tags: Record<string, string>): 'yes' | 'designated' | 'no' | undefined {
  for (const key of ['electric_scooter', 'bicycle']) {
    const v = tags[key];
    if (v === undefined) continue;
    if (v === 'designated') return 'designated';
    if (YES.has(v)) return 'yes';
    if (v === 'no' || v === 'dismount' || v === 'use_sidepath') return 'no';
  }
  const general = tags.vehicle ?? tags.access;
  if (general !== undefined && DENIED.has(general)) return 'no';
  return undefined;
}

type CyclewayKind = 'track' | 'lane' | 'none';

/** Bike infrastructure attached to a road (not separately mapped). */
function cyclewayOnRoad(tags: Record<string, string>): CyclewayKind {
  let kind: CyclewayKind = 'none';
  for (const key of ['cycleway', 'cycleway:both', 'cycleway:left', 'cycleway:right']) {
    const v = tags[key];
    if (!v) continue;
    if (v === 'track' || v === 'opposite_track') return 'track';
    if (v === 'lane' || v === 'opposite_lane' || v === 'exclusive') kind = 'lane';
  }
  // A sidewalk carrying a designated bike lane counts as a track for our purposes.
  for (const side of ['both', 'left', 'right']) {
    if (tags[`sidewalk:${side}:bicycle`] === 'designated') return 'track';
  }
  if (tags['sidewalk:bicycle'] === 'designated') return 'track';
  return kind;
}

/** Whether a road has a sidewalk drawn as part of the road itself (not mapped separately). */
function hasAttachedSidewalk(tags: Record<string, string>): boolean {
  const v = tags.sidewalk ?? tags['sidewalk:both'];
  if (v && ['both', 'left', 'right', 'yes'].includes(v)) return true;
  return tags['sidewalk:left'] === 'yes' || tags['sidewalk:right'] === 'yes';
}

function isSidewalk(tags: Record<string, string>): boolean {
  return tags.footway === 'sidewalk' || tags.path === 'sidewalk' || tags.cycleway === 'sidewalk';
}

function isCrossing(tags: Record<string, string>): boolean {
  return (
    tags.footway === 'crossing' ||
    tags.cycleway === 'crossing' ||
    tags.path === 'crossing' ||
    tags.highway === 'crossing'
  );
}

function roadOneway(tags: Record<string, string>): 0 | 1 | -1 {
  if (tags['oneway:bicycle'] === 'no' || /^opposite/.test(tags.cycleway ?? '')) return 0;
  const v = tags.oneway;
  if (v === '-1' || v === 'reverse') return -1;
  if (v === 'yes' || v === '1' || v === 'true') return 1;
  if (v === undefined && (tags.junction === 'roundabout' || tags.junction === 'circular')) return 1;
  return 0;
}

function cyclewayOneway(tags: Record<string, string>): 0 | 1 | -1 {
  const v = tags['oneway:bicycle'] ?? tags.oneway;
  if (v === '-1') return -1;
  if (v === 'yes' || v === '1' || v === 'true') return 1;
  return 0;
}

/**
 * Applies the riding rules to one OSM way. Returns null when the way may not be used.
 *
 * Rules:
 * 1. Roads may be ridden only when their speed limit is 50 km/h or less.
 * 2. Sidewalks may be ridden when the road beside them is above 50 km/h.
 * 3. Sidewalks may be ridden when they have a lane for bikes/scooters.
 */
export function classifyWay(tags: Record<string, string>, ctx: ClassifyContext): WayClass | null {
  const hw = tags.highway;
  if (!hw || NEVER_RIDABLE.has(hw) || tags.area === 'yes') return null;

  const access = bikeAccess(tags);
  const pathLike = hw === 'footway' || hw === 'pedestrian' || hw === 'path' || hw === 'cycleway';

  if (pathLike) {
    if (access === 'no') return null;
    const base = { speedLimit: ctx.adjacentRoadSpeed ?? null, speedInferred: false };

    if (isCrossing(tags)) return { ...base, mode: 'crossing', oneway: 0 };

    // Rule 3: a dedicated lane (or a cycleway proper) is always usable.
    const hasLane =
      hw === 'cycleway' ||
      access === 'designated' ||
      (access === 'yes' && tags.segregated === 'yes');
    if (hasLane) return { ...base, mode: 'bike_lane', oneway: cyclewayOneway(tags) };

    // Rule 2: a sidewalk without a lane is usable only beside a road above 50 km/h.
    if (isSidewalk(tags)) {
      const adj = ctx.adjacentRoadSpeed;
      if (adj != null && adj > MAX_ROAD_SPEED) return { ...base, mode: 'sidewalk', oneway: 0 };
      return null;
    }

    // Non-sidewalk paths: multi-use paths, or footways/plazas where bikes are signed as allowed.
    if (hw === 'path' || access === 'yes') return { ...base, mode: 'shared_path', oneway: 0 };
    return null;
  }

  if (!ROAD_CLASSES.has(hw)) return null;

  const speed = roadSpeed(tags, ctx.strictUnknown);
  const base = { speedLimit: speed.limit, speedInferred: speed.inferred };
  const cycleway = cyclewayOnRoad(tags);

  // A physically separated track (or sidewalk bike lane) along the road: rule 3.
  if (cycleway === 'track') return { ...base, mode: 'bike_lane', oneway: 0 };

  // Rule 1: ride on the road when it is 50 km/h or less.
  if (speed.limit <= MAX_ROAD_SPEED && access !== 'no') {
    return { ...base, mode: cycleway === 'lane' ? 'road_lane' : 'road', oneway: roadOneway(tags) };
  }

  // Rule 2: road is too fast, so use its sidewalk if it has one.
  if (speed.limit > MAX_ROAD_SPEED && hasAttachedSidewalk(tags)) {
    return { ...base, mode: 'sidewalk', oneway: 0 };
  }
  return null;
}

/** Ways whose classification depends on the road running beside them. */
export function needsAdjacentRoad(tags: Record<string, string>): boolean {
  return isSidewalk(tags) && tags.highway !== 'cycleway';
}

/**
 * False for ways no rule can ever allow (e.g. plain footways without bike access).
 * Roads are always kept: even unridable ones decide whether their sidewalks may be used.
 */
export function mayEverBeRidden(tags: Record<string, string>): boolean {
  if (ROAD_CLASSES.has(tags.highway)) return true;
  // Best case for a sidewalk: the road beside it is fast.
  return classifyWay(tags, { strictUnknown: true, adjacentRoadSpeed: Infinity }) !== null;
}
