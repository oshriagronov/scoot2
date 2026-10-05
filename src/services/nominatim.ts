import type { LatLng } from '../routing/geo';
import { uniquePlaces, USER_AGENT, type Place } from './place';

/**
 * Nominatim: OpenStreetMap's reference geocoder. Its public server allows about
 * one request per second for the whole app and forbids search-as-you-type, so
 * it is only a fallback for searches the rider explicitly submits.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

function toPlace(r: NominatimResult): Place {
  const parts = r.display_name.split(', ');
  const title = r.name || parts[0];
  return {
    id: String(r.place_id),
    title,
    subtitle: parts.filter((p) => p !== title).slice(0, 3).join(', '),
    location: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
  };
}

export async function nominatimSearch(
  query: string,
  near: LatLng | null,
  language: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '8',
    'accept-language': language,
  });
  if (near) {
    // ~30 km box around the rider; results outside are allowed but ranked lower.
    const d = 0.3;
    params.set(
      'viewbox',
      [near.longitude - d, near.latitude + d, near.longitude + d, near.latitude - d].join(','),
    );
  }
  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return uniquePlaces(((await res.json()) as NominatimResult[]).map(toPlace));
}
