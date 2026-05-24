import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import MapContainer from '../../src/components/MapContainer';
import { fetchOSMBuildings, fetchOSMSubwayLines } from '../../src/lib/overpass';

// Mock overpass helpers
vi.mock('../../src/lib/overpass', () => {
  return {
    fetchOSMBuildings: vi.fn().mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'b1', height: 25, color: '#aaaaaa' },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] }
        }
      ]
    }),
    fetchOSMSubwayLines: vi.fn().mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 's1', name: 'Subway Line', color: '#ff0000' },
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
        }
      ]
    })
  };
});

describe('MapContainer component tests', () => {
  const defaultProps = {
    date: new Date(),
    findSunActive: false,
    viewState: {
      longitude: -73.9855,
      latitude: 40.7580,
      zoom: 15,
      pitch: 50,
      bearing: 30
    },
    onViewStateChange: vi.fn(),
    places: [],
    mapMode: 'dark' as const,
    showSubwaysMain: false,
    showSubwaysMinimap: false,
    showMinimap: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders DeckGL canvas and base map styles', async () => {
    render(<MapContainer {...defaultProps} />);

    // Renders the deckGL canvas mock
    const deckGl = screen.getByTestId('deck-gl');
    expect(deckGl).toBeInTheDocument();

    // Renders primary maplibre base map
    const mapLibre = screen.getByTestId('maplibre-default');
    expect(mapLibre).toBeInTheDocument();
    expect(mapLibre).toHaveAttribute('data-style', 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');

    // Renders loading overlay or state initially
    expect(fetchOSMBuildings).toHaveBeenCalled();
  });

  it('debounces fetching new buildings on coordinate changes', async () => {
    const { rerender } = render(<MapContainer {...defaultProps} />);
    
    // Initial fetch from useEffect mount
    expect(fetchOSMBuildings).toHaveBeenCalledTimes(1);

    // Update coordinate state
    const newProps = {
      ...defaultProps,
      viewState: {
        ...defaultProps.viewState,
        latitude: 40.7600,
        longitude: -73.9800
      }
    };
    
    await act(async () => {
      rerender(<MapContainer {...newProps} />);
    });

    // It is debounced by 1s, so it should not have triggered the second fetch yet
    expect(fetchOSMBuildings).toHaveBeenCalledTimes(1);

    // Fast-forward 1000ms
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(fetchOSMBuildings).toHaveBeenCalledTimes(2);
  });

  it('renders subway lines in main map layer if showSubwaysMain is enabled', async () => {
    const { rerender } = render(<MapContainer {...defaultProps} showSubwaysMain={true} />);

    // Fast-forward for subway debouncing (1.2s)
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(fetchOSMSubwayLines).toHaveBeenCalled();

    // Deck layers list should eventually render subways and buildings
    const layerList = screen.getByTestId('deck-layers-list');
    expect(layerList.textContent).toContain('ground-layer');
    expect(layerList.textContent).toContain('3d-buildings');
    expect(layerList.textContent).toContain('subways-main-layer');
  });

  it('renders locator pin and subway lines in minimap overlay if showMinimap and showSubwaysMinimap are enabled', async () => {
    render(<MapContainer {...defaultProps} showMinimap={true} showSubwaysMinimap={true} />);

    // Renders the floating overview minimap card
    expect(screen.getByText('City Overview')).toBeInTheDocument();

    // Secondary maplibre instance for minimap exists
    expect(screen.getByTestId('maplibre-minimap')).toBeInTheDocument();

    // Fast-forward for subway fetching
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    // Minimap source for subway tracks should exist
    const minimapSubwaySrc = screen.getByTestId('maplibre-source-subways-minimap-src');
    expect(minimapSubwaySrc).toBeInTheDocument();
  });

  it('does not render minimap overview if showMinimap is disabled', () => {
    render(<MapContainer {...defaultProps} showMinimap={false} />);
    expect(screen.queryByText('City Overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maplibre-map-minimap')).not.toBeInTheDocument();
  });
});
