import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

export async function createApp() {
  const app = express();

  app.use(express.json());

  // API Route to fetch and filter places
  app.post("/api/places/filter", async (req, res) => {
    try {
      const { lat, lng, category } = req.body;
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY;

      if (!GEMINI_API_KEY) {
        return res.status(400).json({ error: "Missing GEMINI_API_KEY. Please set it in AI Studio settings." });
      }
      if (!GOOGLE_MAPS_API_KEY) {
        return res.status(400).json({ error: "Missing GOOGLE_MAPS_PLATFORM_KEY. Please set it in AI Studio settings." });
      }

      // Step 1: Use Text Search (New) to find places matching the category + nearby
      const textQuery = `${category} near ${lat}, ${lng}`;
      const mapsRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          // Request ID, Name, Location, Reviews, Rating
          "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.reviews,places.rating,places.types"
        },
        body: JSON.stringify({
          textQuery: textQuery,
          languageCode: "en",
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 500.0
            }
          },
          maxResultCount: 20
        })
      });

      if (!mapsRes.ok) {
        const errObj = await mapsRes.text();
        console.error("Google Maps API error:", errObj);
        return res.status(500).json({ error: "Google Maps API returned an error" });
      }

      const mapsData = await mapsRes.json();
      const places = mapsData.places || [];

      if (places.length === 0) {
        return res.json({ places: [] });
      }

      // Format place data for Gemini
      const placesForLLM = places.map((p: any) => ({
        id: p.id,
        name: p.displayName?.text,
        rating: p.rating,
        reviews: p.reviews?.slice(0, 3)?.map((r: any) => r.text?.text) || []
      }));

      // Step 2: Use Gemini to filter places based on the user's implicit intent in the category
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      
      const prompt = `
You are a smart location filtering assistant. The user wants to find places matching the category: "${category}". 
I will provide a list of places, their ratings, and some of their recent reviews.
Analyze the name, rating, and especially the reviews of each place. Determine if the place TRULY fits the category "${category}".
For example, if the category is "rooftop", filter out places that don't actually have a rooftop or where the rooftop is poorly reviewed.
If the category is "heaters", look for mentions of "patio heaters", "warm", "heated", etc.
If the category is "happy hour", check if people actually like their happy hour.

Return a JSON object containing an array of Place IDs that strongly match the category.

Places:
${JSON.stringify(placesForLLM, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchingPlaceIds: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                }
              }
            },
            required: ["matchingPlaceIds"]
          }
        }
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      const matchingIds = new Set(parsed.matchingPlaceIds || []);

      const filteredPlaces = places.filter((p: any) => matchingIds.has(p.id)).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        rating: p.rating,
        category: category
      }));

      res.json({ places: filteredPlaces });

    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/osm/buildings", async (req, res) => {
    try {
      const { query } = req.body;
      const endpoints = [
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter"
      ];

      let data = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "AIStudio-HeliosPro/1.0",
              "Accept": "application/json"
            },
            body: `data=${encodeURIComponent(query)}`,
          });

          if (!response.ok) {
            throw new Error(`Overpass API error: ${response.status} ${response.statusText} from ${endpoint}`);
          }

          data = await response.json();
          break; // Success
        } catch (e: any) {
          lastError = e;
          console.warn(e.message);
        }
      }

      if (!data) {
        throw lastError;
      }

      res.json(data);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV === "test") {
    // Do not mount Vite or static serving in test environment
  } else if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (process.env.NODE_ENV !== "test") {
  createApp().then(app => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }).catch(err => {
    console.error("Failed to start server:", err);
  });
}
