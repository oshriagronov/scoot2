import type { LatLng } from '../routing/geo';

export interface Place {
  id: string;
  title: string;
  subtitle: string;
  location: LatLng;
}

export const USER_AGENT = 'Scoot2/1.0 (e-scooter navigation app)';

/** Drops repeats that look the same to the user (same title and subtitle). */
export function uniquePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.title}|${p.subtitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
