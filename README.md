# Scoot2

Voice-guided navigation for electric scooters and e-bikes. It only routes where these vehicles are allowed:

1. **Roads** only when the speed limit is **50 km/h or less**.
2. **Sidewalks** only beside roads whose limit is **above 50 km/h**.
3. **Sidewalks with a marked lane** for bikes/scooters are always allowed.

Motorways, steps, and anything tagged as closed to bikes are never used.

Built with Expo (SDK 57) and React Native. Maps use react-native-maps (Apple Maps on iOS, Google Maps on Android). The route is computed on the phone, from OpenStreetMap road data:

- **Road tiles** (preferred): pre-built files rebuilt weekly by a GitHub Action and served from free static hosting. Only the tiles a route needs are downloaded, and they stay on the phone for offline use. See [pipeline/README.md](pipeline/README.md).
- **Overpass** (fallback): a live download, used outside the tile region or when no tiles are configured.

Place search uses [Photon](https://photon.komoot.io) as you type. Dropped pins are named by the phone's own geocoder. Nominatim is a fallback for searches submitted with Enter.

## Run it

```bash
npm install
cp .env.example .env   # then set EXPO_PUBLIC_TILES_URL, or delete the line to use live data only
npx expo start
```

Open the app in Expo Go, or in a development build (`npx expo run:ios` / `npx expo run:android`).

To preview the voice guidance without riding, turn on **Settings → Simulate ride**, choose a destination and press **Start**.

```bash
npm test            # routing, rules, instructions, tracking, tiles and search tests
npm run typecheck
npx expo lint
```

## How it works

| Piece | File |
| --- | --- |
| Riding rules (which ways are legal, and how) | `src/routing/rules.ts` |
| Speed limit parsing and defaults for untagged roads | `src/routing/speed.ts` |
| Route preference (safest / fastest) and timing | `src/routing/cost.ts` |
| Road graph, and matching separately mapped sidewalks to the road beside them | `src/routing/graph.ts` |
| A* search, route assembly, data caching for re-routes | `src/routing/astar.ts`, `src/routing/router.ts` |
| Which OSM ways and tags routing needs | `src/routing/osmData.ts` |
| Tile format, and building tiles from an OSM extract | `src/routing/tiles.ts`, `pipeline/build-tiles.ts` |
| Tile download, on-device cache, Overpass fallback | `src/services/roadTiles.ts`, `src/services/roadData.ts` |
| Live map data download (Overpass) | `src/services/overpass.ts` |
| Place search (Photon, Nominatim) and pin naming | `src/services/geocode.ts`, `src/services/photon.ts` |
| Turn-by-turn instructions, including roundabouts | `src/navigation/instructions.ts` |
| Live progress, voice timing, off-route detection | `src/navigation/tracker.ts` |
| Spoken phrases (English and Hebrew) | `src/i18n/phrases.ts` |
| Screens | `src/app/index.tsx` (map), `src/app/settings.tsx` |

On a road above 50 km/h, the app finds the sidewalk in one of two ways:

- **Drawn on the road** (for example `sidewalk=both`): the app rides that road's sidewalk.
- **Mapped as a separate footway** (`footway=sidewalk`): the app looks for the closest parallel road within 30 m. It uses the sidewalk only if that road is above 50 km/h.

Unnamed bike lanes and sidewalks take their name from the road beside them, so the voice says "the bike lane along Ibn Gabirol".

**Strict speed limits** (on by default) treats primary roads with no speed tag as above 50 km/h. The route summary warns when part of the route uses an assumed speed limit.

## Before production

- **Publish the road tiles.** Set up the GitHub Action (see [pipeline/README.md](pipeline/README.md)) and put its address in `.env`. Until then every route waits on the public Overpass servers.
- **Search.** Photon's public server asks for fair use and has no uptime guarantee. If traffic grows, self-host Photon or use a paid geocoder.
- **Android maps.** Release builds need a Google Maps API key, set in the `react-native-maps` config plugin.
- **Screen-off guidance.** The screen stays awake while navigating. Guidance with the screen off needs background location and audio modes.

Map data © OpenStreetMap contributors, ODbL.
