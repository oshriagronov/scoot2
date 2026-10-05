/**
 * Which OpenStreetMap data the router needs. Shared by the live Overpass
 * download and the offline tile pipeline so both produce the same graph.
 */

/** Highway values that can carry a rider, or that the rules need to see (e.g. fast roads). */
export const ROUTABLE_HIGHWAYS = [
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
  'cycleway',
  'footway',
  'path',
  'pedestrian',
  'crossing',
];

/** Service roads that are never useful for getting anywhere. */
export const EXCLUDED_SERVICE = ['parking_aisle', 'drive-through'];

const HIGHWAY_SET = new Set(ROUTABLE_HIGHWAYS);
const EXCLUDED_SERVICE_SET = new Set(EXCLUDED_SERVICE);

export function isRoutableWay(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false;
  return (
    HIGHWAY_SET.has(tags.highway) &&
    tags.area !== 'yes' &&
    !EXCLUDED_SERVICE_SET.has(tags.service)
  );
}

/** Every tag the routing rules and instructions read. Others are dropped from tiles to save space. */
export const ROUTING_TAG_KEYS = new Set([
  'highway',
  'area',
  'junction',
  'name',
  'name:en',
  'name:he',
  'ref',
  'maxspeed',
  'maxspeed:forward',
  'maxspeed:backward',
  'maxspeed:type',
  'source:maxspeed',
  'zone:maxspeed',
  'oneway',
  'oneway:bicycle',
  'cycleway',
  'cycleway:both',
  'cycleway:left',
  'cycleway:right',
  'sidewalk',
  'sidewalk:both',
  'sidewalk:left',
  'sidewalk:right',
  'sidewalk:bicycle',
  'sidewalk:both:bicycle',
  'sidewalk:left:bicycle',
  'sidewalk:right:bicycle',
  'footway',
  'path',
  'bicycle',
  'electric_scooter',
  'vehicle',
  'access',
  'segregated',
]);

export function pickRoutingTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in tags) if (ROUTING_TAG_KEYS.has(k)) out[k] = tags[k];
  return out;
}
