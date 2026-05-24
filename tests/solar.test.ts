// @vitest-environment node
import { describe, it, expect } from 'vitest';
import SunCalc from 'suncalc';
import { getSolarData } from '../src/lib/solar';

describe('solar utility tests', () => {
  it('should return solar metrics for a given location and date', () => {
    // 2026-05-24 12:00:00 UTC at NYC coordinates
    const lat = 40.7580;
    const lng = -73.9855;
    const date = new Date(Date.UTC(2026, 4, 24, 16, 0, 0)); // 12 PM EST (roughly 16:00 UTC)

    const data = getSolarData(lat, lng, date);

    // Verify correct structure
    expect(data).toHaveProperty('azimuth');
    expect(data).toHaveProperty('elevation');
    expect(data).toHaveProperty('goldenHourInfo');
    expect(data).toHaveProperty('blueHourInfo');
    expect(data).toHaveProperty('lightDirection');

    // Azimuth and elevation should be numbers
    expect(typeof data.azimuth).toBe('number');
    expect(typeof data.elevation).toBe('number');

    // Check light direction vector elements
    const [x, y, z] = data.lightDirection;
    expect(typeof x).toBe('number');
    expect(typeof y).toBe('number');
    expect(typeof z).toBe('number');

    // Vector length should be roughly 1.0 (spherical coordinates norm)
    const norm = Math.sqrt(x * x + y * y + z * z);
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('should compute golden hour and blue hour windows or return null gracefully', () => {
    const lat = 40.7580;
    const lng = -73.9855;
    const date = new Date(Date.UTC(2026, 4, 24, 12, 0, 0));

    const data = getSolarData(lat, lng, date);

    if (data.goldenHourInfo) {
      expect(data.goldenHourInfo.start).toBeInstanceOf(Date);
      expect(data.goldenHourInfo.end).toBeInstanceOf(Date);
      expect(data.goldenHourInfo.end.getTime()).toBeGreaterThanOrEqual(data.goldenHourInfo.start.getTime());
    }

    if (data.blueHourInfo) {
      expect(data.blueHourInfo.start).toBeInstanceOf(Date);
      expect(data.blueHourInfo.end).toBeInstanceOf(Date);
      expect(data.blueHourInfo.end.getTime()).toBeGreaterThanOrEqual(data.blueHourInfo.start.getTime());
    }
  });

  it('should correctly project light direction using spherical coordinates logic', () => {
    // Manually run calculation steps
    const lat = 40.7580;
    const lng = -73.9855;
    const date = new Date();
    
    // Use SunCalc to verify values
    const sunPos = SunCalc.getPosition(date, lat, lng);
    const expectedAz = sunPos.azimuth * (180 / Math.PI);
    const expectedEl = sunPos.altitude * (180 / Math.PI);

    const data = getSolarData(lat, lng, date);

    expect(data.azimuth).toBeCloseTo(expectedAz, 5);
    expect(data.elevation).toBeCloseTo(expectedEl, 5);

    const az = sunPos.azimuth;
    const el = sunPos.altitude;
    const expectedX = Math.sin(az) * Math.cos(el);
    const expectedY = Math.cos(az) * Math.cos(el);
    const expectedZ = Math.sin(el);

    expect(data.lightDirection[0]).toBeCloseTo(expectedX, 5);
    expect(data.lightDirection[1]).toBeCloseTo(expectedY, 5);
    expect(data.lightDirection[2]).toBeCloseTo(expectedZ, 5);
  });
});
