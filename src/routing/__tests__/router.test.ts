import { describe, expect, it } from 'vitest';
import { buildGraph, type OsmWay } from '../graph';
import { planOnGraph, RoutingError, type RouteOptions } from '../router';
import { buildInstructions } from '../../navigation/instructions';
import { NavigationTracker } from '../../navigation/tracker';

/**
 * A small synthetic grid around (32.0, 34.8). One "degree unit" below is ~0.001 deg (~100 m).
 *
 *   A(0,0) ---- fast road 70, no sidewalk ---- B(0,10)
 *     |                                          |
 *   residential 30                          residential 30
 *     |                                          |
 *   C(-3,0) ------ residential 40 ------------ D(-3,10)
 */
const BASE_LAT = 32.0;
const BASE_LON = 34.8;
const U = 0.001;
const coords: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0, 5],
  3: [0, 10],
  4: [-3, 0],
  5: [-3, 5],
  6: [-3, 10],
};
const geom = (id: number) => ({ lat: BASE_LAT + coords[id][0] * U, lon: BASE_LON + coords[id][1] * U });
const way = (id: number, nodes: number[], tags: Record<string, string>): OsmWay => ({
  id,
  nodes,
  geometry: nodes.map(geom),
  tags,
});

const opts: RouteOptions = { profile: 'safest', cruiseSpeed: 20, strictUnknown: true };
const A = { latitude: geom(1).lat, longitude: geom(1).lon };
const B = { latitude: geom(3).lat, longitude: geom(3).lon };

describe('router', () => {
  it('detours around a road above 50 that has no sidewalk', () => {
    const g = buildGraph(
      [
        way(10, [1, 2, 3], { highway: 'primary', maxspeed: '70', name: 'Fast Rd' }),
        way(11, [1, 4], { highway: 'residential', maxspeed: '30', name: 'West St' }),
        way(12, [4, 5, 6], { highway: 'residential', maxspeed: '40', name: 'South St' }),
        way(13, [6, 3], { highway: 'residential', maxspeed: '30', name: 'East St' }),
      ],
      { strictUnknown: true },
    );
    const route = planOnGraph(g, A, B, opts);
    const names = new Set(route.points.map((p) => p.way?.name).filter(Boolean));
    expect(names.has('Fast Rd')).toBe(false);
    expect(names).toEqual(new Set(['West St', 'South St', 'East St']));
    expect(route.distance).toBeGreaterThan(1500);
    expect(route.byMode.road).toBeGreaterThan(1500);
  });

  it('rides the sidewalk of a fast road when it has one', () => {
    const g = buildGraph(
      [
        way(10, [1, 2, 3], { highway: 'primary', maxspeed: '70', sidewalk: 'both', name: 'Fast Rd' }),
      ],
      { strictUnknown: true },
    );
    const route = planOnGraph(g, A, B, opts);
    expect(route.byMode.sidewalk).toBeGreaterThan(900);
    expect(route.byMode.road ?? 0).toBe(0);
  });

  it('prefers calm streets over a slow sidewalk when the detour is short', () => {
    const g = buildGraph(
      [
        way(10, [1, 2, 3], { highway: 'primary', maxspeed: '70', sidewalk: 'both' }),
        way(11, [1, 4], { highway: 'residential', maxspeed: '30' }),
        way(12, [4, 5, 6], { highway: 'residential', maxspeed: '30' }),
        way(13, [6, 3], { highway: 'residential', maxspeed: '30' }),
      ],
      { strictUnknown: true },
    );
    expect(planOnGraph(g, A, B, opts).byMode.sidewalk ?? 0).toBe(0);
  });

  it('uses a separately mapped sidewalk next to a fast road, found by proximity', () => {
    // Sidewalk 10 m north of the fast road, joined to the grid by short crossings.
    const north = 10 / 110540 / U;
    coords[7] = [north, 0];
    coords[8] = [north, 10];
    const g = buildGraph(
      [
        way(10, [1, 2, 3], { highway: 'primary', maxspeed: '70' }),
        way(20, [7, 8], { highway: 'footway', footway: 'sidewalk' }),
        way(21, [1, 7], { highway: 'footway', footway: 'crossing' }),
        way(22, [8, 3], { highway: 'footway', footway: 'crossing' }),
      ],
      { strictUnknown: true },
    );
    const sidewalk = g.ways.find((w) => w.osmId === 20);
    expect(sidewalk?.mode).toBe('sidewalk');
    expect(sidewalk?.speedLimit).toBe(70);
    const route = planOnGraph(g, A, B, opts);
    expect(route.byMode.sidewalk).toBeGreaterThan(900);
  });

  it('prefers a bike lane over a parallel road in the safest profile', () => {
    coords[9] = [-1.5, 0];
    coords[10] = [-1.5, 10];
    const g = buildGraph(
      [
        way(11, [1, 9, 4], { highway: 'residential', maxspeed: '50' }),
        way(12, [4, 5, 6], { highway: 'residential', maxspeed: '50', name: 'Road' }),
        way(13, [3, 10, 6], { highway: 'residential', maxspeed: '50' }),
        way(30, [9, 10], { highway: 'cycleway', name: 'Bike Path' }),
      ],
      { strictUnknown: true },
    );
    const c = { latitude: geom(4).lat, longitude: geom(4).lon };
    const d = { latitude: geom(6).lat, longitude: geom(6).lon };
    const route = planOnGraph(g, c, d, opts);
    expect(route.byMode.bike_lane).toBeGreaterThan(900);
  });

  it('reports when no legal route exists', () => {
    const g = buildGraph(
      [
        way(10, [1, 2, 3], { highway: 'primary', maxspeed: '70' }),
        way(11, [1, 4], { highway: 'residential' }),
        way(13, [6, 3], { highway: 'residential' }),
      ],
      { strictUnknown: true },
    );
    expect(() => planOnGraph(g, A, B, opts)).toThrow(RoutingError);
  });
});

describe('instructions and tracking', () => {
  const g = buildGraph(
    [
      way(10, [1, 2, 3], { highway: 'primary', maxspeed: '70', name: 'Fast Rd' }),
      way(11, [1, 4], { highway: 'residential', maxspeed: '30', name: 'West St' }),
      way(12, [4, 5, 6], { highway: 'residential', maxspeed: '40', name: 'South St' }),
      way(13, [6, 3], { highway: 'residential', maxspeed: '30', name: 'East St' }),
    ],
    { strictUnknown: true },
  );
  const route = planOnGraph(g, A, B, opts);
  const instr = buildInstructions(route);

  it('produces depart, two turns and arrive', () => {
    expect(instr.map((i) => i.type)).toEqual(['depart', 'left', 'left', 'arrive']);
    expect(instr[0].street.name).toBe('West St');
    expect(instr[1].street.name).toBe('South St');
    expect(instr[2].street.name).toBe('East St');
  });

  it('announces upcoming turns once and detects arrival', () => {
    const tracker = new NavigationTracker(route, instr);
    const kinds: string[] = [];
    // Ride along the route in 10 m steps.
    const pts = route.points;
    for (let d = 0; d <= route.distance; d += 10) {
      let i = 0;
      while (i + 1 < pts.length && pts[i + 1].dist < d) i++;
      const a = pts[i];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      const t = b.dist === a.dist ? 0 : (d - a.dist) / (b.dist - a.dist);
      const fix = {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
        speed: 5,
      };
      const { announcements, state } = tracker.update(fix);
      expect(state.offRoute).toBe(false);
      kinds.push(...announcements.map((x) => x.kind));
    }
    const final = tracker.update({ latitude: B.latitude, longitude: B.longitude, speed: 5 });
    kinds.push(...final.announcements.map((x) => x.kind));
    expect(kinds).toEqual(['prepare', 'now', 'prepare', 'now', 'arrived']);
  });

  it('flags off-route after consecutive far fixes', () => {
    const tracker = new NavigationTracker(route, instr);
    const far = { latitude: A.latitude + 0.002, longitude: A.longitude + 0.005 };
    expect(tracker.update(far).state.offRoute).toBe(false);
    expect(tracker.update(far).state.offRoute).toBe(false);
    expect(tracker.update(far).state.offRoute).toBe(true);
  });
});
