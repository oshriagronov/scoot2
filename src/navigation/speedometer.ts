import { useEffect, useState } from 'react';
import { distanceLL } from '../routing/geo';
import type { DeviceFix } from './useDeviceLocation';

/** Below this the GPS speed is mostly noise from standing still. */
const STANDSTILL_MPS = 0.5;
/** Two fixes further apart than this are too old to measure speed between. */
const MAX_GAP_S = 10;
/**
 * Positions arrive only after the phone moves a couple of meters, so silence
 * for this long means the rider has stopped.
 */
const STOPPED_AFTER_MS = 4000;

/**
 * Speed in km/h at `fix`. Uses the GPS (Doppler) speed when the phone reports one,
 * otherwise the distance from the previous fix. Null when it can't be told.
 */
export function currentSpeed(fix: DeviceFix, previous: DeviceFix | null): number | null {
  let mps = fix.speed != null && fix.speed >= 0 ? fix.speed : null;
  if (mps == null && previous) {
    const dt = (fix.timestamp - previous.timestamp) / 1000;
    if (dt > 0 && dt <= MAX_GAP_S) mps = distanceLL(previous, fix) / dt;
  }
  if (mps == null) return null;
  return mps < STANDSTILL_MPS ? 0 : mps * 3.6;
}

/** Live riding speed in km/h from the location fixes, or null until it is known. */
export function useSpeedometer(fix: DeviceFix | null): number | null {
  const [fixes, setFixes] = useState<{ fix: DeviceFix | null; previous: DeviceFix | null }>({
    fix,
    previous: null,
  });
  if (fixes.fix !== fix) setFixes({ fix, previous: fixes.fix });

  const [stoppedAt, setStoppedAt] = useState<DeviceFix | null>(null);
  useEffect(() => {
    if (!fix) return;
    const id = setTimeout(() => setStoppedAt(fix), STOPPED_AFTER_MS);
    return () => clearTimeout(id);
  }, [fix]);

  if (!fix) return null;
  const speed = currentSpeed(fix, fixes.fix === fix ? fixes.previous : fixes.fix);
  return speed != null && stoppedAt === fix ? 0 : speed;
}
