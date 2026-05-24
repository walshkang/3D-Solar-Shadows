// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { GoogleGenAI } from '@google/genai';
import { createApp } from '../server';

// Mock Gemini SDK
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn(),
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING'
    }
  };
});

describe('Express backend proxy endpoints', () => {
  let app: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    // Set API keys
    process.env.GEMINI_API_KEY = 'test_gemini_key';
    process.env.GOOGLE_MAPS_PLATFORM_KEY = 'test_maps_key';
    process.env.NODE_ENV = 'test';

    // Dynamic mock implementation
    vi.mocked(GoogleGenAI).mockImplementation(function() {
      return {
        models: {
          generateContent: mockGenerateContent
        }
      } as any;
    });

    app = await createApp();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST /api/places/filter', () => {
    it('should return 400 if GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await request(app)
        .post('/api/places/filter')
        .send({ lat: 40.7580, lng: -73.9855, category: 'Rooftop' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('GEMINI_API_KEY');
    });

    it('should return 400 if GOOGLE_MAPS_PLATFORM_KEY is missing', async () => {
      delete process.env.GOOGLE_MAPS_PLATFORM_KEY;
      const res = await request(app)
        .post('/api/places/filter')
        .send({ lat: 40.7580, lng: -73.9855, category: 'Rooftop' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('GOOGLE_MAPS_PLATFORM_KEY');
    });

    it('should fetch from Google Places and filter results via Gemini', async () => {
      const mockPlacesResponse = {
        places: [
          {
            id: 'place1',
            displayName: { text: 'Sunny Rooftop Lounge' },
            location: { latitude: 40.7581, longitude: -73.9856 },
            rating: 4.5,
            reviews: [{ text: { text: 'Amazing rooftop views!' } }],
            types: ['bar', 'restaurant']
          },
          {
            id: 'place2',
            displayName: { text: 'Basement Diner' },
            location: { latitude: 40.7582, longitude: -73.9857 },
            rating: 4.2,
            reviews: [{ text: { text: 'Great basement vibes, no outdoor seating.' } }],
            types: ['restaurant']
          }
        ]
      };

      // Mock the search text fetch
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlacesResponse)
        })
      );
      global.fetch = mockFetch;

      // Mock Gemini AI response filtering: only place1 fits "Rooftop"
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ matchingPlaceIds: ['place1'] })
      });

      const res = await request(app)
        .post('/api/places/filter')
        .send({ lat: 40.7580, lng: -73.9855, category: 'Rooftop' });

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const fetchArgs = mockFetch.mock.calls[0];
      expect(fetchArgs[0]).toBe('https://places.googleapis.com/v1/places:searchText');
      expect(JSON.parse(fetchArgs[1].body).textQuery).toBe('Rooftop near 40.758, -73.9855');

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(res.body.places).toHaveLength(1);
      expect(res.body.places[0].id).toBe('place1');
      expect(res.body.places[0].name).toBe('Sunny Rooftop Lounge');
    });

    it('should handle zero places found gracefully', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ places: [] })
        })
      );
      global.fetch = mockFetch;

      const res = await request(app)
        .post('/api/places/filter')
        .send({ lat: 40.7580, lng: -73.9855, category: 'Rooftop' });

      expect(res.status).toBe(200);
      expect(res.body.places).toEqual([]);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/osm/buildings', () => {
    it('should successfully proxy to Overpass interpreter', async () => {
      const mockOSMData = { elements: [{ id: 123, type: 'way' }] };
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOSMData)
        })
      );
      global.fetch = mockFetch;

      const res = await request(app)
        .post('/api/osm/buildings')
        .send({ query: 'way["building"](40.757,-73.986,40.759,-73.984);' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockOSMData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fall back to other endpoints if the first fails', async () => {
      const mockOSMData = { elements: [{ id: 123, type: 'way' }] };
      const mockFetch = vi.fn()
        .mockImplementationOnce(() => Promise.reject(new Error('Network error on lz4')))
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOSMData)
          })
        );
      global.fetch = mockFetch;

      const res = await request(app)
        .post('/api/osm/buildings')
        .send({ query: 'some query' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockOSMData);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return 500 if all interpreter endpoints fail', async () => {
      const mockFetch = vi.fn().mockImplementation(() => Promise.reject(new Error('Down')));
      global.fetch = mockFetch;

      const res = await request(app)
        .post('/api/osm/buildings')
        .send({ query: 'some query' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });
});
