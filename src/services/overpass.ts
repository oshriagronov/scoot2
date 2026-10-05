import type { BBox } from '../routing/geo';
import type { OsmWay } from '../routing/graph';
import { EXCLUDED_SERVICE, ROUTABLE_HIGHWAYS } from '../routing/osmData';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export function buildQuery(b: BBox): string {
  const box = `${b.south},${b.west},${b.north},${b.east}`;
  return (
    `[out:json][timeout:90];` +
    `way["highway"~"^(${ROUTABLE_HIGHWAYS.join('|')})$"]["area"!="yes"]` +
    `["service"!~"^(${EXCLUDED_SERVICE.join('|')})$"](${box});` +
    `out body geom qt;`
  );
}

const USER_AGENT = 'Scoot2/1.0 (e-scooter navigation app)';
const REQUEST_TIMEOUT_MS = 35000;
/** Give up on all mirrors after this long, so the rider is not left waiting. */
const TOTAL_BUDGET_MS = 90000;
/** Busy/rate-limited responses worth retrying after a pause. */
const RETRYABLE = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [0, 2000, 5000];

class HttpError extends Error {
  constructor(public status: number) {
    super(`Map data server returned ${status}`);
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (ms === 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('Aborted'));
    });
  });
}

async function post(url: string, body: string, signal?: AbortSignal): Promise<OsmWay[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new HttpError(res.status);
    const json = (await res.json()) as { elements: (OsmWay & { type: string })[] };
    return json.elements.filter((e) => e.type === 'way' && Array.isArray(e.geometry));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Downloads every way that could carry a rider inside the box. Public Overpass
 * servers are often busy, so each round tries every mirror, then waits and retries.
 */
export async function fetchWays(bbox: BBox, signal?: AbortSignal): Promise<OsmWay[]> {
  const body = 'data=' + encodeURIComponent(buildQuery(bbox));
  let lastError: unknown;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay, signal);
    for (const url of ENDPOINTS) {
      if (Date.now() > deadline) break;
      try {
        return await post(url, body, signal);
      } catch (err) {
        if (signal?.aborted) throw err;
        lastError = err;
        if (err instanceof HttpError && !RETRYABLE.has(err.status)) throw err;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not download map data');
}
