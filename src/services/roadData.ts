import type { WayFetcher } from '../routing/router';
import { fetchWays as fetchFromOverpass } from './overpass';
import { TileSource } from './roadTiles';
import { fileTileStorage } from './tileStorage';

/**
 * Base URL of the published road tiles (see pipeline/README.md), e.g.
 * https://<user>.github.io/<repo>. Set in .env; when unset, only live data is used.
 */
const TILES_URL = process.env.EXPO_PUBLIC_TILES_URL;

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
