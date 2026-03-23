export interface PlaceBusiness {
  place_id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  types: string[];
  lat: number;
  lng: number;
  business_status: string;
  price_level: number | null;
  lead_quality_score: number;
  outreach_hints: string[];
}

export interface MapsSearchResult {
  query: string;
  location: string;
  total_results: number;
  businesses: PlaceBusiness[];
  searched_at: string;
}

export interface MapsLeadsResult {
  industry: string;
  location: string;
  min_score: number;
  total_qualified: number;
  leads: PlaceBusiness[];
  searched_at: string;
}

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

async function textSearch(
  query: string,
  apiKey: string,
  pageToken?: string
): Promise<{ results: unknown[]; next_page_token?: string }> {
  const params = new URLSearchParams({
    query,
    key: apiKey,
    ...(pageToken && { pagetoken: pageToken }),
  });

  const res = await fetch(`${PLACES_BASE}/textsearch/json?${params}`);
  if (!res.ok) {
    throw new Error(`Google Places API error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results: unknown[];
    next_page_token?: string;
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places API status: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
    );
  }

  return { results: data.results ?? [], next_page_token: data.next_page_token };
}

async function getPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields:
      "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,geometry,business_status,price_level",
    key: apiKey,
  });

  const res = await fetch(`${PLACES_BASE}/details/json?${params}`);
  if (!res.ok) {
    throw new Error(`Google Places Details API error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    result?: Record<string, unknown>;
  };

  if (data.status !== "OK") {
    throw new Error(`Google Places Details API status: ${data.status}`);
  }

  return data.result ?? {};
}

/**
 * Lead Quality Score (0–100):
 * - Has website: +20 (they invest in digital presence)
 * - Has phone: +10
 * - Rating < 4.0: +15 (room for improvement → pain point)
 * - Many reviews (>50): +15 (established business)
 * - Has price_level (investable): +10
 * - Business is OPERATIONAL: +10
 * - Low review count (<10): -10 (might be new/struggling)
 */
function calculateLeadQualityScore(place: {
  website: string | null;
  phone: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  price_level: number | null;
  business_status: string;
}): number {
  let score = 30; // base

  if (place.website) score += 20;
  if (place.phone) score += 10;

  const rating = place.rating ?? 4.0;
  if (rating < 3.5) score += 15;
  else if (rating < 4.0) score += 8;

  const reviews = place.user_ratings_total ?? 0;
  if (reviews > 200) score += 15;
  else if (reviews > 50) score += 10;
  else if (reviews > 10) score += 5;
  else score -= 10;

  if (place.price_level !== null && place.price_level >= 2) score += 10;

  if (place.business_status === "OPERATIONAL") score += 10;
  else score -= 20;

  return Math.max(0, Math.min(100, score));
}

function generateOutreachHints(place: PlaceBusiness): string[] {
  const hints: string[] = [];

  if (!place.website) {
    hints.push("No website detected — pitch web presence / digital marketing");
  }

  if (place.rating !== null && place.rating < 4.0) {
    hints.push(
      `Low rating (${place.rating}) — pitch reputation management or review improvement`
    );
  }

  if (place.user_ratings_total !== null && place.user_ratings_total < 20) {
    hints.push("Few reviews — pitch review generation services");
  }

  if (place.price_level !== null && place.price_level >= 3) {
    hints.push("Premium price tier — pitch high-end service packages");
  }

  if (place.business_status === "OPERATIONAL") {
    hints.push("Business is active — good time to reach out");
  }

  if (!place.phone) {
    hints.push("No phone number found — may rely on online contact");
  }

  if (hints.length === 0) {
    hints.push("Established business — pitch growth/scaling services");
  }

  return hints;
}

type RawPlaceResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  geometry?: { location?: { lat?: number; lng?: number } };
  business_status?: string;
  price_level?: number;
};

function normalizeBusiness(raw: unknown): PlaceBusiness {
  const r = raw as RawPlaceResult;

  const partial = {
    place_id: r.place_id ?? "",
    name: r.name ?? "",
    address: r.formatted_address ?? "",
    phone: r.formatted_phone_number ?? null,
    website: r.website ?? null,
    rating: r.rating ?? null,
    user_ratings_total: r.user_ratings_total ?? null,
    types: r.types ?? [],
    lat: r.geometry?.location?.lat ?? 0,
    lng: r.geometry?.location?.lng ?? 0,
    business_status: r.business_status ?? "UNKNOWN",
    price_level: r.price_level ?? null,
    lead_quality_score: 0,
    outreach_hints: [] as string[],
  };

  partial.lead_quality_score = calculateLeadQualityScore(partial);

  const full: PlaceBusiness = partial;
  full.outreach_hints = generateOutreachHints(full);

  return full;
}

export async function searchMapsBusinesses(
  query: string,
  location: string,
  apiKey: string,
  max = 20
): Promise<MapsSearchResult> {
  const fullQuery = `${query} ${location}`.trim();
  const clampedMax = Math.min(Math.max(1, max), 60);

  const businesses: PlaceBusiness[] = [];
  let pageToken: string | undefined;

  while (businesses.length < clampedMax) {
    const { results, next_page_token } = await textSearch(
      fullQuery,
      apiKey,
      pageToken
    );

    for (const r of results) {
      if (businesses.length >= clampedMax) break;
      businesses.push(normalizeBusiness(r));
    }

    if (!next_page_token || results.length === 0) break;
    pageToken = next_page_token;

    // Google requires a short delay before using page token
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Enrich top results with place details (phone, website)
  const enrichLimit = Math.min(businesses.length, 10);
  await Promise.allSettled(
    businesses.slice(0, enrichLimit).map(async (b, i) => {
      try {
        const details = await getPlaceDetails(b.place_id, apiKey);
        businesses[i] = normalizeBusiness({ ...b, ...details });
      } catch {
        // Keep partial data on details failure
      }
    })
  );

  businesses.sort((a, b) => b.lead_quality_score - a.lead_quality_score);

  return {
    query,
    location,
    total_results: businesses.length,
    businesses,
    searched_at: new Date().toISOString(),
  };
}

export async function findSalesLeads(
  industry: string,
  location: string,
  apiKey: string,
  minScore = 60
): Promise<MapsLeadsResult> {
  const result = await searchMapsBusinesses(industry, location, apiKey, 60);

  const qualified = result.businesses.filter(
    (b) => b.lead_quality_score >= minScore
  );

  return {
    industry,
    location,
    min_score: minScore,
    total_qualified: qualified.length,
    leads: qualified,
    searched_at: new Date().toISOString(),
  };
}
