# Developer & AI Assistant Protocol — HeliosPro

**ENVIRONMENT WARNING:** You are operating in an agentic coding environment. Multiple AI instances may be contributing to this codebase. The filesystem, `context.md`, and this document are your sources of truth. Maintain alignment across components and respect data contracts at all times.

---

## Coding Guidelines

### 1. Performance Constraints (60FPS Scrubbing)
HeliosPro is designed to run solar shadow animations at a smooth 60FPS client-side.
- **Do NOT** place any heavy computations or blocking fetches inside the timeline slider scrub event.
- **Do NOT** re-create Deck.gl `LightingEffect` instances or baseline layers on every frame. Keep them wrapped in `useMemo` using dependencies that only change when required (e.g., date day changes, map styles change).
- Keep Overpass building queries debounced (1s debounce on coordinate change is the standard).

### 2. Backend Proxy Rule
All external API calls must go through the Express proxy server (`server.ts`):
- `/api/places/filter` -> Handles Google Places text searches and prompts the Gemini API.
- `/api/osm/buildings` -> Proxies Overpass QL strings to OpenStreetMap interpreters.
- **Never** perform direct fetch requests to Google APIs, Gemini, or Overpass from the client code. This prevents CORS violations and protects API keys.

### 3. Styling & Theming Conventions
The UI implements an "Immersive UI" aesthetic using Tailwind CSS v4.
- Support **Dark**, **Light**, and **Natural** map styles in all UI overlay containers.
- Standard themes:
  - Dark/Natural maps -> overlays use `bg-black/60 border-white/10 text-slate-200`
  - Light maps -> overlays use `bg-white/80 border-slate-200 text-slate-800`
- Keep overlay items glassmorphic with `backdrop-blur-2xl` or `backdrop-blur-xl`.

### 4. API Key Hygiene
- Never hardcode `GEMINI_API_KEY` or `GOOGLE_MAPS_PLATFORM_KEY` in the source code.
- Retrieve keys exclusively from `process.env` on the server.
- Document configuration settings inside `.env.example`.

---

## Verification Procedures

Before completing a task, run the following verification checks:

1. **TypeScript Linting**:
   ```bash
   npx tsc --noEmit
   ```
   Ensure there are zero compiler type errors.

2. **Production Build**:
   ```bash
   npm run build
   ```
   Ensure that the Vite assets bundle cleanly and the Express server transpiles without errors.
