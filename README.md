# HeliosPro — 3D Solar Shadow Simulator & Urban Explorer

A high-performance, responsive single-page React application built with Vite, Tailwind CSS, TypeScript, MapLibre GL, and Deck.gl. It calculates and visualizes real-time 3D building shadows on a city map grid to help users find sunlight for outdoor dining, hanging out, and photography.

## Core Features

- **3D Extruded Buildings**: Dynamic fetch of OpenStreetMap (OSM) building geometries via the Overpass API, rendered as 3D extruded shapes on a WebGL map.
- **Client-Side Shadow Casting**: Calculates precise solar position (azimuth and elevation) using `suncalc` for any date and time. Projects real-time, GPU-accelerated shadows using Deck.gl's native `SunLight` / Effects system.
- **Smart Filters (Gemini AI)**: Fetches nearby dining and hangout spots from the Google Places API and filters them using Gemini to check if they match specific criteria (like rooftop patios, heated outdoor seating, or popular happy hour spots).
- **Map Themes**: Supports switching between three themes:
  - **Dark Mode**: CartoDB Dark Matter style, ideal for viewing high-contrast shadows.
  - **Light Mode**: CartoDB Positron style, showing subtle shadows on a light architectural canvas.
  - **Natural Mode**: CartoDB Voyager style, highlighting street grids and parks.
- **City Overview Minimap**: A floating card in the bottom-left showing a broad 2D city overview with a pulsing locator pin. When located in NYC, faint borough labels are overlaid on the minimap.
- **Subway/Transit Layers**: Visualizes local subway and light rail tracks on both the main map and the minimap, color-coded to match official NYC transit lines (A/C/E blue, 1/2/3 red, N/Q/R/W yellow, etc.).

## Repo Layout

- `context.md` — detailed system architecture, data contracts, and current project status.
- `agents.md` — developer & AI assistant protocols and coding guidelines.
- `server.ts` — Express proxy server that wraps Google Places and Overpass API requests and serves the static production build.
- `src/` — React frontend codebase:
  - `src/App.tsx` — root component managing view-state, map settings, and place selections.
  - `src/components/MapContainer.tsx` — WebGL canvas rendering the base map, Deck.gl building layers, shadows, and the floating minimap.
  - `src/components/SearchOverlay.tsx` — brand panel, place search, date picker, map controls, and AI smart filters.
  - `src/components/ControlPanel.tsx` — solar metrics board and timeline slider scrub.
  - `src/lib/` — helper libraries for solar calculations and Overpass API fetching.

## Run Locally

### Prerequisites
- Node.js (v20+ recommended)
- A Gemini API Key
- A Google Maps Platform API Key (with Places API enabled)

### Steps
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root folder (or copy `.env.example` to `.env`):
   ```env
   GEMINI_API_KEY="your-gemini-key"
   GOOGLE_MAPS_PLATFORM_KEY="your-google-maps-key"
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the application.

4. **Production Build:**
   To verify packaging or run production:
   ```bash
   npm run build
   npm start
   ```