import { describe, expect, it } from 'vitest';
import { classifyWay, mayEverBeRidden } from '../rules';
import { parseMaxspeed, roadSpeed } from '../speed';

const ctx = { strictUnknown: true };

describe('parseMaxspeed', () => {
  it('parses plain, mph, zone and multi values', () => {
    expect(parseMaxspeed('50')).toBe(50);
    expect(parseMaxspeed('30 mph')).toBeCloseTo(48.28, 1);
    expect(parseMaxspeed('IL:urban')).toBe(50);
    expect(parseMaxspeed('IL:rural')).toBe(80);
    expect(parseMaxspeed('DE:zone30')).toBe(30);
    expect(parseMaxspeed('DE:zone:20')).toBe(20);
    expect(parseMaxspeed('50;70')).toBe(70);
    expect(parseMaxspeed('signals')).toBeNull();
    expect(parseMaxspeed(undefined)).toBeNull();
  });

  it('assumes untagged primary roads are fast only in strict mode', () => {
    expect(roadSpeed({ highway: 'primary' }, true)).toEqual({ limit: 60, inferred: true });
    expect(roadSpeed({ highway: 'primary' }, false)).toEqual({ limit: 50, inferred: true });
    expect(roadSpeed({ highway: 'primary', maxspeed: '40' }, true)).toEqual({ limit: 40, inferred: false });
  });
});

describe('rule 1: roads only when the limit is 50 or less', () => {
  it('allows a 50 km/h road', () => {
    expect(classifyWay({ highway: 'residential', maxspeed: '50' }, ctx)?.mode).toBe('road');
  });

  it('allows a 30 km/h road', () => {
    expect(classifyWay({ highway: 'residential', maxspeed: '30' }, ctx)?.mode).toBe('road');
  });

  it('rejects a 60 km/h road without a sidewalk', () => {
    expect(classifyWay({ highway: 'primary', maxspeed: '60' }, ctx)).toBeNull();
  });

  it('rejects a 70 km/h road even with a painted lane', () => {
    expect(classifyWay({ highway: 'primary', maxspeed: '70', cycleway: 'lane' }, ctx)).toBeNull();
  });

  it('never allows motorways', () => {
    expect(classifyWay({ highway: 'motorway', maxspeed: '30' }, ctx)).toBeNull();
  });

  it('marks painted lanes on slow roads', () => {
    expect(classifyWay({ highway: 'tertiary', maxspeed: '50', cycleway: 'lane' }, ctx)?.mode).toBe(
      'road_lane',
    );
  });

  it('respects oneway on roads but not when bikes are exempt', () => {
    expect(classifyWay({ highway: 'residential', oneway: 'yes' }, ctx)?.oneway).toBe(1);
    expect(
      classifyWay({ highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' }, ctx)?.oneway,
    ).toBe(0);
  });

  it('respects explicit bans', () => {
    expect(classifyWay({ highway: 'residential', bicycle: 'no' }, ctx)).toBeNull();
    expect(classifyWay({ highway: 'residential', access: 'private' }, ctx)).toBeNull();
  });
});

describe('rule 2: sidewalks beside roads above 50', () => {
  it('uses the attached sidewalk of a fast road', () => {
    const c = classifyWay({ highway: 'primary', maxspeed: '70', sidewalk: 'both' }, ctx);
    expect(c?.mode).toBe('sidewalk');
    expect(c?.oneway).toBe(0);
  });

  it('allows a separate sidewalk next to a fast road', () => {
    expect(
      classifyWay({ highway: 'footway', footway: 'sidewalk' }, { ...ctx, adjacentRoadSpeed: 70 })?.mode,
    ).toBe('sidewalk');
  });

  it('rejects a separate sidewalk next to a 50 road', () => {
    expect(
      classifyWay({ highway: 'footway', footway: 'sidewalk' }, { ...ctx, adjacentRoadSpeed: 50 }),
    ).toBeNull();
  });

  it('rejects a separate sidewalk with no known road', () => {
    expect(classifyWay({ highway: 'footway', footway: 'sidewalk' }, { ...ctx, adjacentRoadSpeed: null })).toBeNull();
  });

  it('does not use the sidewalk of a slow road; uses the road instead', () => {
    expect(classifyWay({ highway: 'residential', maxspeed: '50', sidewalk: 'both' }, ctx)?.mode).toBe('road');
  });
});

describe('rule 3: sidewalks with a lane for bikes/scooters', () => {
  it('allows a sidewalk with a designated bike lane next to a slow road', () => {
    expect(
      classifyWay(
        { highway: 'footway', footway: 'sidewalk', bicycle: 'designated' },
        { ...ctx, adjacentRoadSpeed: 30 },
      )?.mode,
    ).toBe('bike_lane');
  });

  it('allows a segregated shared sidewalk', () => {
    expect(
      classifyWay({ highway: 'footway', footway: 'sidewalk', bicycle: 'yes', segregated: 'yes' }, ctx)?.mode,
    ).toBe('bike_lane');
  });

  it('allows cycle tracks along any road, even fast ones', () => {
    expect(classifyWay({ highway: 'primary', maxspeed: '80', cycleway: 'track' }, ctx)?.mode).toBe('bike_lane');
    expect(
      classifyWay({ highway: 'primary', maxspeed: '80', 'sidewalk:right:bicycle': 'designated' }, ctx)?.mode,
    ).toBe('bike_lane');
  });

  it('allows cycleways', () => {
    expect(classifyWay({ highway: 'cycleway' }, ctx)?.mode).toBe('bike_lane');
  });

  it('rejects plain footways and pedestrian areas', () => {
    expect(classifyWay({ highway: 'footway' }, ctx)).toBeNull();
    expect(classifyWay({ highway: 'pedestrian' }, ctx)).toBeNull();
    expect(classifyWay({ highway: 'steps' }, ctx)).toBeNull();
  });

  it('allows crossings', () => {
    expect(classifyWay({ highway: 'footway', footway: 'crossing' }, ctx)?.mode).toBe('crossing');
  });
});

describe('mayEverBeRidden', () => {
  it('keeps all roads, sidewalks, crossings and bike paths, and drops plain footways', () => {
    expect(mayEverBeRidden({ highway: 'trunk', maxspeed: '90' })).toBe(true);
    expect(mayEverBeRidden({ highway: 'footway', footway: 'sidewalk' })).toBe(true);
    expect(mayEverBeRidden({ highway: 'footway', footway: 'crossing' })).toBe(true);
    expect(mayEverBeRidden({ highway: 'cycleway' })).toBe(true);
    expect(mayEverBeRidden({ highway: 'footway' })).toBe(false);
    expect(mayEverBeRidden({ highway: 'pedestrian' })).toBe(false);
    expect(mayEverBeRidden({ highway: 'footway', bicycle: 'yes' })).toBe(true);
  });
});
