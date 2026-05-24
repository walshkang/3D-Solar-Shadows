import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock global fetch
global.fetch = vi.fn();

// Mock Deck.gl React component
vi.mock('@deck.gl/react', () => {
  return {
    default: ({ children, layers, viewState }: any) => {
      return (
        <div data-testid="deck-gl" data-viewstate={JSON.stringify(viewState)}>
          {children}
          <div data-testid="deck-layers-count">{layers?.length || 0}</div>
          <div data-testid="deck-layers-list">
            {layers?.map((l: any) => l ? l.id : '').filter(Boolean).join(',')}
          </div>
        </div>
      );
    }
  };
});

// Mock react-map-gl/maplibre
vi.mock('react-map-gl/maplibre', () => {
  return {
    default: ({ children, id, viewState, mapStyle }: any) => {
      return (
        <div data-testid={`maplibre-${id || 'default'}`} data-style={mapStyle} data-viewstate={JSON.stringify(viewState)}>
          {children}
        </div>
      );
    },
    Map: ({ children, id, viewState, mapStyle }: any) => {
      return (
        <div data-testid={`maplibre-map-${id || 'default'}`} data-style={mapStyle} data-viewstate={JSON.stringify(viewState)}>
          {children}
        </div>
      );
    },
    Source: ({ children, id, data }: any) => {
      return (
        <div data-testid={`maplibre-source-${id}`} data-geojson={JSON.stringify(data)}>
          {children}
        </div>
      );
    },
    Layer: ({ id, type }: any) => {
      return <div data-testid={`maplibre-layer-${id}`} data-type={type} />;
    },
    Marker: ({ children, longitude, latitude }: any) => {
      return (
        <div data-testid="maplibre-marker" data-lng={longitude} data-lat={latitude}>
          {children}
        </div>
      );
    }
  };
});

// Mock @deck.gl/core classes
vi.mock('@deck.gl/core', () => {
  class MockLightingEffect {
    shadowColor: any;
    constructor(public config: any) {}
  }
  class MockAmbientLight {
    constructor(public config: any) {}
  }
  class MockSunLight {
    constructor(public config: any) {}
  }
  return {
    LightingEffect: MockLightingEffect,
    AmbientLight: MockAmbientLight,
    _SunLight: MockSunLight
  };
});
