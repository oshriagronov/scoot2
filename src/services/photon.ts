import type { LatLng } from '../routing/geo';
import { uniquePlaces, USER_AGENT, type Place } from './place';

/**
 * Photon (photon.komoot.io): free OpenStreetMap search built for
 * search-as-you-type. The public server asks for fair use, so callers debounce.
 */
const PHOTON = 'https://photon.komoot.io';

/** Languages Photon can translate results into; anything else gets local names. */
const SUPPORTED_LANGS = new Set(['en', 'de', 'fr']);

export interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    country?: string;
  };
}

export function photonToPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const streetLine = [p.street, p.housenumber].filter(Boolean).join(' ');
  const title = p.name || streetLine || p.city || p.district || 'Unnamed place';
  const parts = [p.name ? streetLine : undefined, p.district ?? p.locality, p.city, p.country];
  const subtitle = [...new Set(parts.filter((v): v is string => !!v && v !== title))].join(', ');
  const [lon, lat] = f.geometry.coordinates;
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? `${lat},${lon}`}`,
    title,
    subtitle,
    location: { latitude: lat, longitude: lon },
  };
}

async function request(path: string, params: URLSearchParams, signal?: AbortSignal) {
  const res = await fetch(`${PHOTON}${path}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`Photon returned ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map(photonToPlace);
}

export async function photonSearch(
  query: string,
  near: LatLng | null,
  language: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lang: SUPPORTED_LANGS.has(language) ? language : 'default',
  });
  if (near) {
    params.set('lat', String(near.latitude));
    params.set('lon', String(near.longitude));
  }
  return uniquePlaces(await request('/api/', params, signal));
}

export async function photonReverse(p: LatLng, language: string, signal?: AbortSignal) {
  const params = new URLSearchParams({
    lat: String(p.latitude),
    lon: String(p.longitude),
    limit: '1',
    lang: SUPPORTED_LANGS.has(language) ? language : 'default',
  });
  const [place] = await request('/reverse', params, signal);
  return place ? { ...place, location: p } : null;
}
