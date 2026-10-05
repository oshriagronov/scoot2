import { useEffect, useRef, useState } from 'react';
import { bearing } from '../routing/geo';
import type { Route } from '../routing/router';
import type { DeviceFix } from './useDeviceLocation';

const TICK_MS = 1000;

/** Position at `d` meters along the route, with the direction of travel. */
export function pointAlong(route: Route, d: number): DeviceFix {
  const pts = route.points;
  let i = 0;
  while (i + 2 < pts.length && pts[i + 1].dist < d) i++;
  const a = pts[i];
  const b = pts[i + 1] ?? a;
  const span = b.dist - a.dist;
  const t = span > 0 ? Math.min(1, Math.max(0, (d - a.dist) / span)) : 0;
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    heading: bearing(a.latitude, a.longitude, b.latitude, b.longitude),
    accuracy: 5,
    speed: 0,
    timestamp: Date.now(),
  };
}

/**
 * Rides the route at `speedKmh` and reports positions like a GPS would.
 * Useful in a simulator and for previewing voice guidance. Restarts when the route changes.
 */
export function useSimulatedRide(route: Route | null, active: boolean, speedKmh: number) {
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const along = useRef(0);

  useEffect(() => {
    along.current = 0;
  }, [route]);

  useEffect(() => {
    if (!route || !active) return;
    const mps = speedKmh / 3.6;
    const tick = () => {
      const p = pointAlong(route, along.current);
      setFix({ ...p, speed: mps });
      along.current = Math.min(route.distance, along.current + mps * (TICK_MS / 1000));
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [route, active, speedKmh]);

  return active ? fix : null;
}
