import { projectOnSegment } from '../routing/geo';
import type { Route } from '../routing/router';
import type { Instruction } from './instructions';

export interface Fix {
  latitude: number;
  longitude: number;
  /** Meters, if known. */
  accuracy?: number | null;
  /** m/s, if known. */
  speed?: number | null;
}

export type Announcement =
  | { kind: 'prepare'; instruction: Instruction; distance: number }
  | { kind: 'now'; instruction: Instruction; then?: Instruction }
  | { kind: 'arrived' };

export interface TrackState {
  /** Meters along the route of the projected position. */
  along: number;
  /** Distance from the route line. */
  offset: number;
  /** Position snapped onto the route. */
  snapped: { latitude: number; longitude: number };
  /** Index of the next instruction still ahead. */
  nextIndex: number;
  distanceToNext: number;
  remaining: number;
  offRoute: boolean;
  arrived: boolean;
  /** Direction of travel along the route at the snapped point. */
  segmentIndex: number;
}

const PREPARE_DISTANCE_M = 200;
/** Skip the "prepare" call when the previous maneuver is closer than this. */
const PREPARE_MIN_GAP_M = 280;
const NOW_MIN_M = 25;
/** Seconds of warning for the "now" call at the current speed. */
const NOW_SECONDS = 6;
/** Chain "then ..." when the following maneuver comes this soon after. */
const THEN_GAP_M = 60;
const ARRIVE_RADIUS_M = 20;
const OFF_ROUTE_BASE_M = 30;
const OFF_ROUTE_MAX_M = 60;
const OFF_ROUTE_FIXES = 3;
/** Search this many segments behind/ahead of the last match before scanning the whole route. */
const WINDOW_BEHIND = 5;
const WINDOW_AHEAD = 60;

export class NavigationTracker {
  private segment = 0;
  private along = 0;
  private offCount = 0;
  private announced = new Set<string>();
  private arrived = false;

  constructor(
    private route: Route,
    private instructions: Instruction[],
  ) {}

  private project(fix: Fix, from: number, to: number) {
    const pts = this.route.points;
    let best = { seg: -1, distance: Infinity, along: 0, lat: 0, lon: 0 };
    for (let i = Math.max(0, from); i < Math.min(pts.length - 1, to); i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const p = projectOnSegment(fix.latitude, fix.longitude, a.latitude, a.longitude, b.latitude, b.longitude);
      // Slight bias toward the segments ahead to avoid snapping back on routes that overlap themselves.
      const score = p.distance + (i < this.segment ? 5 : 0);
      if (score < best.distance) {
        best = { seg: i, distance: score, along: a.dist + p.t * (b.dist - a.dist), lat: p.lat, lon: p.lon };
      }
    }
    return best;
  }

  update(fix: Fix): { state: TrackState; announcements: Announcement[] } {
    const pts = this.route.points;
    let m = this.project(fix, this.segment - WINDOW_BEHIND, this.segment + WINDOW_AHEAD);
    if (m.seg < 0 || m.distance > OFF_ROUTE_BASE_M) {
      const global = this.project(fix, 0, pts.length);
      if (global.distance < m.distance) m = global;
    }
    if (m.seg < this.segment) m.distance -= 5; // undo the bias for reporting

    const offset = Math.max(0, m.distance);
    const threshold = Math.min(OFF_ROUTE_MAX_M, Math.max(OFF_ROUTE_BASE_M, (fix.accuracy ?? 0) * 1.5));
    if (offset > threshold) this.offCount++;
    else this.offCount = 0;
    const offRoute = this.offCount >= OFF_ROUTE_FIXES;

    if (offset <= threshold) {
      this.segment = m.seg;
      this.along = m.along;
    }

    const total = this.route.distance;
    const remaining = Math.max(0, total - this.along);
    const announcements: Announcement[] = [];

    let nextIndex = this.instructions.findIndex((ins, i) => i > 0 && ins.dist > this.along + 2);
    if (nextIndex < 0) nextIndex = this.instructions.length - 1;
    const next = this.instructions[nextIndex];
    const distanceToNext = Math.max(0, next.dist - this.along);

    if (!this.arrived && remaining <= ARRIVE_RADIUS_M && !offRoute) {
      this.arrived = true;
      announcements.push({ kind: 'arrived' });
    } else if (!offRoute && !this.arrived) {
      const speed = fix.speed && fix.speed > 0 ? fix.speed : 5;
      const nowDistance = Math.max(NOW_MIN_M, speed * NOW_SECONDS);
      const prev = this.instructions[nextIndex - 1];
      const gapFromPrev = prev ? next.dist - prev.dist : Infinity;

      if (next.type !== 'arrive') {
        if (distanceToNext <= nowDistance) {
          if (this.once(`now:${nextIndex}`)) {
            this.announced.add(`prepare:${nextIndex}`);
            const following = this.instructions[nextIndex + 1];
            const then =
              following && following.type !== 'arrive' && following.dist - next.dist <= THEN_GAP_M
                ? following
                : undefined;
            announcements.push({ kind: 'now', instruction: next, then });
          }
        } else if (
          distanceToNext <= PREPARE_DISTANCE_M &&
          gapFromPrev >= PREPARE_MIN_GAP_M &&
          this.once(`prepare:${nextIndex}`)
        ) {
          announcements.push({ kind: 'prepare', instruction: next, distance: distanceToNext });
        }
      }
    }

    return {
      state: {
        along: this.along,
        offset,
        snapped: { latitude: m.lat, longitude: m.lon },
        nextIndex,
        distanceToNext,
        remaining,
        offRoute,
        arrived: this.arrived,
        segmentIndex: this.segment,
      },
      announcements,
    };
  }

  private once(key: string): boolean {
    if (this.announced.has(key)) return false;
    this.announced.add(key);
    return true;
  }
}
