// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOSMBuildings, fetchOSMSubwayLines } from '../src/lib/overpass';

describe('overpass helper tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty collection early if bounding box is too large for buildings', async () => {
    const largeBounds: [number, number, number, number] = [-74.5, 40.0, -74.3, 40.2]; // dy = 0.2, dx = 0.2
    const data = await fetchOSMBuildings(largeBounds);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch, parse and cache OSM buildings correctly', async () => {
    const mockOSMResponse = {
      elements: [
        { type: 'node', id: 1, lat: 40.7580, lon: -73.9855 },
        { type: 'node', id: 2, lat: 40.7585, lon: -73.9855 },
        { type: 'node', id: 3, lat: 40.7585, lon: -73.9850 },
        { type: 'node', id: 4, lat: 40.7580, lon: -73.9850 },
        {
          type: 'way',
          id: 100,
          nodes: [1, 2, 3, 4, 1],
          tags: {
            building: 'yes',
            height: '20',
            color: '#ff0000'
          }
        }
      ]
    };

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockOSMResponse)
      })
    );
    global.fetch = mockFetch;

    const bounds: [number, number, number, number] = [-73.986, 40.757, -73.984, 40.759];
    const data = await fetchOSMBuildings(bounds);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(1);

    const feature = data.features[0];
    expect(feature.properties.id).toBe('100');
    expect(feature.properties.height).toBe(20);
    expect(feature.properties.color).toBe('#ff0000');
    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.geometry.coordinates[0]).toHaveLength(5); // closed polygon

    // Verify cache hit: subsequent call with same bounds should not trigger another fetch
    const cachedData = await fetchOSMBuildings(bounds);
    expect(cachedData).toEqual(data);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should estimate heights based on building:levels and handle missing heights', async () => {
    const mockOSMResponse = {
      elements: [
        { type: 'node', id: 10, lat: 40.7580, lon: -73.9855 },
        { type: 'node', id: 11, lat: 40.7585, lon: -73.9855 },
        { type: 'node', id: 12, lat: 40.7585, lon: -73.9850 },
        {
          type: 'way',
          id: 200,
          nodes: [10, 11, 12, 10],
          tags: {
            building: 'apartments',
            'building:levels': '3',
            'building:min_level': '1'
          }
        }
      ]
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockOSMResponse)
      })
    );

    const bounds: [number, number, number, number] = [-73.990, 40.750, -73.989, 40.751];
    const data = await fetchOSMBuildings(bounds);

    expect(data.features).toHaveLength(1);
    const feature = data.features[0];
    expect(feature.properties.height).toBe(3 * 3.5); // levels calculation
    expect(feature.properties.min_height).toBe(1 * 3.5); // min_level calculation
  });

  it('should fetch, parse and map colors for NYC subway lines', async () => {
    const mockSubwayOSM = {
      elements: [
        { type: 'node', id: 5, lat: 40.750, lon: -73.990 },
        { type: 'node', id: 6, lat: 40.751, lon: -73.991 },
        {
          type: 'way',
          id: 300,
          nodes: [5, 6],
          tags: {
            railway: 'subway',
            name: 'Broadway - Lafayette St (D/F)',
            line: 'Orange Line'
          }
        }
      ]
    };

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSubwayOSM)
      })
    );

    const bounds: [number, number, number, number] = [-73.992, 40.749, -73.988, 40.752];
    const data = await fetchOSMSubwayLines(bounds);

    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(1);

    const feature = data.features[0];
    expect(feature.properties.id).toBe('300');
    expect(feature.properties.name).toBe('Broadway - Lafayette St (D/F)');
    // Orange Line should color map to Sixth Avenue Orange
    expect(feature.properties.color).toBe('#ff6319');
    expect(feature.geometry.type).toBe('LineString');
    expect(feature.geometry.coordinates).toHaveLength(2);
  });
});
