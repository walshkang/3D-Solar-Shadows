/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { MapViewState } from '@deck.gl/core';
import MapContainer from './components/MapContainer';
import ControlPanel from './components/ControlPanel';
import SearchOverlay from './components/SearchOverlay';
import { getSolarData } from './lib/solar';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  category: string;
}

export default function App() {
  const [date, setDate] = useState(new Date());
  const [findSunActive, setFindSunActive] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);

  // New map settings states
  const mapMode = 'natural';
  const [showSubwaysMain, setShowSubwaysMain] = useState(false);
  const [showSubwaysMinimap, setShowSubwaysMinimap] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  // Default coordinates: Midtown Manhattan, NYC
  const [viewState, setViewState] = useState<MapViewState>({
    longitude: -73.9855,
    latitude: 40.7580,
    zoom: 15,
    pitch: 50,
    bearing: 30,
    transitionDuration: 'auto'
  });

  const solarData = useMemo(() => {
    return getSolarData(viewState.latitude, viewState.longitude, date);
  }, [date, viewState.latitude, viewState.longitude]);

  const fetchPlaces = async (category: string) => {
    setIsLoadingPlaces(true);
    try {
      const res = await fetch("/api/places/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: viewState.latitude,
          lng: viewState.longitude,
          category
        })
      });
      const data = await res.json();
      if (data.places) setPlaces(data.places);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  const handleCategoryChange = (cat: string | null) => {
    setActiveCategory(cat);
    if (cat) {
      fetchPlaces(cat);
    } else {
      setPlaces([]);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black font-sans relative selection:bg-amber-500 selection:text-black">
      <MapContainer 
        date={date}
        solarData={solarData}
        findSunActive={findSunActive}
        viewState={viewState}
        onViewStateChange={setViewState}
        places={places}
        mapMode={mapMode}
        showSubwaysMain={showSubwaysMain}
        showSubwaysMinimap={showSubwaysMinimap}
        showMinimap={showMinimap}
      />
      
      <SearchOverlay 
        date={date}
        onDateChange={setDate}
        findSunActive={findSunActive}
        onToggleFindSun={() => setFindSunActive(!findSunActive)}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        isLoadingPlaces={isLoadingPlaces}
        showSubwaysMain={showSubwaysMain}
        onToggleSubwaysMain={() => setShowSubwaysMain(!showSubwaysMain)}
        showSubwaysMinimap={showSubwaysMinimap}
        onToggleSubwaysMinimap={() => setShowSubwaysMinimap(!showSubwaysMinimap)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        onLocationSelect={(lat, lon) => {
          setViewState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lon,
            transitionDuration: 1000, // standard duration for smooth fly to
          }));
          // Refetch if category is active
          if (activeCategory) {
            setTimeout(() => fetchPlaces(activeCategory), 1000);
          }
        }}
      />

      <ControlPanel 
        date={date}
        onTimeChange={setDate}
        solarData={solarData}
        onSnapToGoldenHour={() => {
          if (solarData.goldenHourInfo) {
            setDate(solarData.goldenHourInfo.start);
          }
        }}
      />
    </div>
  );
}
