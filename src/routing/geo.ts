export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in meters. */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function distanceLL(a: LatLng, b: LatLng): number {
  return distance(a.latitude, a.longitude, b.latitude, b.longitude);
}

/** Initial bearing in degrees [0, 360). */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Signed smallest difference b - a in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (((b - a) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export interface Projection {
  /** Fraction along the segment, clamped to [0, 1]. */
  t: number;
  /** Distance in meters from the point to the segment. */
  distance: number;
  lat: number;
  lon: number;
}

/**
 * Projects a point onto segment AB using a local equirectangular approximation,
 * which is accurate to well under a meter at the segment lengths found in road data.
 */
export function projectOnSegment(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): Projection {
  const kx = Math.cos(toRad(pLat)) * 111320;
  const ky = 110540;
  const ax = (aLon - pLon) * kx;
  const ay = (aLat - pLat) * ky;
  const bx = (bLon - pLon) * kx;
  const by = (bLat - pLat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return {
    t,
    distance: Math.sqrt(cx * cx + cy * cy),
    lat: aLat + t * (bLat - aLat),
    lon: aLon + t * (bLon - aLon),
  };
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Bounding box around the given points, padded by `padMeters` on every side. */
export function paddedBBox(points: LatLng[], padMeters: number): BBox {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
  }
  const dLat = padMeters / 110540;
  const dLon = padMeters / (111320 * Math.cos(toRad((south + north) / 2)));
  return { south: south - dLat, west: west - dLon, north: north + dLat, east: east + dLon };
}

export function bboxContains(box: BBox, p: LatLng, marginMeters = 0): boolean {
  const dLat = marginMeters / 110540;
  const dLon = marginMeters / (111320 * Math.cos(toRad(p.latitude)));
  return (
    p.latitude >= box.south + dLat &&
    p.latitude <= box.north - dLat &&
    p.longitude >= box.west + dLon &&
    p.longitude <= box.east - dLon
  );
}
