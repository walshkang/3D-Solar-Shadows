import SunCalc from 'suncalc';
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';

export interface SolarData {
  azimuth: number;
  elevation: number;
  goldenHourInfo: {
    start: Date;
    end: Date;
  } | null;
  blueHourInfo: {
    start: Date;
    end: Date;
  } | null;
  lightDirection: [number, number, number];
}

export function getSolarData(lat: number, lng: number, date: Date): SolarData {
  // suncalc returns azimuth measured from south to west, elevation from horizon
  const sunPos = SunCalc.getPosition(date, lat, lng);
  
  // Calculate sun times
  const times = SunCalc.getTimes(date, lat, lng);

  // lightDirection for DeckGL SunLight
  // We need to convert azimuth and elevation to a 3D vector
  const az = sunPos.azimuth;
  const el = sunPos.altitude;
  
  // spherical to Cartesian
  const x = Math.sin(az) * Math.cos(el);
  const y = Math.cos(az) * Math.cos(el);
  const z = Math.sin(el);

  // DeckGL expects light direction pointing downwards?
  // We'll leave as [x, y, z] until we test. Often SunLight calculates its own based on timestamp and location!
  // Actually, DeckGL's SunLight takes timestamp, latitude, longitude and calculates the direction itself!
  // So we only need solar data for the UI dashboard.

  return {
    azimuth: sunPos.azimuth * (180 / Math.PI), // Convert to degrees
    elevation: sunPos.altitude * (180 / Math.PI), // Convert to degrees
    goldenHourInfo: times.goldenHour ? {
      start: times.goldenHour,
      end: times.sunsetStart
    } : null,
    blueHourInfo: times.dusk ? {
      start: times.sunset,
      end: times.dusk
    } : null,
    lightDirection: [x, y, z]
  };
}
