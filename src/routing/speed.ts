const KMH_PER_MPH = 1.609344;

/** Implicit limits written as zone codes, e.g. "IL:urban", "DE:zone30", "GB:nsl_single". */
const ZONE_SPEEDS: Record<string, number> = {
  urban: 50,
  rural: 80,
  motorway: 110,
  trunk: 90,
  living_street: 20,
  bicycle_road: 30,
  walk: 7,
  nsl_single: 96,
  nsl_dual: 112,
};

function parseSingle(raw: string): number | null {
  const v = raw.trim().toLowerCase();
  if (v === '') return null;
  if (v === 'walk') return ZONE_SPEEDS.walk;
  if (v === 'none') return 130;
  const numeric = v.match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/);
  if (numeric) {
    const n = parseFloat(numeric[1]);
    return numeric[2] === 'mph' ? n * KMH_PER_MPH : n;
  }
  const zone = v.match(/^[a-z]{2}:(.+)$/);
  if (zone) {
    const kind = zone[1];
    const zoneNum = kind.match(/^zone:?(\d+)$/);
    if (zoneNum) return parseFloat(zoneNum[1]);
    if (kind in ZONE_SPEEDS) return ZONE_SPEEDS[kind];
  }
  return null;
}

/**
 * Parses an OSM maxspeed-like value into km/h. Values with several parts
 * (e.g. "50;70" or conditional variants) resolve to the highest one, so an
 * uncertain road is never treated as slower than it may be.
 */
export function parseMaxspeed(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw.split(/[;|]/).map(parseSingle).filter((n): n is number => n !== null);
  return parts.length ? Math.max(...parts) : null;
}

/** Fallback limits by road class, used when a road has no speed tags. */
const DEFAULT_SPEEDS: Record<string, number> = {
  trunk: 90,
  trunk_link: 70,
  primary: 50,
  primary_link: 50,
  secondary: 50,
  secondary_link: 50,
  tertiary: 50,
  tertiary_link: 50,
  unclassified: 50,
  residential: 50,
  road: 50,
  living_street: 20,
  service: 30,
  track: 30,
};

/** Road classes assumed to be above 50 km/h in strict mode when they have no speed tags. */
const STRICT_FAST_CLASSES = new Set(['primary', 'primary_link']);
const STRICT_FAST_SPEED = 60;

export interface SpeedInfo {
  /** Speed limit in km/h. */
  limit: number;
  /** True when no tag gave the limit and it was assumed from the road class. */
  inferred: boolean;
}

export function roadSpeed(
  tags: Record<string, string>,
  strictUnknown: boolean,
): SpeedInfo {
  const direct = [tags.maxspeed, tags['maxspeed:forward'], tags['maxspeed:backward']]
    .map(parseMaxspeed)
    .filter((n): n is number => n !== null);
  if (direct.length) return { limit: Math.max(...direct), inferred: false };

  const implicit =
    parseMaxspeed(tags['maxspeed:type']) ??
    parseMaxspeed(tags['source:maxspeed']) ??
    parseMaxspeed(tags['zone:maxspeed']);
  if (implicit !== null) return { limit: implicit, inferred: false };

  const hw = tags.highway;
  if (strictUnknown && STRICT_FAST_CLASSES.has(hw)) {
    return { limit: STRICT_FAST_SPEED, inferred: true };
  }
  return { limit: DEFAULT_SPEEDS[hw] ?? 50, inferred: true };
}
