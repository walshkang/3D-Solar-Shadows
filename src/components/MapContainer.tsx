import React, { useState, useEffect, useMemo, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { LightingEffect, AmbientLight, _SunLight as SunLight } from '@deck.gl/core';
import type { MapViewState } from '@deck.gl/core';
import { fetchOSMBuildings, fetchOSMSubwayLines, BuildingCollection, SubwayLineCollection } from '../lib/overpass';
import type { Place } from '../App';
import type { SolarData } from '../lib/solar';

interface MapContainerProps {
  date: Date;
  solarData: SolarData;
  findSunActive: boolean;
  viewState: MapViewState;
  onViewStateChange: (viewState: MapViewState) => void;
  places: Place[];
  mapMode: 'natural';
  showSubwaysMain: boolean;
  showSubwaysMinimap: boolean;
  showMinimap: boolean;
}

const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  natural: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
};

const NYC_BOROUGHS = [
  { name: 'Manhattan', coordinates: [-73.9712, 40.7831] },
  { name: 'Brooklyn', coordinates: [-73.9442, 40.6782] },
  { name: 'Queens', coordinates: [-73.7949, 40.7282] },
  { name: 'The Bronx', coordinates: [-73.8648, 40.8448] },
  { name: 'Staten Island', coordinates: [-74.1502, 40.5795] }
];

// Fetch radius helper bounds
function getBoundsFromCenter(lat: number, lng: number, radiusDegrees = 0.010): [number, number, number, number] {
  return [
    lng - radiusDegrees, // w
    lat - radiusDegrees, // s
    lng + radiusDegrees, // e
    lat + radiusDegrees  // n
  ];
}

export default function MapContainer({
  date,
  solarData,
  findSunActive,
  viewState,
  onViewStateChange,
  places = [],
  mapMode = 'natural',
  showSubwaysMain,
  showSubwaysMinimap,
  showMinimap
}: MapContainerProps) {
  
  const [buildings, setBuildings] = useState<BuildingCollection | null>(null);
  const [subways, setSubways] = useState<SubwayLineCollection | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingSubways, setIsFetchingSubways] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const subwayDebounceRef = useRef<NodeJS.Timeout>(null);

  const fetchBuildingsFn = async (lat: number, lng: number) => {
    setIsFetching(true);
    const bounds = getBoundsFromCenter(lat, lng, 0.010);
    const data = await fetchOSMBuildings(bounds);
    setBuildings(data);
    setIsFetching(false);
  };

  const fetchSubwaysFn = async (lat: number, lng: number) => {
    setIsFetchingSubways(true);
    // Fetch a slightly wider bounds for subways so they are visible zoom out
    const bounds = getBoundsFromCenter(lat, lng, 0.035);
    const data = await fetchOSMSubwayLines(bounds);
    setSubways(data);
    setIsFetchingSubways(false);
  };

  // Debounce viewport coordinate fetching for buildings
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBuildingsFn(viewState.latitude, viewState.longitude);
    }, 1000);
    
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [viewState.latitude, viewState.longitude]);

  // Debounce viewport coordinate fetching for subways
  useEffect(() => {
    if (!showSubwaysMain && !showSubwaysMinimap) return;
    
    if (subwayDebounceRef.current) clearTimeout(subwayDebounceRef.current);
    subwayDebounceRef.current = setTimeout(() => {
      fetchSubwaysFn(viewState.latitude, viewState.longitude);
    }, 1200);
    
    return () => {
      if (subwayDebounceRef.current) clearTimeout(subwayDebounceRef.current);
    };
  }, [viewState.latitude, viewState.longitude, showSubwaysMain, showSubwaysMinimap]);

  // Initial load
  useEffect(() => {
    fetchBuildingsFn(viewState.latitude, viewState.longitude);
    if (showSubwaysMain || showSubwaysMinimap) {
      fetchSubwaysFn(viewState.latitude, viewState.longitude);
    }
  }, []);

  // Calculate day-night transition factors based on solar elevation
  const { sunFactor, ambientFactor, nightFactor, sunsetGlowFactor } = useMemo(() => {
    const elevation = solarData.elevation; // in degrees
    
    // 1. sunFactor: Fades out completely as the sun sets (from 5 degrees to 0 degrees elevation)
    let sf = 1;
    if (elevation >= 5) {
      sf = 1;
    } else if (elevation <= 0) {
      sf = 0;
    } else {
      sf = elevation / 5;
    }

    // 2. ambientFactor: Ambient light dims as night falls (from 0 degrees to -12 degrees elevation)
    let af = 1;
    if (elevation >= 0) {
      af = 1;
    } else if (elevation <= -12) {
      af = 0.15; // floor value to keep buildings slightly visible (moonlit/dim)
    } else {
      af = 0.15 + 0.85 * (elevation + 12) / 12;
    }

    // 3. nightFactor: Fades in the dark ground/minimap overlay (from 0 degrees to -12 degrees elevation)
    let nf = 0;
    if (elevation >= 0) {
      nf = 0;
    } else if (elevation <= -12) {
      nf = 1;
    } else {
      nf = -elevation / 12;
    }

    // 4. sunsetGlowFactor: Shines intense sunset colors (peaks right at sunset, between 0 and 5 degrees elevation)
    let sgf = 0;
    if (elevation > 0 && elevation < 5) {
      // Peaks at 1.0 when elevation is 2.5 degrees, decreases to 0 at 0 and 5 degrees
      sgf = 1 - Math.abs(elevation - 2.5) / 2.5;
    }

    return { sunFactor: sf, ambientFactor: af, nightFactor: nf, sunsetGlowFactor: sgf };
  }, [solarData.elevation]);

  // Configure Deck.gl Lighting based on mapMode and day-night status
  const effects = useMemo(() => {
    const baseAmbientIntensity = 0.5; // Locked to natural style intensity
    const baseSunIntensity = 1.6;     // Locked to natural style intensity

    const ambientIntensity = baseAmbientIntensity * ambientFactor;
    const sunIntensity = baseSunIntensity * sunFactor;

    // Interpolate ambient color: Shift from pure white [255, 255, 255] to cool twilight blue [110, 130, 220]
    const ambientColor: [number, number, number] = [
      Math.round(255 * (1 - nightFactor) + 110 * nightFactor),
      Math.round(255 * (1 - nightFactor) + 130 * nightFactor),
      Math.round(255 * (1 - nightFactor) + 220 * nightFactor)
    ];

    // Interpolate sunlight color: Shift from warm white [255, 255, 240] to sunset orange/gold [255, 110, 30] during sunset
    const sunColor: [number, number, number] = [
      255,
      Math.round(255 * (1 - sunsetGlowFactor) + 110 * sunsetGlowFactor),
      Math.round(240 * (1 - sunsetGlowFactor) + 30 * sunsetGlowFactor)
    ];

    const ambientLight = new AmbientLight({
      color: ambientColor,
      intensity: ambientIntensity
    });
    
    const dirLight = new SunLight({
      timestamp: date.getTime(),
      color: sunColor,
      intensity: sunIntensity,
      _shadow: true
    });

    const lightingEffect = new LightingEffect({ ambientLight, dirLight });
    
    const shadowAlpha = 0.7; // Locked to natural style shadow opacity
    // Fade shadows smoothly as the sun sets
    lightingEffect.shadowColor = [0, 0, 0, shadowAlpha * sunFactor];
    
    return [lightingEffect];
  }, [date, ambientFactor, sunFactor, nightFactor, sunsetGlowFactor]);

  // Determine ground catcher fill color dynamically
  const groundFillColor = useMemo(() => {
    // If "Find Sun" floor highlight is active and there is sun, use the amber overlay
    if (findSunActive && sunFactor > 0) {
      return [245, 158, 11, Math.round(120 * sunFactor)];
    }

    // Faint overlay that matches the natural voyager baseline and fades out at night
    const opacity = Math.round(15 * (1 - nightFactor));
    return [255, 255, 255, opacity];
  }, [findSunActive, sunFactor, nightFactor]);

  // Determine buildings fill color dynamically
  const buildingFillColor = useMemo(() => {
    return [110, 125, 135, 200]; // Slate architectural tone
  }, []);

  // Compute CSS Filter for the basemap and minimap
  const mapFilter = useMemo(() => {
    const brightness = 1.0 - nightFactor * 0.92; // dim to 8%
    const saturation = 1.0 - nightFactor * 0.65; // desaturate to 35%
    const contrast = 1.0 - nightFactor * 0.15;   // slightly lower contrast
    return `brightness(${brightness}) saturate(${saturation}) contrast(${contrast})`;
  }, [nightFactor]);

  // Check if centered within NYC area (Rough bounding box)
  const isInsideNYC = useMemo(() => {
    const lat = viewState.latitude;
    const lng = viewState.longitude;
    return lat >= 40.49 && lat <= 40.92 && lng >= -74.26 && lng <= -73.69;
  }, [viewState.latitude, viewState.longitude]);

  // Minimap state
  const minimapViewState = useMemo(() => {
    return {
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: Math.max(9, Math.min(10.5, (viewState.zoom || 15) - 5.5)),
      pitch: 0,
      bearing: 0
    };
  }, [viewState.longitude, viewState.latitude, viewState.zoom]);

  const layers = [
    // Base floor for shadow catching
    new PolygonLayer({
      id: 'ground-layer',
      data: [{
        polygon: [
          [viewState.longitude - 0.2, viewState.latitude - 0.2],
          [viewState.longitude + 0.2, viewState.latitude - 0.2],
          [viewState.longitude + 0.2, viewState.latitude + 0.2],
          [viewState.longitude - 0.2, viewState.latitude + 0.2],
        ]
      }],
      getPolygon: (d: any) => d.polygon,
      getFillColor: groundFillColor,
      stroked: false,
      extruded: false,
      material: {
        ambient: 0.1,
        diffuse: 0.9,
        shininess: 0,
        specularColor: [0, 0, 0]
      }
    }),

    // Subway Lines Layer (Main Map)
    showSubwaysMain && subways && new GeoJsonLayer({
      id: 'subways-main-layer',
      data: subways,
      pickable: true,
      lineWidthMinPixels: 2.5,
      getLineColor: (f: any) => {
        const hex = f.properties.color || '#ef4444';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b, 210];
      },
      getLineWidth: 5,
    }),

    // 3D Buildings Layer
    buildings && new GeoJsonLayer({
      id: '3d-buildings',
      data: buildings,
      extruded: true,
      wireframe: false,
      pickable: true,
      getElevation: (f: any) => f.properties.height,
      getFillColor: buildingFillColor,
      getLineColor: [0, 0, 0, 0],
      material: {
        ambient: 0.3,
        diffuse: 0.7,
        shininess: 32,
        specularColor: [80, 80, 80]
      },
      transitions: {
        getElevation: 500
      }
    }),

    // Places Pins
    places.length > 0 && new ScatterplotLayer<Place>({
      id: 'places-layer',
      data: places,
      pickable: true,
      opacity: 1,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      lineWidthMinPixels: 3,
      getPosition: d => [d.lng, d.lat],
      getFillColor: [245, 158, 11], // Amber 500
      getLineColor: [255, 255, 255],
    }),

    // Places Labels
    places.length > 0 && new TextLayer<Place>({
      id: 'places-labels',
      data: places,
      getPosition: d => [d.lng, d.lat],
      getText: d => d.name,
      getSize: 14,
      getColor: [255, 255, 255, 255],
      getPixelOffset: [0, -25],
      fontFamily: 'system-ui, sans-serif',
      fontWeight: 700,
      background: true,
      getBackgroundColor: [0, 0, 0, 200],
      backgroundPadding: [8, 4],
    })
  ].filter(Boolean);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      <DeckGL
        layers={layers}
        effects={effects}
        viewState={viewState}
        onViewStateChange={({ viewState }) => onViewStateChange(viewState as any as MapViewState)}
        controller={true}
        getCursor={() => 'crosshair'}
        parameters={{
          depthTest: true as any,
          clearColor: [0, 0, 0, 1] as any
        } as any}
      >
        <Map 
          reuseMaps 
          mapStyle={MAP_STYLES[mapMode]} 
          attributionControl={false}
          style={{
            filter: mapFilter
          }}
        />
      </DeckGL>

      {/* Floating Minimap */}
      {showMinimap && (
        <div className="absolute bottom-8 left-8 w-64 h-64 rounded-3xl overflow-hidden border backdrop-blur-2xl shadow-2xl z-10 flex flex-col transition-all bg-black/60 border-white/10 shadow-black/85 text-slate-200">
          {/* Minimap Header */}
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between text-[10px] font-bold tracking-widest uppercase opacity-80">
            <span>City Overview</span>
            {isFetchingSubways && <span className="animate-pulse text-amber-500">Loading Transit...</span>}
          </div>
          
          {/* Map Area */}
          <div className="flex-1 relative">
            <Map
              id="minimap"
              reuseMaps
              viewState={minimapViewState}
              mapStyle={MAP_STYLES[mapMode]}
              attributionControl={false}
              dragPan={false}
              scrollZoom={false}
              boxZoom={false}
              doubleClickZoom={false}
              keyboard={false}
              dragRotate={false}
              touchZoomRotate={false}
              style={{
                filter: mapFilter
              }}
            >
              {/* NYC Borough Labels */}
              {isInsideNYC && NYC_BOROUGHS.map((b) => (
                <Marker
                  key={b.name}
                  longitude={b.coordinates[0]}
                  latitude={b.coordinates[1]}
                  anchor="center"
                >
                  <span className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500/40 pointer-events-none select-none text-center block w-20 leading-none drop-shadow-sm">
                    {b.name}
                  </span>
                </Marker>
              ))}

              {/* Pulsing Locator Pin representing main map center */}
              <Marker
                longitude={viewState.longitude || -73.9855}
                latitude={viewState.latitude || 40.7580}
                anchor="center"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-5 h-5 bg-amber-500/40 rounded-full animate-ping"></div>
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full border border-white shadow-md"></div>
                </div>
              </Marker>

              {/* Subway lines layer inside minimap */}
              {showSubwaysMinimap && subways && (
                <Source id="subways-minimap-src" type="geojson" data={subways}>
                  <Layer
                    id="subways-minimap-layer"
                    type="line"
                    paint={{
                      'line-color': ['get', 'color'],
                      'line-width': 1.5,
                      'line-opacity': 0.6
                    }}
                  />
                </Source>
              )}
            </Map>
          </div>
        </div>
      )}

      {isFetching && (
        <div className="absolute top-4 right-4 z-10 backdrop-blur-xl px-3 py-1.5 rounded-lg text-xs font-mono animate-pulse border shadow-lg flex items-center gap-2 transition-all bg-slate-900/90 border-slate-700/50 text-slate-300">
          Generating 3D Topology...
        </div>
      )}
    </div>
  );
}
