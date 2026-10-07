import { describe, expect, it } from 'vitest';
import { currentSpeed } from '../speedometer';
import type { DeviceFix } from '../useDeviceLocation';

const at = (latitude: number, timestamp: number, speed: number | null = null): DeviceFix => ({
  latitude,
  longitude: 34.78,
  speed,
  timestamp,
});

/** About 11.1 m per 0.0001° of latitude. */
const STEP = 0.0001;

describe('currentSpeed', () => {
  it('uses the GPS speed when the phone reports one', () => {
    expect(currentSpeed(at(32, 1000, 5), null)).toBeCloseTo(18);
  });

  it('measures from the previous fix when there is no GPS speed', () => {
    const kmh = currentSpeed(at(32 + STEP, 2000), at(32, 0));
    expect(kmh).toBeGreaterThan(19);
    expect(kmh).toBeLessThan(21);
  });

  it('treats invalid GPS speed (-1 on iOS) as missing', () => {
    expect(currentSpeed(at(32, 1000, -1), null)).toBeNull();
  });

  it('ignores fixes too far apart in time', () => {
    expect(currentSpeed(at(32 + STEP, 60_000), at(32, 0))).toBeNull();
  });

  it('shows standing still as zero', () => {
    expect(currentSpeed(at(32, 1000, 0.3), null)).toBe(0);
  });
});
