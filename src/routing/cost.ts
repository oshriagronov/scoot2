import type { TravelMode, WayClass } from './rules';

export type RouteProfile = 'safest' | 'fastest';

/** Typical e-scooter and e-bike riding speed in km/h, for planning and arrival times. */
export const CRUISE_SPEED_KMH = 20;

export interface CostOptions {
  profile: RouteProfile;
  /** The rider's normal cruising speed in km/h. */
  cruiseSpeed: number;
}

/** Speed caps in km/h for modes shared with pedestrians. */
const MODE_SPEED_CAP: Partial<Record<TravelMode, number>> = {
  sidewalk: 10,
  crossing: 8,
  shared_path: 15,
};

/**
 * Multipliers on travel time. 1.0 is the best possible, which keeps the
 * A* heuristic (straight-line distance at cruise speed) admissible.
 */
const PREFERENCE: Record<RouteProfile, Record<TravelMode, number>> = {
  safest: {
    bike_lane: 1.0,
    road_lane: 1.25,
    road: 1.4,
    shared_path: 1.3,
    sidewalk: 1.5,
    crossing: 1.5,
  },
  fastest: {
    bike_lane: 1.0,
    road_lane: 1.0,
    road: 1.05,
    shared_path: 1.1,
    sidewalk: 1.2,
    crossing: 1.2,
  },
};

/** Fixed delay in seconds for each crossing (waiting, slowing down). */
const CROSSING_DELAY_S = 12;

/** Expected riding speed in m/s on a way. */
export function travelSpeedMps(way: WayClass, cruiseSpeed: number): number {
  let kmh = cruiseSpeed;
  const cap = MODE_SPEED_CAP[way.mode];
  if (cap !== undefined) kmh = Math.min(kmh, cap);
  if ((way.mode === 'road' || way.mode === 'road_lane') && way.speedLimit != null) {
    kmh = Math.min(kmh, way.speedLimit);
  }
  return kmh / 3.6;
}

/** Expected riding time in seconds for `meters` along a way (no preference applied). */
export function travelTime(way: WayClass, meters: number, cruiseSpeed: number): number {
  return meters / travelSpeedMps(way, cruiseSpeed);
}

/** Routing cost of riding `meters` along a way. */
export function edgeCost(way: WayClass, meters: number, opts: CostOptions): number {
  let factor = PREFERENCE[opts.profile][way.mode];
  if (opts.profile === 'safest' && way.mode === 'road' && way.speedLimit != null) {
    // Prefer calmer streets: 30 km/h zones cost less than 50 km/h roads.
    if (way.speedLimit <= 30) factor -= 0.2;
    else if (way.speedLimit >= 50) factor += 0.2;
  }
  const time = travelTime(way, meters, opts.cruiseSpeed) * factor;
  return way.mode === 'crossing' ? time + CROSSING_DELAY_S : time;
}

/** Lower bound on the cost of covering `meters` in a straight line. */
export function heuristicCost(meters: number, opts: CostOptions): number {
  return meters / (opts.cruiseSpeed / 3.6);
}
