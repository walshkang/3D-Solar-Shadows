import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar as CalendarIcon, Sun, Coffee, Wine, ThermometerSun, Building, Sparkles, Loader2, Layers, Train } from 'lucide-react';
import { format } from 'date-fns';

const SMART_CATEGORIES = [
  { id: "Cafe", label: "Cafe", icon: Coffee },
  { id: "Coffee", label: "Coffee", icon: Coffee },
  { id: "Happy Hour", label: "Happy Hour", icon: Wine },
  { id: "Rooftop", label: "Rooftop", icon: Building },
  { id: "Heaters", label: "Heaters", icon: ThermometerSun },
];

interface SearchOverlayProps {
  onLocationSelect: (lat: number, lon: number) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  findSunActive: boolean;
  onToggleFindSun: () => void;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  isLoadingPlaces: boolean;
  
  // New props
  mapMode: 'dark' | 'light' | 'natural';
  onMapModeChange: (mode: 'dark' | 'light' | 'natural') => void;
  showSubwaysMain: boolean;
  onToggleSubwaysMain: () => void;
  showSubwaysMinimap: boolean;
  onToggleSubwaysMinimap: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
}

export default function SearchOverlay({
  onLocationSelect,
  date,
  onDateChange,
  findSunActive,
  onToggleFindSun,
  activeCategory,
  onCategoryChange,
  isLoadingPlaces,
  
  // New props
  mapMode,
  onMapModeChange,
  showSubwaysMain,
  onToggleSubwaysMain,
  showSubwaysMinimap,
  onToggleSubwaysMinimap,
  showMinimap,
  onToggleMinimap
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="absolute top-8 left-8 z-10 flex flex-col gap-4 w-80">
      
      {/* App Logo/Brand */}
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-black"></div>
          </div>
          <span className="font-bold tracking-tight text-lg text-slate-200">HELIOS<span className="text-amber-500">PRO</span></span>
        </div>
      </div>

      {/* Search Box */}
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <form onSubmit={searchLocation} className="flex flex-row items-center p-2">
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, neighborhood..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500/50 transition-colors"
          />
          <button type="submit" className="ml-2 p-2 text-slate-400 hover:text-amber-500 transition-colors">
            <Search size={18} />
          </button>
        </form>

        {results.length > 0 && (
          <div className="border-t border-white/10 max-h-48 overflow-y-auto bg-black/40">
            {results.map((r, idx) => (
              <button 
                key={idx}
                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/10 transition-colors flex items-start gap-2 border-b border-white/5 last:border-0"
                onClick={() => {
                  onLocationSelect(parseFloat(r.lat), parseFloat(r.lon));
                  setResults([]);
                  setQuery(r.display_name.split(',')[0]);
                }}
              >
                <MapPin size={16} className="mt-0.5 text-slate-500 shrink-0" />
                <span className="truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date Picker & Tools */}
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">
        
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <CalendarIcon size={14} className="text-amber-500" /> Date Selection
          </label>
          <input 
            type="date"
            value={format(date, 'yyyy-MM-dd')}
            onChange={(e) => {
              if (e.target.value) {
                const newDate = new Date(e.target.value);
                newDate.setHours(date.getHours(), date.getMinutes());
                onDateChange(newDate);
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/50 font-mono tracking-wider transition-colors"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <button 
          onClick={onToggleFindSun}
          className={`w-full py-3 rounded-xl text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
            findSunActive 
              ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
              : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
          }`}
        >
          <Sun size={16} className={findSunActive ? 'animate-spin-slow' : ''} />
          {findSunActive ? 'Highlighting Unshaded Areas' : 'Find Sun (Floor Highlight)'}
        </button>

      </div>

      {/* Map Settings */}
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Layers size={14} className="text-amber-500" /> Map Styles & Layers
        </label>
        
        {/* Style Selector */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-500 uppercase font-mono">Map Theme</span>
          <div className="grid grid-cols-3 gap-1">
            {(['dark', 'light', 'natural'] as const).map((mode) => (
              <button
                key={mode}
                onClick={(e) => {
                  e.preventDefault();
                  onMapModeChange(mode);
                }}
                className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  mapMode === mode
                    ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 flex items-center gap-2">
              <Train size={14} className="text-slate-400" /> Subway Lines (Main)
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleSubwaysMain();
              }}
              className={`w-9 h-5 rounded-full p-[2px] transition-colors duration-200 focus:outline-none ${
                showSubwaysMain ? 'bg-amber-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  showSubwaysMain ? 'translate-x-4 bg-black' : 'translate-x-0 bg-slate-300'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 flex items-center gap-2">
              <Layers size={14} className="text-slate-400" /> Show Minimap
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleMinimap();
              }}
              className={`w-9 h-5 rounded-full p-[2px] transition-colors duration-200 focus:outline-none ${
                showMinimap ? 'bg-amber-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  showMinimap ? 'translate-x-4 bg-black' : 'translate-x-0 bg-slate-300'
                }`}
              />
            </button>
          </div>

          {showMinimap && (
            <div className="flex items-center justify-between pl-4 border-l border-white/10">
              <span className="text-xs text-slate-400 flex items-center gap-2">
                <Train size={12} className="text-slate-500" /> Subways (Minimap)
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onToggleSubwaysMinimap();
                }}
                className={`w-7 h-4 rounded-full p-[2px] transition-colors duration-200 focus:outline-none ${
                  showSubwaysMinimap ? 'bg-amber-500' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full shadow-md transform transition-transform duration-200 ${
                    showSubwaysMinimap ? 'translate-x-3 bg-black' : 'translate-x-0 bg-slate-300'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Smart Filters */}
      <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" /> AI Smart Filters
        </label>
        <div className="flex flex-wrap gap-2">
          {SMART_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(isActive ? null : cat.id)}
                disabled={isLoadingPlaces && !isActive}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                } ${(isLoadingPlaces && !isActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {(isLoadingPlaces && isActive) ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Icon size={12} />
                )}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
