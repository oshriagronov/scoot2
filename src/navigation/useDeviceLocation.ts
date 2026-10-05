import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { Fix } from './tracker';

export interface DeviceFix extends Fix {
  /** Direction of travel in degrees, if known. */
  heading?: number | null;
  timestamp: number;
}

export type PermissionState = 'unknown' | 'granted' | 'denied';

/**
 * Watches the device position. `precise` switches to navigation-grade
 * accuracy with frequent updates; otherwise updates are coarse to save battery.
 */
export function useDeviceLocation(enabled: boolean, precise: boolean) {
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unknown');

  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then((r) => setPermission(r.granted ? 'granted' : 'denied'))
      .catch(() => setPermission('denied'));
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || !enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    Location.watchPositionAsync(
      {
        accuracy: precise ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
        distanceInterval: precise ? 2 : 10,
        timeInterval: precise ? 1000 : 5000,
      },
      (l) =>
        setFix({
          latitude: l.coords.latitude,
          longitude: l.coords.longitude,
          accuracy: l.coords.accuracy,
          speed: l.coords.speed,
          heading: l.coords.heading != null && l.coords.heading >= 0 ? l.coords.heading : null,
          timestamp: l.timestamp,
        }),
    )
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [permission, enabled, precise]);

  return { fix, permission };
}
