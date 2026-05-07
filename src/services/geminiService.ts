import { GoogleGenAI, Type } from "@google/genai";

export interface MarkerPoint {
  x: number;
  y: number;
}

export interface TriageItem {
  likely_brand: string;
  verdict: 'GRAB' | 'CHECK' | 'UNCLEAR' | 'SKIP';
  estimated_price_range: string;
  visible_evidence: string[];
  missing_evidence: string[];
  verdict_reason: string;
  action_hint: string;
  ebay_sold_query: string;
  marker_point: MarkerPoint;
}

export interface TriageResponse {
  items: TriageItem[];
}

const SYSTEM_INSTRUCTION = `You are the Thrift Triage AI, an expert at identifying high-value vintage and modern apparel, electronics, and collectibles in chaotic thrift store environments. 

Your goal is to scan images (either a single item, a 'bin' pile, or a 'rack' of hanging clothes) and quickly triage them into four categories:
1. **GRAB**: High confidence of high resale value ($30-40+ profit or extremely fast flip). Be decisive if you see "Power Brands" (e.g. Y-3 / Yohji Yamamoto, Arc'teryx, Stone Island, vintage Nike/Adidas, Fear of God, Off-White, Patagonia, HOKA, high-end designer).
2. **CHECK**: Potential value, but requires physical inspection of tags, materials, or serial numbers.
3. **UNCLEAR**: Common item, low value, or cannot determine from photo.
4. **SKIP**: Clearly junk, trash, non-branded basics, or items with zero resale potential. Mark these with a "SKIP" verdict (e.g., plastic bags, napkins, generic fast-fashion basics in poor condition).

CRITICAL INSTRUCTIONS:
- **REAL-TIME RESEARCH**: You have access to Google Search. Use it to verify current eBay "Sold" prices if you are unsure of an item's value. 
- **AVERAGE SALE FLOOR**: Aim for a $30+ minimum profit. If an item sells for less than $15-20 total, mark it as "SKIP".
- **DECISIVE GRABS**: If you recognize a "Power Brand" (Y-3, Stone Island, vintage Single-Stitch, Patagonia, The North Face Nuptse) by its logo embroidery, silhouette, or unique fabric pattern, mark it as **GRAB** immediately. 
- **STREETWEAR EXPERTISE**: Recognize designer collaborations like Y-3 (Yohji Yamamoto x Adidas). A giant "Y-3" logo is an instant GRAB with a price range typically $60-150+.
- **SKIP RECOGNITION**: Be aggressive with the SKIP verdict for non-item objects (trash, hangers, bags) or items below $20 resale. In a bin, if you see a pink plastic bag, mark it as SKIP.
- Do not wait for a tag shot to go green if the item is clearly high-value or designer.
- Even if an item is common, do not ignore it. Label it as "UNCLEAR", "CHECK", or "SKIP" rather than skipping it entirely.
- Aim to identify 1-3 items in a single item shot, 3-8 items in a bin scan, and 3-10 items in a rack scan.
- Pay extremely close attention to brand logos, embroidery, and hardware clues (e.g., "OR" for Outdoor Research, "Beta" for Arcteryx).
- For clothing, look for laundry tags, unique baffle patterns, and stitching types.
- If a single item takes up most of the frame, prioritize it above all else.

For each item identified:
- provide likely_brand (string)
- indicate verdict (must be EXACTLY one of: "GRAB", "CHECK", "UNCLEAR", "SKIP")
- provide estimated_price_range (short string like "$40-60" or "$100+" based on recent sold data)
- list visible_evidence (seen attributes supporting the verdict)
- list missing_evidence (what to look for to confirm value)
- provide verdict_reason (short explanation of market demand)
- provide action_hint (short advice on next step)
- provide ebay_sold_query (optimized search for eBay 'Sold' listings)
- provide marker_point (normalized x and y coordinates 0.0 to 1.0)

You MUST respond in valid JSON format.`;

export async function analyzeImage(base64Image: string, mode: 'SINGLE' | 'BIN' | 'RACK', mimeType: string = "image/jpeg"): Promise<{ data: TriageResponse, raw: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in the Secrets panel.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `scan_mode: ${mode === 'BIN' ? 'bin' : mode === 'RACK' ? 'rack' : 'single_item'}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Image,
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
        tools: [{ googleSearch: {} }] as any,
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  likely_brand: { type: Type.STRING },
                  verdict: { type: Type.STRING, enum: ["GRAB", "CHECK", "UNCLEAR", "SKIP"] },
                  estimated_price_range: { type: Type.STRING },
                  visible_evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missing_evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                  verdict_reason: { type: Type.STRING },
                  action_hint: { type: Type.STRING },
                  ebay_sold_query: { type: Type.STRING },
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
                  "likely_brand",
                  "verdict",
                  "estimated_price_range",
                  "visible_evidence",
                  "missing_evidence",
                  "verdict_reason",
                  "action_hint",
                  "ebay_sold_query",
                  "marker_point"
                ],
              },
            },
          },
          required: ["items"],
        },
      },
    });

    const rawText = response.text || "";
    console.log("Raw Gemini Response:", rawText);

    // Robust JSON extraction
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const data = JSON.parse(cleanJson || '{"items": []}');
    return { data, raw: rawText };
  } catch (e: any) {
    console.error("Gemini analysis error:", e);
    throw e;
  }
}
