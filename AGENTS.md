This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project: Scoot2

Voice-guided navigation for e-scooters and e-bikes. Routes are planned on the phone over OpenStreetMap data and may only use ways these vehicles can legally ride. README.md has the full file map; pipeline/README.md covers the road-tile pipeline.

### Language

Hebrew is the default; English is the other option (`settings.language`, one setting for screens and voice). Screen text lives in `src/i18n/strings.ts` (`useStrings()` gives `t` for text and `dir` for right-to-left rows and text alignment); spoken phrases live in `src/i18n/phrases.ts`. Add every new UI string in both languages, and apply `dir.row` / `dir.text` to new rows and text blocks. The app mirrors its own layout instead of forcing native RTL (`I18nManager`), so switching language needs no restart. Turn arrows are never mirrored.

### Riding rules (the core requirement)

1. Roads only when the speed limit is 50 km/h or less.
2. Sidewalks only beside roads above 50 km/h.
3. Sidewalks with a marked bike/scooter lane are always allowed.

They are implemented in `src/routing/rules.ts` (`classifyWay`), with speed parsing in `src/routing/speed.ts`. Change rules only there, and keep `src/routing/__tests__/rules.test.ts` in step. The tile pipeline imports the same code, so a rule change also changes which ways the next tile build keeps (`mayEverBeRidden`).

### Secrets and environment variables

- `.env` and `.env.*` are git-ignored; only `.env.example` is committed. The repository is public.
- Anything prefixed `EXPO_PUBLIC_` is built into the app in plain text, and other `.env` variables never reach app code. **The app cannot hold secrets.** A key the app needs (e.g. a paid geocoder) belongs on a server, such as a Cloudflare Worker that adds the key, never in the app.
- EAS cloud builds skip git-ignored files, so they don't see `.env`. Public config the app needs therefore has a default in code. Example: `DEFAULT_TILES_URL` in `src/services/roadData.ts`, which `EXPO_PUBLIC_TILES_URL` can override.
- CI secrets live in GitHub Actions secrets: `CLOUDFLARE_API_TOKEN` (Pages Write) and `CLOUDFLARE_ACCOUNT_ID`.

### Infrastructure: free and low-maintenance

The owner wants no paid infrastructure until the app earns money. Prefer static hosting, on-device computation and scheduled GitHub Actions over servers and paid APIs.

- **Road data:** tiles built weekly by `.github/workflows/road-tiles.yml` from a Geofabrik extract and deployed to Cloudflare Pages (`https://scoot2-tiles.pages.dev`, project `scoot2-tiles`). The app caches tiles on the device and falls back to live Overpass outside the covered region (Israel).
- **Search:** Photon as you type (debounced; public server, fair use). Dropped pins are named by Photon in the app language; the phone's geocoder (device language only) is the fallback. Nominatim is only a fallback for submitted searches: its policy allows 1 request/s for the whole app and bans search-as-you-type.
- **Map:** MapLibre with OpenFreeMap tiles (no key). The attribution button must stay on.

### Building and running

- Expo Go can't run this app (MapLibre, background location). Use a development build: `npx expo run:ios` (needs CocoaPods) or `npx expo run:android`.
- Android test APKs: `.github/workflows/android-apk.yml` runs `expo prebuild` and Gradle on every push to `main` (no EAS, no secrets) and replaces the `android-latest` GitHub pre-release. It is signed with the template's public debug key: testing only.
- `plugins/withSceneLifecycle.js` adopts the UIScene life cycle that the iOS 27 SDK requires at launch; Expo SDK 57's template doesn't yet. Remove it after upgrading to SDK 58.
- Guidance while the phone is locked uses a background location task (`src/navigation/backgroundLocation.ts`, registered from `src/app/_layout.tsx`) and needs "Always" location permission.
- Checks before declaring work done: `npm test` (vitest), `npx tsc --noEmit`, `npx expo lint`. The `pipeline/` folder has its own `package.json` and tsconfig: `cd pipeline && npx tsc -p .`.
- `.npmrc` sets `legacy-peer-deps=true` because the Expo template's peer dependencies conflict, so npm doesn't install peer dependencies automatically. That's why `vite` is listed explicitly for vitest.

### Licensing

Code is Apache-2.0 (`LICENSE`, `NOTICE`). OpenStreetMap data and the published tiles are ODbL: keep the "© OpenStreetMap contributors" attribution in the app and docs. Check that new dependencies are permissively licensed (MIT/BSD/Apache-style), and avoid GPL, which conflicts with App Store distribution.
