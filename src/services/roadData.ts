import type { WayFetcher } from '../routing/router';
import { fetchWays as fetchFromOverpass } from './overpass';
import { TileSource } from './roadTiles';
import { fileTileStorage } from './tileStorage';

/** Where .github/workflows/road-tiles.yml publishes the tiles (see pipeline/README.md). */
const DEFAULT_TILES_URL = 'https://scoot2-tiles.pages.dev';

/**
 * Base URL of the road tiles. It is public, so it has a built-in default: builds
 * that don't see .env (it is git-ignored, so EAS cloud builds skip it) still use
 * the tiles. EXPO_PUBLIC_TILES_URL overrides it; set it empty to use live data only.
 */
const TILES_URL = process.env.EXPO_PUBLIC_TILES_URL ?? DEFAULT_TILES_URL;

/**
 * Road data for routing: pre-built tiles when the area is covered, otherwise
 * (or if the tile server is unreachable with nothing cached) a live Overpass download.
 */
export function createRoadDataFetcher(): WayFetcher {
  const tiles = TILES_URL ? new TileSource(TILES_URL, fileTileStorage()) : null;
  return async (bbox, signal) => {
    if (tiles) {
      try {
        return await tiles.fetchWays(bbox, signal);
      } catch (err) {
        if (signal?.aborted) throw err;
      }
    }
    return fetchFromOverpass(bbox, signal);
  };
}
