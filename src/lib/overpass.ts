export interface BuildingFeature {
  type: 'Feature';
  properties: {
    id: string;
    height: number;
    min_height: number;
    color: string;
  };
  geometry: any;
}

export interface BuildingCollection {
  type: 'FeatureCollection';
  features: BuildingFeature[];
}

const CACHE: Record<string, BuildingCollection> = {};

// Fetch buildings in a bounding box
export async function fetchOSMBuildings(bounds: [number, number, number, number]): Promise<BuildingCollection> {
  // Bounding box format for Overpass: south, west, north, east
  const [w, s, e, n] = bounds;
  
  // Create a cache key using rounded bounds to prevent over-fetching
  const cacheKey = `${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)}`;
  if (CACHE[cacheKey]) {
    return CACHE[cacheKey];
  }

  // To prevent massive queries, if the box is too large, return empty or limit
  const dy = n - s;
  const dx = e - w;
  if (dy > 0.1 || dx > 0.1) {
    console.warn("Bounding box too large for OSM building query", dy, dx);
    return { type: 'FeatureCollection', features: [] };
  }

  // Overpass QL to fetch building ways and relations
  const query = `
    [out:json][timeout:25];
    (
      way["building"](${s},${w},${n},${e});
      relation["building"](${s},${w},${n},${e});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('/api/osm/buildings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error("Overpass API proxy error");
    }

    const data = await response.json();
    
    // Convert OSM elements to GeoJSON
    // This is a simplified conversion. For a robust conversion, we usually use osmtogeojson.
    // Let's implement a rudimentary conversion.
    const nodes: Record<string, [number, number]> = {};
    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodes[el.id] = [el.lon, el.lat];
      }
    });

    const features: BuildingFeature[] = [];
    
    data.elements.forEach((el: any) => {
      if (el.type === 'way' && el.tags && el.tags.building) {
        let coordinates = el.nodes.map((nodeId: number) => nodes[nodeId]).filter(Boolean);
        if (coordinates.length >= 3) {
          // Ensure closed polygon ring
          const first = coordinates[0];
          const last = coordinates[coordinates.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coordinates.push([...first]);
          }
          
          let height = 15; // default 15 meters
          if (el.tags.height) {
            height = parseFloat(el.tags.height.replace(/[^0-9.]/g, ''));
          } else if (el.tags['building:levels']) {
            height = parseFloat(el.tags['building:levels']) * 3.5;
          }

          let minHeight = 0;
          if (el.tags.min_height) {
            minHeight = parseFloat(el.tags.min_height.replace(/[^0-9.]/g, ''));
          } else if (el.tags['building:min_level']) {
            minHeight = parseFloat(el.tags['building:min_level']) * 3.5;
          }

          features.push({
            type: 'Feature',
            properties: {
              id: el.id.toString(),
              height: isNaN(height) ? 15 : height,
              min_height: isNaN(minHeight) ? 0 : minHeight,
              color: el.tags['building:color'] || el.tags.color || '#e2e8f0'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          });
        }
      }
    });

    const collection: BuildingCollection = { type: 'FeatureCollection', features };
    CACHE[cacheKey] = collection;
    return collection;

  } catch (error) {
    console.error("Failed to fetch buildings", error);
    return { type: 'FeatureCollection', features: [] };
  }
}

export interface SubwayLineFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    color: string;
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface SubwayLineCollection {
  type: 'FeatureCollection';
  features: SubwayLineFeature[];
}

const SUBWAY_CACHE: Record<string, SubwayLineCollection> = {};

export async function fetchOSMSubwayLines(bounds: [number, number, number, number]): Promise<SubwayLineCollection> {
  const [w, s, e, n] = bounds;
  const cacheKey = `${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)}`;
  
  if (SUBWAY_CACHE[cacheKey]) {
    return SUBWAY_CACHE[cacheKey];
  }

  const dy = n - s;
  const dx = e - w;
  if (dy > 0.15 || dx > 0.15) {
    console.warn("Bounding box too large for subway query", dy, dx);
    return { type: 'FeatureCollection', features: [] };
  }

  const query = `
    [out:json][timeout:25];
    (
      way["railway"~"subway|light_rail"](${s},${w},${n},${e});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('/api/osm/buildings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error("Overpass API proxy error for subways");
    }

    const data = await response.json();
    
    const nodes: Record<string, [number, number]> = {};
    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodes[el.id] = [el.lon, el.lat];
      }
    });

    const features: SubwayLineFeature[] = [];
    
    data.elements.forEach((el: any) => {
      if (el.type === 'way' && el.tags && (el.tags.railway === 'subway' || el.tags.railway === 'light_rail')) {
        const coordinates = el.nodes.map((nodeId: number) => nodes[nodeId]).filter(Boolean);
        if (coordinates.length >= 2) {
          // Color based on route/line tag or name
          let color = '#ef4444'; // default red
          const name = el.tags.name || el.tags.ref || '';
          const line = (el.tags.line || name).toLowerCase();
          
          if (line.includes('blue') || line.includes('a') || line.includes('c') || line.includes('e') || line.includes('eighth')) {
            color = '#0039a6'; // NYC A/C/E Blue
          } else if (line.includes('red') || line.includes('1') || line.includes('2') || line.includes('3') || line.includes('broadway-7th')) {
            color = '#ee352e'; // NYC 1/2/3 Red
          } else if (line.includes('yellow') || line.includes('n') || line.includes('q') || line.includes('r') || line.includes('w') || line.includes('broadway')) {
            color = '#fccc0a'; // NYC N/Q/R/W Yellow
          } else if (line.includes('green') || line.includes('4') || line.includes('5') || line.includes('6') || line.includes('lexington')) {
            color = '#00933c'; // NYC 4/5/6 Green
          } else if (line.includes('orange') || line.includes('b') || line.includes('d') || line.includes('f') || line.includes('m') || line.includes('sixth')) {
            color = '#ff6319'; // NYC B/D/F/M Orange
          } else if (line.includes('purple') || line.includes('7') || line.includes('flushing')) {
            color = '#b933ad'; // NYC 7 Purple
          } else if (line.includes('grey') || line.includes('gray') || line.includes('l') || line.includes('14th st')) {
            color = '#a7a9ac'; // NYC L Grey
          } else if (line.includes('lime') || line.includes('g') || line.includes('brooklyn-queens')) {
            color = '#6cbe45'; // NYC G Lime
          } else if (line.includes('brown') || line.includes('j') || line.includes('z') || line.includes('nassau')) {
            color = '#996633'; // NYC J/Z Brown
          }
          
          features.push({
            type: 'Feature',
            properties: {
              id: el.id.toString(),
              name: el.tags.name || el.tags.ref || 'Subway Line',
              color
            },
            geometry: {
              type: 'LineString',
              coordinates
            }
          });
        }
      }
    });

    const collection: SubwayLineCollection = { type: 'FeatureCollection', features };
    SUBWAY_CACHE[cacheKey] = collection;
    return collection;

  } catch (error) {
    console.error("Failed to fetch subway lines", error);
    return { type: 'FeatureCollection', features: [] };
  }
}

