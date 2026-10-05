import * as Location from 'expo-location';
import type { LatLng } from '../routing/geo';
import { nominatimSearch } from './nominatim';
import { photonReverse, photonSearch } from './photon';
import type { Place } from './place';

export type { Place } from './place';

/** Recent search results, so retyping or correcting a query costs no request. */
const cache = new Map<string, Place[]>();
const CACHE_SIZE = 50;

/**
 * Finds places for a query. Photon serves typing and submitted searches; if it
 * is down, submitted searches fall back to Nominatim (which forbids typing-time use).
 */
export async function searchPlaces(
  query: string,
  near: LatLng | null,
  language: string,
  mode: 'typing' | 'submit',
  signal?: AbortSignal,
): Promise<Place[]> {
  // Round the bias point so nearby positions share cache entries.
  const nearKey = near ? `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}` : '';
  const key = `${language}|${nearKey}|${query.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let places: Place[];
  try {
    places = await photonSearch(query, near, language, signal);
  } catch (err) {
    if (signal?.aborted || mode === 'typing') throw err;
    places = await nominatimSearch(query, near, language, signal);
  }

  cache.set(key, places);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return places;
}

/** Name of the place at a coordinate, for labelling a dropped pin. Uses the phone's own geocoder first. */
export async function reverseGeocode(
  p: LatLng,
  language: string,
  signal?: AbortSignal,
): Promise<Place | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync(p);
    if (a) {
      const streetLine = [a.street, a.streetNumber].filter(Boolean).join(' ');
      const title = a.name || streetLine;
      if (title) {
        const subtitle = [a.name !== streetLine ? streetLine : null, a.district, a.city]
          .filter((v): v is string => !!v && v !== title)
          .join(', ');
        return { id: `pin-${p.latitude},${p.longitude}`, title, subtitle, location: p };
      }
    }
  } catch {
    // Not available (e.g. no Play services) or throttled: use Photon instead.
  }
  if (signal?.aborted) return null;
  return photonReverse(p, language, signal).catch(() => null);
}
