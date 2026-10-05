import { angleDiff, bearing } from '../routing/geo';
import type { StreetNames, WayInfo } from '../routing/graph';
import type { TravelMode } from '../routing/rules';
import type { Route, RoutePoint } from '../routing/router';

export type TurnType =
  | 'depart'
  | 'straight'
  | 'slight_left'
  | 'slight_right'
  | 'left'
  | 'right'
  | 'sharp_left'
  | 'sharp_right'
  | 'uturn'
  | 'cross'
  | 'roundabout'
  | 'arrive';

export interface StreetName extends StreetNames {
  /** For unnamed paths and sidewalks: the road they run beside. */
  along?: StreetNames;
}

export interface Instruction {
  type: TurnType;
  /** Index into route.points where the maneuver happens. */
  pointIndex: number;
  /** Meters from the route start. */
  dist: number;
  street: StreetName;
  /** Mode ridden after this maneuver. */
  mode: TravelMode | null;
  /** True when the rider moves onto a different kind of surface (e.g. road to sidewalk). */
  modeChanged: boolean;
  /** Compass heading for the depart instruction. */
  heading?: number;
  /** Exit number for roundabouts, starting at 1. */
  exit?: number;
  /** Turn direction for maneuvers like roundabouts, for icons. */
  angle?: number;
}

/** Distance over which bearings are measured either side of a maneuver. */
const BEARING_SPAN_M = 20;
/** Turns sharper than this at an intersection get their own instruction even on the same street. */
const SAME_STREET_TURN_DEG = 45;
/** Maneuvers this close together are merged into one (complex junctions, short blips). */
const CLUSTER_M = 35;

export function turnType(angle: number): TurnType {
  const a = Math.abs(angle);
  if (a < 20) return 'straight';
  const side = angle < 0 ? 'left' : 'right';
  if (a < 45) return `slight_${side}`;
  if (a < 135) return side;
  if (a < 165) return `sharp_${side}`;
  return 'uturn';
}

function bearingAt(points: RoutePoint[], i: number, dir: 1 | -1): number | null {
  const origin = points[i];
  let j = i + dir;
  while (j >= 0 && j < points.length) {
    if (Math.abs(points[j].dist - origin.dist) >= BEARING_SPAN_M) break;
    j += dir;
  }
  j = Math.max(0, Math.min(points.length - 1, j));
  if (j === i) return null;
  const [a, b] = dir === 1 ? [origin, points[j]] : [points[j], origin];
  return bearing(a.latitude, a.longitude, b.latitude, b.longitude);
}

/** Turn angle from arriving at point `from` to leaving point `to`, negative for left. */
function angleBetween(points: RoutePoint[], from: number, to: number): number {
  const before = bearingAt(points, from, -1);
  const after = bearingAt(points, to, 1);
  if (before === null || after === null) return 0;
  return angleDiff(before, after);
}

/** Street identity for detecting name changes; '' when nothing names the way. */
function streetKey(w: WayInfo | null): string {
  if (!w) return '';
  return w.name ?? w.ref ?? w.along?.name ?? w.along?.ref ?? '';
}

function streetOf(w: WayInfo | null): StreetName {
  if (!w) return {};
  return { name: w.name, nameEn: w.nameEn, nameHe: w.nameHe, ref: w.ref, along: w.along };
}

/** A point where something may need to be said, before nearby ones are merged. */
interface Candidate {
  index: number;
  junctionTurn: boolean;
  entersCrossing: boolean;
  /** Set for roundabouts, which are never merged with neighbours. */
  roundabout?: { entry: number; exit: number };
}

function findCandidates(pts: RoutePoint[], firstRide: number): Candidate[] {
  const out: Candidate[] = [];
  for (let i = firstRide + 1; i < pts.length - 1; i++) {
    const way = pts[i].way;
    const prev = pts[i - 1].way;
    if (!way || !prev) continue;

    if (way.roundabout && !prev.roundabout) {
      let exit = 0;
      let j = i + 1;
      while (j < pts.length - 1 && pts[j].way?.roundabout) {
        if (pts[j].degree >= 3) exit++;
        j++;
      }
      // The exit point itself is a junction too.
      out.push({ index: j, junctionTurn: true, entersCrossing: false, roundabout: { entry: i, exit: exit + 1 } });
      i = j;
      continue;
    }

    const angle = angleBetween(pts, i, i);
    const junctionTurn = pts[i].degree >= 3 && Math.abs(angle) >= SAME_STREET_TURN_DEG;
    const entersCrossing = way.mode === 'crossing' && prev.mode !== 'crossing';
    const changed = streetKey(way) !== streetKey(prev) || way.mode !== prev.mode;
    if (junctionTurn || entersCrossing || changed) {
      out.push({ index: i, junctionTurn, entersCrossing });
    }
  }
  return out;
}

function clusterCandidates(cands: Candidate[], pts: RoutePoint[]): Candidate[][] {
  const clusters: Candidate[][] = [];
  for (const c of cands) {
    const last = clusters[clusters.length - 1];
    const tail = last?.[last.length - 1];
    if (
      tail &&
      !tail.roundabout &&
      !c.roundabout &&
      pts[c.index].dist - pts[tail.index].dist <= CLUSTER_M
    ) {
      last.push(c);
    } else {
      clusters.push([c]);
    }
  }
  return clusters;
}

/** Builds the list of maneuvers a rider needs to be told about, from depart to arrive. */
export function buildInstructions(route: Route): Instruction[] {
  const pts = route.points;
  const out: Instruction[] = [];

  // The first point with a way is where riding starts (index 1 after the walk-on connector).
  const firstRide = pts.findIndex((p) => p.way !== null);
  const firstWay = firstRide >= 0 ? pts[firstRide].way : null;
  out.push({
    type: 'depart',
    pointIndex: 0,
    dist: 0,
    street: streetOf(firstWay),
    mode: firstWay?.mode ?? null,
    modeChanged: false,
    heading: bearingAt(pts, Math.max(0, firstRide), 1) ?? 0,
  });

  // What the rider was last told they are on: crossings don't count as a new surface.
  let currentMode: TravelMode | null = firstWay?.mode ?? null;
  let currentStreet = streetKey(firstWay);

  for (const cluster of clusterCandidates(findCandidates(pts, firstRide), pts)) {
    const first = cluster[0];
    const last = cluster[cluster.length - 1];
    const after = pts[last.index].way!;
    const street = streetOf(after);

    if (first.roundabout) {
      const angle = angleBetween(pts, first.roundabout.entry, last.index);
      out.push({
        type: 'roundabout',
        pointIndex: first.roundabout.entry,
        dist: pts[first.roundabout.entry].dist,
        street,
        mode: after.mode,
        modeChanged: after.mode !== currentMode,
        exit: first.roundabout.exit,
        angle,
      });
      currentMode = after.mode;
      currentStreet = streetKey(after) || currentStreet;
      continue;
    }

    const angle = angleBetween(pts, first.index, last.index);
    const turn = turnType(angle);
    const crossing = cluster.find((c) => c.entersCrossing);
    const endsOnCrossing = after.mode === 'crossing';
    const modeAfter = endsOnCrossing ? currentMode : after.mode;
    const modeChanged = modeAfter !== currentMode;
    const key = streetKey(after);
    const nameChanged = key !== '' && key !== currentStreet;
    const isTurn = turn !== 'straight' && cluster.some((c) => c.junctionTurn || c.entersCrossing);

    if (crossing) {
      out.push({
        type: 'cross',
        pointIndex: crossing.index,
        dist: pts[crossing.index].dist,
        street: {},
        mode: 'crossing',
        modeChanged: false,
      });
    }

    let type: TurnType | null = null;
    if (endsOnCrossing) type = null;
    else if (isTurn || (turn !== 'straight' && (nameChanged || modeChanged))) type = turn;
    else if (!crossing && (nameChanged || modeChanged)) type = 'straight';
    else if (crossing && modeChanged) type = 'straight';

    if (type) {
      out.push({
        type,
        pointIndex: last.index,
        dist: pts[last.index].dist,
        street,
        mode: after.mode,
        modeChanged,
        angle,
      });
    }
    if (!endsOnCrossing) {
      currentMode = after.mode;
      if (key) currentStreet = key;
    }
  }

  const end = pts.length - 1;
  out.push({
    type: 'arrive',
    pointIndex: end,
    dist: pts[end].dist,
    street: {},
    mode: null,
    modeChanged: false,
  });
  return out;
}
