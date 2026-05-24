import React from 'react';
import { format } from 'date-fns';
import { Camera, Sunrise, Sunset, Compass, Clock } from 'lucide-react';
import type { SolarData } from '../lib/solar';

interface ControlPanelProps {
  date: Date;
  onTimeChange: (date: Date) => void;
  solarData: SolarData;
  onSnapToGoldenHour: () => void;
}

export default function ControlPanel({
  date,
  onTimeChange,
  solarData,
  onSnapToGoldenHour
}: ControlPanelProps) {
  
  // Extract minutes for the slider (0 to 1439)
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const mins = parseInt(e.target.value);
    const newDate = new Date(date);
    newDate.setHours(Math.floor(mins / 60));
    newDate.setMinutes(mins % 60);
    onTimeChange(newDate);
  };

  const formatHourWindow = (info: {start: Date, end: Date} | null) => {
    if (!info) return '--:-- to --:--';
    return `${format(info.start, 'HH:mm')} - ${format(info.end, 'HH:mm')}`;
  };

  return (
    <>
      <div className="z-10 absolute right-8 top-8 w-80 flex flex-col gap-4">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl text-slate-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Solar Metrics</h2>
              <p className="text-2xl font-mono text-amber-400 font-bold tracking-tighter">{format(date, 'HH:mm:ss')}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-mono uppercase">{format(date, 'MMM dd, yyyy')}</p>
              <p className="text-[10px] text-slate-500 font-mono">UTC{date.getTimezoneOffset() < 0 ? '+' : '-'}{Math.abs(date.getTimezoneOffset() / 60)}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-xs text-slate-400">Azimuth</span>
              <span className="text-sm font-mono">{solarData.azimuth.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-xs text-slate-400">Elevation</span>
              <span className="text-sm font-mono">{solarData.elevation.toFixed(2)}°</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[10px] text-blue-400 uppercase font-bold mb-1">Blue Hour</p>
                <p className="text-sm font-mono">{formatHourWindow(solarData.blueHourInfo)}</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-[10px] text-amber-500 uppercase font-bold mb-1">Golden Hour</p>
                <p className="text-sm font-mono">{formatHourWindow(solarData.goldenHourInfo)}</p>
              </div>
            </div>
            
            <button 
              onClick={onSnapToGoldenHour}
              disabled={!solarData.goldenHourInfo}
              className="w-full mt-2 py-3 bg-white text-black text-xs font-bold rounded-xl tracking-widest uppercase hover:bg-slate-200 disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-400 transition-colors"
            >
              Snap to Golden Hour
            </button>
          </div>
        </div>
      </div>

      <div className="z-10 absolute bottom-12 left-1/2 -translate-x-1/2 w-[900px] max-w-[90vw] bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col justify-center gap-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={14} className="text-amber-500" /> Timeline Scrub</h3>
           <span className="text-[10px] font-mono text-slate-500">24H CYCLE</span>
        </div>
        <div className="relative">
          <input 
            type="range"
            min="0"
            max="1439"
            value={currentMinutes}
            onChange={handleSliderChange}
            className="w-full h-4 bg-white/5 rounded-lg appearance-none cursor-pointer accent-amber-500 backdrop-blur-sm border border-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
          />
          {/* Custom marks overlay pointer-events-none */}
          <div className="absolute inset-0 pointer-events-none flex justify-between px-2 items-center bottom-[-24px] opacity-70">
            {[0, 4, 8, 12, 16, 20, 24].map((hr) => (
              <span key={hr} className="text-[10px] font-mono text-slate-500">{hr.toString().padStart(2, '0')}:00</span>
            ))}
          </div>
        </div>
        <div className="mt-4"></div>
      </div>
    </>
  );
}
