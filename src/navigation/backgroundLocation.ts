import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useState } from 'react';
import { locationToFix, type DeviceFix } from './useDeviceLocation';

/**
 * Location updates that keep arriving while the phone is locked or another app
 * is open, so guidance continues during a ride. The task runs in the app's own
 * JavaScript runtime and hands fixes to the navigation session through listeners.
 */
const TASK = 'scoot2-navigation-location';

type Listener = (fix: DeviceFix) => void;
const listeners = new Set<Listener>();

// Must be defined at module load, before React mounts (imported from the root layout).
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  if (listeners.size === 0) {
    // The OS relaunched the app for this task but no ride is in progress: stop draining battery.
    await Location.stopLocationUpdatesAsync(TASK).catch(() => {});
    return;
  }
  for (const l of data.locations) {
    const fix = locationToFix(l);
    listeners.forEach((fn) => fn(fix));
  }
});

async function stop() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TASK).catch(() => {});
  }
}

/** 'background': guidance continues when locked. 'foreground': only while the app is on screen. */
export type GuidanceMode = 'starting' | 'background' | 'foreground';

/**
 * Starts background location updates while `active`, asking for the "Always"
 * permission the first time. Falls back to `foreground` if it is refused.
 */
/** Text for the Android "guiding you" notification, in the app language. */
export interface GuidanceNotice {
  title: string;
  body: string;
}

export function useBackgroundLocation(active: boolean, notice: GuidanceNotice) {
  const { title, body } = notice;
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [mode, setMode] = useState<GuidanceMode>('starting');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const listener: Listener = (f) => setFix(f);
    listeners.add(listener);

    (async () => {
      const permission = await Location.requestBackgroundPermissionsAsync().catch(() => null);
      if (cancelled) return;
      if (!permission?.granted) {
        setMode('foreground');
        return;
      }
      try {
        await Location.startLocationUpdatesAsync(TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 2,
          timeInterval: 1000,
          activityType: Location.ActivityType.OtherNavigation,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: title,
            notificationBody: body,
            notificationColor: '#0f766e',
            killServiceOnDestroy: true,
          },
        });
        if (!cancelled) setMode('background');
      } catch {
        if (!cancelled) setMode('foreground');
      }
    })();

    return () => {
      cancelled = true;
      listeners.delete(listener);
      setMode('starting');
      setFix(null);
      void stop();
    };
  }, [active, title, body]);

  return { fix: active ? fix : null, mode: active ? mode : 'starting' };
}

/** Stops updates left running by a previous session (e.g. the app was killed mid-ride). */
export function stopStaleBackgroundLocation() {
  if (listeners.size === 0) void stop();
}
