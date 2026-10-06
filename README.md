# Scoot2

Voice-guided navigation for electric scooters and e-bikes. It only routes where these vehicles are allowed:

1. **Roads** only when the speed limit is **50 km/h or less**.
2. **Sidewalks** only beside roads whose limit is **above 50 km/h**.
3. **Sidewalks with a marked lane** for bikes/scooters are always allowed.

Motorways, steps, and anything tagged as closed to bikes are never used.

Built with Expo (SDK 57) and React Native. The map is [MapLibre](https://maplibre.org) with free OpenStreetMap map tiles from [OpenFreeMap](https://openfreemap.org): no account, no API key, the same map on iPhone and Android. The route is computed on the phone, from OpenStreetMap road data:

- **Road tiles** (preferred): pre-built files rebuilt weekly by a GitHub Action and served from Cloudflare Pages for free. Only the tiles a route needs are downloaded, and they stay on the phone for offline use. See [pipeline/README.md](pipeline/README.md).
- **Overpass** (fallback): a live download, used outside the tile region or when no tiles are configured.

Place search uses [Photon](https://photon.komoot.io) as you type. Dropped pins are named by the phone's own geocoder. Nominatim is a fallback for searches submitted with Enter.

## Run it

```bash
npm install
cp .env.example .env   # then set EXPO_PUBLIC_TILES_URL, or delete the line to use live data only
npx expo start
```

The app uses native modules that Expo Go doesn't include (MapLibre, background location), so run it as a development build:

```bash
npx expo run:ios       # needs Xcode and CocoaPods (brew install cocoapods)
npx expo run:android   # needs Android Studio
```

After the first build, `npx expo start` is enough until native dependencies or `app.json` change.

**Guidance with the phone locked:** when you press Start, the app asks for location access "Always". With it, location updates and voice prompts continue with the screen locked or another app open. iPhone shows the blue location pill; Android shows a "Scoot2 is guiding you" notification. Without it, guidance works only while the app is on screen, and the ride screen says so.

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
| Map (MapLibre + OpenFreeMap), route drawing, camera | `src/components/RouteMap.tsx` |
| Location while locked (background task), voice audio session | `src/navigation/backgroundLocation.ts`, `src/navigation/voice.ts` |
| Screens | `src/app/index.tsx` (map), `src/app/settings.tsx` |

On a road above 50 km/h, the app finds the sidewalk in one of two ways:

- **Drawn on the road** (for example `sidewalk=both`): the app rides that road's sidewalk.
- **Mapped as a separate footway** (`footway=sidewalk`): the app looks for the closest parallel road within 30 m. It uses the sidewalk only if that road is above 50 km/h.

Unnamed bike lanes and sidewalks take their name from the road beside them, so the voice says "the bike lane along Ibn Gabirol".

**Strict speed limits** (on by default) treats primary roads with no speed tag as above 50 km/h. The route summary warns when part of the route uses an assumed speed limit.

## Before production

- **Search.** Photon's public server asks for fair use and has no uptime guarantee. If traffic grows, self-host Photon or use a paid geocoder.
- **Map tiles.** OpenFreeMap is free and donation-funded, with no uptime guarantee. The style URL is one constant in `RouteMap.tsx`, so moving to self-hosted tiles later is a one-line change.
- **Store review.** Apple and Google both review "Always" location use. Explain in the listing that it is used only during navigation, to keep voice guidance running with the screen locked.

## License

The code is open source under the [Apache License 2.0](LICENSE). You can use, change and redistribute it, including in commercial apps, as long as you keep the licence and [NOTICE](NOTICE) file. Contributions are accepted under the same licence.

Apache 2.0 fits the rest of the stack: Expo, React Native and MapLibre React Native are MIT, MapLibre Native is BSD, and TypeScript is Apache 2.0. It adds an explicit patent grant, which protects contributors and users. Unlike GPL licences, it doesn't conflict with App Store distribution.

**Map data** isn't covered by the code licence. Road data and the published road tiles come from OpenStreetMap, © OpenStreetMap contributors, under the [ODbL](https://www.openstreetmap.org/copyright). Anything built from them must credit OpenStreetMap, and a changed version of the tile database must also be shared under the ODbL. The base map comes from [OpenFreeMap](https://openfreemap.org), and its attribution is shown on the map.
