export interface MarkerPoint {
  x: number;
  y: number;
}

export interface TriageItem {
  likely_brand: string;
  garment_type: string;
  color_pattern: string;
  tag_clues?: string;
  resale_score: number;
  verdict: 'GRAB' | 'MAYBE' | 'PASS';
  estimated_price_range: string;
  verdict_reason: string;
  action_hint: string;
  marker_point: MarkerPoint;
}

export interface TriageResponse {
  items: TriageItem[];
}

export async function analyzeImage(base64Image: string, mode: 'SINGLE' | 'BIN' | 'RACK', mimeType: string = "image/jpeg"): Promise<{ data: TriageResponse, raw: string }> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        mode,
        mimeType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze image');
    }

    const data = await response.json() as TriageResponse;
    return { data, raw: JSON.stringify(data) };
  } catch (e: any) {
    console.error("Analysis error:", e);
    throw e;
  }
}
