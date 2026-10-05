# Road tiles

The app routes on pre-built **road tiles**: small JSON files cut from OpenStreetMap data on a
grid of 0.025° squares (about 2.8 km). They are published as a static website, so serving them
costs nothing and needs no server. A GitHub Action rebuilds them every Monday from a fresh
[Geofabrik](https://download.geofabrik.de/) extract.

When a route is planned, the app downloads only the tiles it needs (typically 0.3–1 MB for a
city trip) and keeps them on the phone, so repeat trips in the same area work offline. Outside
the covered region, or if the tiles can't be reached and nothing is cached, it falls back to live
Overpass downloads.

## What's in a tile

- Every road (needed even when too fast to ride, to decide whether its sidewalk can be used)
- Sidewalks, crossings, cycleways and paths that the riding rules could allow
- Only the tags the rules read (`src/routing/osmData.ts`)

Plain footways that no rule can ever allow are left out (`mayEverBeRidden` in
`src/routing/rules.ts`). If you change the rules, the next build picks that up; pushing a
change to the rules or the pipeline also triggers a rebuild.

## Build locally

```bash
cd pipeline
npm install
curl -fLO https://download.geofabrik.de/asia/israel-and-palestine-latest.osm.pbf
npx tsx build-tiles.ts --input israel-and-palestine-latest.osm.pbf --out ../site
```

For Israel this takes about 30 seconds and 1.5 GB of memory, and produces about 4,600 tiles
(104 MB, 38 MB gzipped; the largest tile is 127 KB gzipped).

To try them in the app, serve the folder and point the app at it:

```bash
python3 -m http.server 8099 --directory site
```

```bash
echo "EXPO_PUBLIC_TILES_URL=http://localhost:8099" > .env.local
```

Restart `npx expo start` after changing `.env` files.

## Publish (pick one)

### GitHub Pages: public repository

1. Push the project to a public GitHub repository.
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Actions**, run **Road tiles** once (later runs happen weekly).
4. Put the site address in `.env`:
   `EXPO_PUBLIC_TILES_URL=https://<user>.github.io/<repo>`

GitHub Pages has a soft limit of 100 GB of traffic a month, and its terms don't allow it to be
the backbone of a commercial service. Move to Cloudflare when the app starts earning.

### Cloudflare Pages: private or public repository

Free, with no traffic limit, and commercial use is allowed.

1. Create a free Cloudflare account. No card is needed.
2. Create a Pages project for direct upload, e.g. `npx wrangler pages project create scoot2-tiles`.
3. Create an API token with the **Cloudflare Pages: Edit** permission.
4. In the GitHub repository settings:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables: `TILES_HOST=cloudflare`, `CLOUDFLARE_PAGES_PROJECT=scoot2-tiles`
5. Run **Road tiles** in **Actions** once.
6. Put the site address in `.env`: `EXPO_PUBLIC_TILES_URL=https://scoot2-tiles.pages.dev`

## Adding regions

Change `EXTRACT_URL` in `.github/workflows/road-tiles.yml` to a larger Geofabrik extract that
contains the countries you want. Building from several separate extracts would need a small
change to `build-tiles.ts` so their manifests are combined. Cloudflare Pages allows 20,000 files
per site, enough for a few countries; beyond that, use Cloudflare R2.

## Data and licence

Tiles contain OpenStreetMap data © OpenStreetMap contributors, available under the
[ODbL](https://www.openstreetmap.org/copyright). The app shows this attribution on the map.
