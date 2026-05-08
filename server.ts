import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_INSTRUCTION = `You are the Thrift Triage AI for the "Bin Scanner" system.
Your mission is to identify ultra-high-value vintage and modern apparel, electronics, and rare collectibles.

Goal: Provide a decisive "Capture Candidate" analysis for expert resellers.

Criteria for verdicts:
- "GRAB": Only for power brands (e.g., Vintage Carhartt, Single-stitch bands, Designer luxury, rare collectibles, 90s streetwear) with high resale velocity. Must have a resale value >$50.
- "MAYBE": Quality items with decent margin (~$20-40) but slower sell-through.
- "PASS": Mandatory for fast fashion (Shein, H&M, Zara, Forever 21), generic mall brands with no vintage appeal, or items with visible damage. If you are unsure, default to PASS.

For each item identified, return valid JSON with:
- garment_type: (specific, e.g. "90s Boxy Tee", "Detroit Jacket")
- color_pattern: (descriptive, e.g. "Sun-faded navy", "Aztec print")
- likely_brand: (string)
- tag_clues: (visible labels, "Made in USA", material composition)
- resale_score: (1-10 based on real market desirability)
- verdict: (EXACTLY: "GRAB", "MAYBE", "PASS")
- estimated_price_range: (e.g. "$40-60")
- verdict_reason: (Why this is a grab or pass?)
- action_hint: (Specific advice: "Check armpit stitching", "Look for YKK zipper")
- marker_point: (normalized x and y coordinates 0.0 to 1.0)

Be extremely picky. If it's common, it's a PASS.
Respond in valid JSON only.`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { image, mode = "BIN", mimeType = "image/jpeg" } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Missing image data" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not set in the environment.");
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const prompt = `scan_mode: ${mode.toLowerCase()}. Returns JSON list of items found.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: image,
                  mimeType: mimeType,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    garment_type: { type: Type.STRING },
                    color_pattern: { type: Type.STRING },
                    likely_brand: { type: Type.STRING },
                    tag_clues: { type: Type.STRING },
                    resale_score: { type: Type.NUMBER },
                    verdict: { type: Type.STRING, enum: ["GRAB", "MAYBE", "PASS"] },
                    estimated_price_range: { type: Type.STRING },
                    verdict_reason: { type: Type.STRING },
                    action_hint: { type: Type.STRING },
                    marker_point: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                      },
                      required: ["x", "y"],
                    },
                  },
                  required: [
                    "garment_type",
                    "color_pattern",
                    "likely_brand",
                    "resale_score",
                    "verdict",
                    "marker_point",
                  ],
                },
              },
            },
            required: ["items"],
          },
        },
      });

      const rawText = response.text || "{}";
      res.json(JSON.parse(rawText));
    } catch (error: any) {
      console.error("Analysis API error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
